# himvaah backend

Node.js + Express API for the flash-flood early-warning dashboard. Serves the
frontend in the exact shapes `frontend/src/lib/mock-data.ts` used, so the UI
switched from mock data to this API with no component rewrites.

## Setup

```bash
npm install
cp .env.example .env      # edit DATABASE_URL
npm run db:reset          # migrate --reset + seed
npm run dev               # http://localhost:4000
npm run worker            # optional: BullMQ worker (needs Redis)
```

| Script | What it does |
| --- | --- |
| `npm run dev` | API with `node --watch` |
| `npm start` | API, no watch |
| `npm run worker` | BullMQ consumer for `risk-recompute` jobs |
| `npm run migrate` | apply `database/migrations/*.sql` (`-- --reset` drops schema first) |
| `npm run seed` | truncate + load the demo dataset |
| `npm run db:reset` | `migrate --reset` then `seed` |

## Environment

| Var | Default | Notes |
| --- | --- | --- |
| `PORT` | `4000` | |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/himvaah` | |
| `JWT_SECRET` | `dev-only-change-me` | signs the demo-auth tokens |
| `REDIS_URL` | `redis://localhost:6379` | queue + cross-process realtime; optional |
| `USE_QUEUE` | `true` | `false` → always recompute inline |
| `RISK_ENGINE` | `heuristic` | or `ml-layer1` to score via the Python service |
| `ML_LAYER1_URL` | `http://localhost:5001` | Flask service from `ml/flashflood-layer1` |
| `CORS_ORIGIN` | `localhost:5173,3000,8080` | comma-separated |

If Redis is unreachable the backend logs a warning and recomputes risk
synchronously in-process — everything still works, just without the queue.

## API

All responses are JSON. Auth is a Bearer token from `/api/auth/login`.

### Auth
| Method | Path | |
| --- | --- | --- |
| `POST` | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| `POST` | `/api/auth/register` | `{ email, password, name, role?, districtId? }` |
| `GET` | `/api/auth/me` | current user (Bearer) |

### Reads (public)
| Method | Path | |
| --- | --- | --- |
| `GET` | `/api/overview` | `{ stats, areas }` — system stats + areas ranked by score |
| `GET` | `/api/districts` | districts + helplines |
| `GET` | `/api/districts/:id` | district + its areas |
| `GET` | `/api/areas` | all areas (full `Area` shape: drivers, trends, up/downstream, shelter) |
| `GET` | `/api/areas/:id` | one area |
| `GET` | `/api/areas/:id/weather` | `{ weather, horizons }` |
| `GET` | `/api/areas/:id/scores?horizon=nowcast` | risk-score time series |
| `GET` | `/api/reports?areaId=` | community reports |
| `GET` | `/api/broadcasts` | recent broadcasts |
| `GET` | `/api/history?districtId=&from=` | past events + timelines |
| `GET` | `/api/insights` | feature importance + model metadata |

### Writes
| Method | Path | Role | |
| --- | --- | --- | --- |
| `POST` | `/api/areas/:id/readings` | officer/admin | push a sensor reading → recompute (the NDRF **Sensor Control** page at `/control` drives this) |
| `POST` | `/api/reports` | any / anon | multipart: `areaId, severity, note?, lat?, lng?, accuracy?, photo?` |
| `PATCH` | `/api/reports/:id/verify` | officer/admin | `{ verified }` |
| `POST` | `/api/broadcasts` | officer/admin | `{ tier, message, messageHi?, areaIds[], channels[] }` |
| `GET`/`PUT` | `/api/me/preferences` | authed | followed areas + push/SMS/quiet-hours |

### Socket.IO

Connects at the same origin. Server emits:

- `risk:update` — an area's full snapshot after a recompute
- `report:new` — a new community report
- `broadcast:new` — a new broadcast

The frontend (`src/lib/live.tsx`) invalidates the matching TanStack Query caches
on each event.

## Risk scoring

`src/lib/risk-engine.js`. Two engines, chosen by `RISK_ENGINE`.

### `index` (default) — hand-built hydrological risk index

No Python, smooth in every input, and every driver is a real term in the
formula. The core idea is **effective runoff load** — how much of the rain
runs straight off instead of soaking in.

```
R  = 1 − exp(−rain1h / 32)                      rainfall intensity (the trigger), 0..1
Cs = 0.15 + 0.80·(soil/100)^1.3                 runoff coefficient from soil saturation
Ci = clamp((rain1h − 30)/90, 0, 0.85)           …floored by intensity: no soil infiltrates a cloudburst
C  = max(Cs, Ci)
A  = clamp(rain4h / 150, 0, 1)                  antecedent primer (already-wet catchment responds harder)
D  = damFactor(damStatus)  |  reservoir%·0.55   dam release / storage stress

load  = R·C·(0.60 + 0.40·A) + 0.22·D
score = round(clamp(load · 118, 0, 100))
```

Drivers are attributed by **perturbation** — how far would the score fall if
this factor were benign? Exact for a hand-built formula, unlike SHAP on a tree.

### `ml-layer1` — index blended with the XGBoost model

Score = `0.5·(100·raw^0.85) + 0.5·indexScore`, where `raw` is the Layer-1
model's raw probability (`src/lib/ml-features.js` rolls the area's
`sensor_readings` into the 13 model features → `POST /predict/vector` on
`ml/flashflood-layer1/src/api.py`). Drivers and lead time still come from the
index. Falls back to the index alone if the Python service is unreachable.
`risk_scores.source` records which ran; `ml_probability` stores the model's
calibrated probability for the console readout.

Both engines: tiers match the frontend (`severe ≥ 75`, `watch ≥ 45`), and a
higher upstream reach lifts the downstream score (surge propagation).

A recompute is triggered by `POST /api/areas/:id/readings`. The worker (or the
inline fallback) writes: the `areas` snapshot, three `risk_scores` rows
(nowcast / short / baseline), the nowcast's `risk_drivers`, and a fresh
`weather_forecast`, then emits `risk:update`.

### About the ML model

The synthetic dataset had a flaw (label was a strict multiplicative AND of
three ^1.5 terms → 0 of 329 flood rows below 88 % reservoir → the model learned
reservoir as a hard veto). `generate_dataset.py` was reworked — weighted-sum
label, an independently-managed reservoir level, faster topsoil drainage
(rain/soil correlation 0.80 → 0.36) — and the model retrained. But a
329-positive-example monotonic XGBoost stays near-binary for mid-range
conditions, which is why the **index is the default** and `ml-layer1` only
*blends* the model 50/50. `ml/flashflood-layer1/_backup_pre_fix/` keeps the
original dataset + model.

Running the ML service (only needed for `RISK_ENGINE=ml-layer1`):

```bash
pip install flask pandas scikit-learn xgboost joblib
cd ml/flashflood-layer1 && python src/api.py    # :5001
```

## Schema

`database/migrations/0001_init.sql` — 17 tables. Highlights:

- `districts`, `helplines`, `areas`, `area_edges` (drainage graph)
- `sensor_readings` (the "artificial sensor" feed), `risk_scores` + `risk_drivers`, `weather_forecast`
- `community_reports`, `broadcasts` + `broadcast_areas`
- `history_events` + `history_timeline`
- `feature_importance`, `model_meta`
- `users`, `user_followed_areas`, `notification_preferences`

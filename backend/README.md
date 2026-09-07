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

**Heuristic** — transparent Node formula per micro-watershed:

```
score = 100 * ( 0.34·rain1h + 0.30·soilSat + 0.16·rain4h + 0.12·damState + 0.08·upstream )
```

**`ml-layer1`** (default) — the Layer-1 XGBoost model does the scoring:

1. `src/lib/ml-features.js` rolls the area's `sensor_readings` history into the
   13 features the model expects (`rainfall_3d_sum`, `rainfall_change_1day`,
   `soil_saturation_change_3day`, `days_since_significant_rain`, `is_monsoon`,
   `rain_saturation_interaction`, …).
2. It POSTs that vector to the Python service's **stateless** `POST /predict/vector`
   (`ml/flashflood-layer1/src/api.py`), which runs `model.predict_proba` +
   the isotonic calibrator and returns a calibrated flash-flood probability.
3. Flash floods are rare, so that probability tops out near ~0.5 even on a bad
   day. It's mapped onto the 0-100 UI scale anchored on the model's own
   decision threshold (`prob == threshold → 45`, the Watch line), then
   **blended 70 % model / 30 % heuristic** so the score still responds to the
   raw inputs the daily-trained model can't fully use from an hourly feed.

Either way: tiers match the frontend (`severe ≥ 75`, `watch ≥ 45`), a **severe**
upstream reach still lifts the downstream score (surge propagation — the
per-watershed model has no view of neighbours), and if the Python service is
unreachable it falls back to the pure heuristic. `risk_scores.source` and
`risk_scores.ml_probability` record what happened.

A recompute is triggered by `POST /api/areas/:id/readings`. The worker (or the
inline fallback) writes: the `areas` snapshot, three `risk_scores` rows
(nowcast / short / baseline), the nowcast's `risk_drivers`, and a fresh
`weather_forecast`, then emits `risk:update`.

> **Caveat:** the model was trained on *daily* synthetic data; the pilot feed is
> ~hourly, so the antecedent windows in `ml-features.js` are computed over the
> last 3 / 7 *readings*, not calendar days. Deterministic and directionally
> right — a real deployment would match the cadence or retrain hourly.

### Running the ML service

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

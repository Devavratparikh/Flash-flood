# himvaah — micro-watershed flash flood prediction

A flash flood early-warning system for hilly regions of India, built for **SIH 2026**.
Pilot districts: **Chamoli, Rudraprayag** (Uttarakhand) and **Kullu, Mandi** (Himachal Pradesh).

---

## The problem

Flash floods in hilly terrain behave differently from river floods: short lead time, high
intensity (50-100mm/hr bursts), and highly localized effects — a village on one side of a
ridge can flood while the next valley over stays dry. Existing systems (like IMD's Flash
Flood Guidance) operate at a 4km x 4km watershed resolution with 6-24 hour lead time — a
strong baseline, but too coarse to tell one specific village whether it needs to evacuate
in the next hour.

## Our approach

Flash floods are governed by catchment physics — what's upstream of a point (slope, soil
saturation, dam releases) — not by where a phone's GPS happens to sit. himvaah segments each
pilot district into **micro-watersheds** and computes risk per watershed, then maps residents
onto whichever watershed they've registered in. Key differentiators from existing systems:

- Village/ward-level resolution instead of 4km grid cells
- Tiered alerts: 6-24hr "Watch" + a short-lead 0-2hr "Act now" nowcast
- Risk driven by rainfall + antecedent soil saturation + upstream dam/reservoir state, not rainfall alone
- Per-zone explainability (soil %, dam status, rainfall trend) instead of a single guidance number
- Offline SMS fallback for when connectivity drops during the event itself
- Community-sourced water-level reports supplementing remote sensing

---

## Working flow

```
1. INGESTION
   Rainfall/nowcast data, DEM + soil maps, dam/reservoir data, and community
   reports all flow into a queue (BullMQ/Redis) for processing.

2. PROCESSING
   Incoming readings are aligned to the correct micro-watershed and used to update
   a rolling 3-7 day soil-saturation index per watershed.

3. PREDICTION
   Hydrological index (Node, default) - effective runoff from rainfall
             intensity, runoff coefficient (soil saturation, floored by
             intensity), antecedent rain and dam state -> 0-100 score.
   Layer 1 - XGBoost nowcast (Python/Flask): optional 50/50 blend with the
             index (RISK_ENGINE=ml-layer1).
   Layer 4 - Sentinel-1 SAR U-Net: post-event flood-extent validation (trained;
             shown on the Model Insights page).
   -> 0-100 risk score + confidence + per-term driver breakdown.

4. STORAGE
   Risk scores are stored in PostgreSQL/PostGIS (spatial queries: which watershed is
   this user/coordinate in?), with Redis caching current scores for fast reads.

5. ALERTING
   score >= 70 -> "Act now"  (push + SMS fallback + admin dashboard)
   score >= 40 -> "Watch"    (admin dashboard + in-app notice)
   score <  40 -> "Normal"   (monitoring only)

6. CLIENT APPS
   Resident app   - registered zone, current risk, explainability, evacuation guidance,
                    a "report water level here" community button.
   Admin dashboard - all zones across districts, dam-release input, historical alert
                    log, for district disaster-management officers.
```

---

## Folder structure

```
himvaah/
|-- README.md
|-- .gitignore
|-- frontend/     React dashboard, wired to the backend API (built)
|-- backend/      Node.js + Express API, Socket.IO, BullMQ queue (built)
|-- database/     PostgreSQL schema + migrations (built)
`-- ml/           Python + Flask prediction service (Layer 1 + Layer 4 trained)
```

---

## Tech stack

**Frontend** — React (TanStack Start), Tailwind, TanStack Query, CSS-3D terrain map, socket.io-client.
**Backend** — Node.js + Express, `pg`, JWT demo auth, Redis + BullMQ (job queue), Socket.IO (real-time push).
**Database** — PostgreSQL (17-table schema modeled on the frontend data shapes; PostGIS planned for Phase 4).
**Risk engine** — hand-built hydrological index in Node (default); optional 50/50 blend with a Python XGBoost model.
**ML** — Python + Flask (isolated microservice): Layer 1 XGBoost nowcast, Layer 4 Sentinel-1 SAR U-Net.

The application layer (frontend + backend) is JS end-to-end; ML is an isolated Python
microservice reached over a REST API — a standard polyglot-microservice pattern that keeps
the fast-moving app code and the scientific-library-dependent ML code cleanly separated.

## Phases

1. **Phase 1 (done)** — Frontend with mocked data; internal college hackathon deliverable.
2. **Phase 2 (current)** — Database schema + backend API live; frontend calls the API;
   demo auth, Socket.IO live updates, BullMQ ingestion queue, hydrological risk index
   with an optional XGBoost blend, NDRF sensor-control console.
3. **Phase 3** — models retrained on real DEM/rainfall/historical data; the ML blend
   weighted up as it earns trust.
4. **Phase 4** — Real terrain/satellite data, real SMS/push delivery, PostGIS spatial lookup.

---

## Running the frontend

```bash
cd frontend
npm install
npm run dev
```

Opens a local dev server (usually `http://localhost:5173`) with hot-reload.

```bash
npm run build    # production build
npm run preview  # serve that build locally to sanity-check it
```

The frontend reads `VITE_API_URL` (default `http://localhost:4000`) from `frontend/.env`.

## Running the database + backend

Requires **PostgreSQL** running locally. **Redis** is optional — without it the
backend recomputes risk synchronously instead of via the BullMQ queue.

```bash
cd backend
npm install
cp .env.example .env          # then edit DATABASE_URL for your Postgres
createdb himvaah               # or: psql -c "CREATE DATABASE himvaah"

npm run db:reset               # drop + recreate schema, then seed demo data
npm run dev                    # API on http://localhost:4000
npm run worker                 # (optional, separate terminal) BullMQ worker — needs Redis
```

`npm run db:reset` is `npm run migrate -- --reset && npm run seed`. The seed
ports every value from `frontend/src/lib/mock-data.ts`, so the dashboard looks
identical after switching from mock data to the API.

**Demo logins** (all password `demo1234`): `resident@himvaah.in`,
`officer@himvaah.in`, `admin@himvaah.in`.

See `backend/README.md` for the full endpoint list and the risk-scoring model.

## Risk scoring

`backend/.env` ships with `RISK_ENGINE=index` — a hand-built hydrological risk
index (effective runoff from rainfall intensity, runoff coefficient, antecedent
rain and dam state). Transparent, smooth in every input, **no Python needed**.

Set `RISK_ENGINE=ml-layer1` to blend the Layer-1 XGBoost model in 50/50; then
run its Flask service in a **third terminal**:

```bash
pip install flask pandas scikit-learn xgboost joblib
cd ml/flashflood-layer1
python src/api.py             # Flask on http://localhost:5001
```

If the service isn't up the backend logs a warning and scores from the index
alone. See `backend/README.md` for the index formula and why the ML model is a
blend, not the default.

Signed in as **NDRF Admin**, the **Sensor Control** page (`/control`) adjusts a
watershed's rainfall / soil / reservoir inputs and re-scores it live — the new
score pushes to every open dashboard over Socket.IO.

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

3. PREDICTION (Python/FastAPI service, called by the Node backend over REST)
   Layer 1 - static susceptibility (Random Forest/XGBoost): how flood-prone is this
             watershed structurally (slope, soil, drainage, history)?
   Layer 2 - dynamic trigger (LSTM): given recent rainfall + soil saturation, what's
             the likely water-level rise in the next 1-6 hours?
   -> combined into a 0-100 risk score + confidence + top contributing drivers.

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
|-- frontend/     React + Three.js dashboard (built)
|-- backend/      Node.js + Express API (not built yet)
|-- database/     PostgreSQL/PostGIS schema, migrations, seed data (not built yet)
`-- ml/           Python + FastAPI prediction service (not built yet)
```

---

## Tech stack

**Frontend** — React (Vite), Three.js (3D terrain + OrbitControls), Recharts, plain CSS.
**Backend** — Node.js + Express, Redis + BullMQ (job queue), Socket.IO (real-time push).
**Database** — PostgreSQL + PostGIS (spatial queries for "which watershed is this in?").
**ML** — Python + FastAPI (isolated microservice), scikit-learn/XGBoost + TensorFlow/Keras (LSTM).

The application layer (frontend + backend) is JS end-to-end; ML is an isolated Python
microservice reached over a REST API — a standard polyglot-microservice pattern that keeps
the fast-moving app code and the scientific-library-dependent ML code cleanly separated.

## Phases

1. **Phase 1 (current)** — Frontend with mocked data; internal college hackathon deliverable.
2. **Phase 2** — Database schema + backend API live; frontend swaps mock data for real calls.
3. **Phase 3** — ML service live; models trained on real DEM/rainfall/historical data.
4. **Phase 4** — Real terrain/satellite data, offline SMS fallback, community reporting.

---

## Running the frontend

```bash
cd frontend
npm install
npm run dev
```

Opens a local dev server (usually `http://localhost:5173`) with hot-reload.

```bash
npm run build    # production build, output to frontend/dist/
npm run preview  # serve that build locally to sanity-check it
```

`backend/`, `database/`, and `ml/` will each get their own run instructions added here
once they exist.

-- himvaah — flash flood early-warning: initial schema
-- Modeled on frontend/src/lib/mock-data.ts so the dashboard can swap
-- mock data for API calls with no change to component shapes.
--
-- Applied by: node backend/src/db/migrate.js

BEGIN;

-- ---------------------------------------------------------------------------
-- Reference / static data
-- ---------------------------------------------------------------------------

CREATE TABLE districts (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  state          TEXT NOT NULL,
  basin          TEXT NOT NULL,
  terrain        TEXT NOT NULL,
  upstream_infra TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE helplines (
  id          SERIAL PRIMARY KEY,
  district_id TEXT NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  number      TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_helplines_district ON helplines(district_id);

-- Micro-watersheds. The score/soil/rain/dam columns are the current
-- snapshot the frontend reads directly; history lives in sensor_readings
-- and risk_scores. The snapshot is refreshed by the risk worker whenever
-- a new sensor reading arrives.
CREATE TABLE areas (
  id                  TEXT PRIMARY KEY,
  district_id         TEXT NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  map_x               REAL NOT NULL,            -- 0..100, position on the terrain canvas
  map_y               REAL NOT NULL,
  elevation_m         INTEGER NOT NULL,
  population           INTEGER NOT NULL,
  channels            TEXT[] NOT NULL DEFAULT '{}',  -- alert channels: Push / SMS / IVR voice
  shelter_name        TEXT NOT NULL,
  shelter_distance_km REAL NOT NULL,
  shelter_walk_min    INTEGER NOT NULL,
  -- current snapshot (refreshed by the risk worker) -----------------------
  score               INTEGER NOT NULL DEFAULT 0,      -- 0..100 risk score
  soil_saturation_pct INTEGER NOT NULL DEFAULT 0,
  rainfall_1h_mm      REAL NOT NULL DEFAULT 0,
  rainfall_4h_mm      REAL NOT NULL DEFAULT 0,
  dam_status          TEXT NOT NULL DEFAULT 'No active release',
  dominant_driver     TEXT NOT NULL DEFAULT 'Baseline susceptibility',
  lead_time_min       INTEGER NOT NULL DEFAULT 180,
  action_note         TEXT NOT NULL DEFAULT '',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_areas_district ON areas(district_id);

-- Drainage graph: an edge from an upstream area to a downstream area.
CREATE TABLE area_edges (
  upstream_id   TEXT NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  downstream_id TEXT NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  PRIMARY KEY (upstream_id, downstream_id)
);

-- ---------------------------------------------------------------------------
-- Time series: sensor feed + model output
-- ---------------------------------------------------------------------------

-- "Artificial sensor" feed. Real IoT/IMD/CWC feeds would write here; for
-- the pilot the admin control panel / ingestion endpoint writes rows.
CREATE TABLE sensor_readings (
  id                  BIGSERIAL PRIMARY KEY,
  area_id             TEXT NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  observed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  rainfall_1h_mm      REAL NOT NULL,
  soil_saturation_pct REAL NOT NULL,
  reservoir_level_pct REAL,
  dam_status          TEXT,
  temp_c              REAL,
  wind_kph            REAL,
  humidity_pct        REAL,
  source              TEXT NOT NULL DEFAULT 'manual'
);

CREATE INDEX idx_readings_area_time ON sensor_readings(area_id, observed_at DESC);

-- Model output. One row per (area, horizon) per recompute.
CREATE TABLE risk_scores (
  id            BIGSERIAL PRIMARY KEY,
  area_id       TEXT NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  horizon       TEXT NOT NULL DEFAULT 'nowcast',   -- nowcast | short | baseline
  score         INTEGER NOT NULL,
  tier          TEXT NOT NULL,                     -- normal | watch | severe
  confidence    INTEGER NOT NULL DEFAULT 80,
  lead_time_min INTEGER,
  model_version TEXT NOT NULL DEFAULT 'heuristic-v1',
  source        TEXT NOT NULL DEFAULT 'heuristic', -- heuristic | ml-layer1
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_area_time ON risk_scores(area_id, horizon, computed_at DESC);

-- SHAP-style explainability rows attached to a single risk_scores row.
CREATE TABLE risk_drivers (
  id            BIGSERIAL PRIMARY KEY,
  risk_score_id BIGINT NOT NULL REFERENCES risk_scores(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  value         TEXT NOT NULL,
  impact        REAL NOT NULL,                     -- -1..1 contribution
  domain        TEXT NOT NULL,                     -- rain | soil | model
  hint          TEXT NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_drivers_score ON risk_drivers(risk_score_id);

-- Per-area hourly forecast, refreshed by the worker on each recompute.
CREATE TABLE weather_forecast (
  id           BIGSERIAL PRIMARY KEY,
  area_id      TEXT NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  issued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  hour_offset  INTEGER NOT NULL,                   -- 0 = now, 1 = +1h ...
  label        TEXT NOT NULL,
  rain_mm      REAL NOT NULL,
  kind         TEXT NOT NULL                       -- heavy | rain | cloud
);

CREATE INDEX idx_forecast_area ON weather_forecast(area_id, issued_at DESC, hour_offset);

-- ---------------------------------------------------------------------------
-- Community reporting
-- ---------------------------------------------------------------------------

CREATE TABLE community_reports (
  id            BIGSERIAL PRIMARY KEY,
  area_id       TEXT NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  location      TEXT NOT NULL,
  severity      TEXT NOT NULL,                     -- Normal | Rising | Flooding
  note          TEXT,
  photo_path    TEXT,                              -- relative path under backend/uploads/
  reporter      TEXT NOT NULL DEFAULT 'Resident',
  reporter_role TEXT NOT NULL DEFAULT 'resident',
  lat           REAL,
  lng           REAL,
  accuracy_m    INTEGER,
  verified      BOOLEAN NOT NULL DEFAULT false,
  verified_by   TEXT,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_area ON community_reports(area_id, submitted_at DESC);

-- ---------------------------------------------------------------------------
-- Broadcasts
-- ---------------------------------------------------------------------------

CREATE TABLE broadcasts (
  id          BIGSERIAL PRIMARY KEY,
  tier        TEXT NOT NULL,                       -- normal | watch | severe
  message     TEXT NOT NULL,
  message_hi  TEXT,
  channels    TEXT[] NOT NULL DEFAULT '{}',
  reach       INTEGER NOT NULL DEFAULT 0,
  officer     TEXT NOT NULL,
  issued_by   BIGINT,
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE broadcast_areas (
  broadcast_id BIGINT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  area_id      TEXT NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  PRIMARY KEY (broadcast_id, area_id)
);

-- ---------------------------------------------------------------------------
-- Event history
-- ---------------------------------------------------------------------------

CREATE TABLE history_events (
  id                TEXT PRIMARY KEY,
  district_id       TEXT NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  event_date        DATE NOT NULL,
  peak_score        INTEGER NOT NULL,
  rainfall_total_mm INTEGER NOT NULL,
  duration          TEXT NOT NULL,
  outcome           TEXT NOT NULL
);

CREATE TABLE history_timeline (
  id         SERIAL PRIMARY KEY,
  event_id   TEXT NOT NULL REFERENCES history_events(id) ON DELETE CASCADE,
  t          TEXT NOT NULL,
  text       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_timeline_event ON history_timeline(event_id);

-- ---------------------------------------------------------------------------
-- Model metadata / insights
-- ---------------------------------------------------------------------------

CREATE TABLE feature_importance (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  weight        REAL NOT NULL,
  domain        TEXT NOT NULL,                     -- rain | soil | model
  model_version TEXT NOT NULL DEFAULT 'heuristic-v1',
  sort_order    INTEGER NOT NULL DEFAULT 0
);

-- Single-row table describing the currently deployed model.
CREATE TABLE model_meta (
  id                 INTEGER PRIMARY KEY DEFAULT 1,
  model_version      TEXT NOT NULL,
  confidence         INTEGER NOT NULL,
  events_calibrated  INTEGER NOT NULL DEFAULT 0,
  last_refresh_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT model_meta_singleton CHECK (id = 1)
);

-- ---------------------------------------------------------------------------
-- Users / preferences (lightweight demo auth)
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'resident',  -- resident | officer | admin
  district_id   TEXT REFERENCES districts(id) ON DELETE SET NULL,
  password_hash TEXT NOT NULL,
  language      TEXT NOT NULL DEFAULT 'English',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_followed_areas (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id TEXT NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, area_id)
);

CREATE TABLE notification_preferences (
  user_id             BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  push_enabled        BOOLEAN NOT NULL DEFAULT true,
  sms_enabled         BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_start         TEXT NOT NULL DEFAULT '22:00',
  quiet_end           TEXT NOT NULL DEFAULT '06:00',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;

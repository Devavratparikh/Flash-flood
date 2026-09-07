/**
 * Seed the database with the demo dataset ported from the frontend mock data.
 * Idempotent: truncates the data tables first, then re-inserts.
 *
 *   node src/db/seed.js
 */
import bcrypt from "bcryptjs";
import { pool, withTransaction } from "./pool.js";
import { horizonsFor, forecastRows } from "../lib/weather.js";
import { tierFor } from "../lib/tiers.js";
import {
  districts,
  areas,
  communityReports,
  broadcastLog,
  historyEvents,
  featureImportance,
  modelMeta,
  demoUsers,
} from "./seed-data.js";

const DATA_TABLES = [
  "notification_preferences",
  "user_followed_areas",
  "users",
  "feature_importance",
  "model_meta",
  "history_timeline",
  "history_events",
  "broadcast_areas",
  "broadcasts",
  "community_reports",
  "weather_forecast",
  "risk_drivers",
  "risk_scores",
  "sensor_readings",
  "area_edges",
  "areas",
  "helplines",
  "districts",
];

async function seed() {
  await withTransaction(async (c) => {
    await c.query(`TRUNCATE ${DATA_TABLES.join(", ")} RESTART IDENTITY CASCADE`);

    // Districts + helplines --------------------------------------------------
    for (const d of districts) {
      await c.query(
        `INSERT INTO districts (id, name, state, basin, terrain, upstream_infra)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [d.id, d.name, d.state, d.basin, d.terrain, d.upstreamInfra],
      );
      for (let i = 0; i < d.helplines.length; i++) {
        const h = d.helplines[i];
        await c.query(
          `INSERT INTO helplines (district_id, label, number, sort_order) VALUES ($1,$2,$3,$4)`,
          [d.id, h.label, h.number, i],
        );
      }
    }

    // Areas ----------------------------------------------------------------
    for (const a of areas) {
      await c.query(
        `INSERT INTO areas (
           id, district_id, name, map_x, map_y, elevation_m, population, channels,
           shelter_name, shelter_distance_km, shelter_walk_min,
           score, soil_saturation_pct, rainfall_1h_mm, rainfall_4h_mm,
           dam_status, dominant_driver, lead_time_min, action_note
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          a.id, a.districtId, a.name, a.x, a.y, a.elevation, a.population, a.channels,
          a.shelter.name, a.shelter.distanceKm, a.shelter.walkMin,
          a.score, a.soilSaturation, a.rainfall1h, a.rainfall4h,
          a.damStatus, a.dominantDriver, a.leadTimeMin, a.actionNote,
        ],
      );
    }

    // Drainage edges -----------------------------------------------------
    for (const a of areas) {
      for (const down of a.downstream) {
        await c.query(
          `INSERT INTO area_edges (upstream_id, downstream_id) VALUES ($1,$2)
           ON CONFLICT DO NOTHING`,
          [a.id, down],
        );
      }
    }

    // Sensor readings: 6 historic points from the trend arrays ----------
    const now = Date.now();
    for (const a of areas) {
      const n = a.rainTrend.length;
      for (let i = 0; i < n; i++) {
        const observedAt = new Date(now - (n - 1 - i) * 60 * 60 * 1000);
        await c.query(
          `INSERT INTO sensor_readings
             (area_id, observed_at, rainfall_1h_mm, soil_saturation_pct,
              reservoir_level_pct, dam_status, source)
           VALUES ($1,$2,$3,$4,$5,$6,'seed')`,
          [
            a.id,
            observedAt,
            a.rainTrend[i],
            a.soilTrend[i],
            null,
            a.damStatus,
          ],
        );
      }
    }

    // Risk scores + drivers: use the mock score so the UI is unchanged --
    for (const a of areas) {
      const horizons = horizonsFor(a.score);
      let nowcastId = null;
      for (const h of horizons) {
        const { rows } = await c.query(
          `INSERT INTO risk_scores
             (area_id, horizon, score, tier, confidence, lead_time_min, model_version, source, computed_at)
           VALUES ($1,$2,$3,$4,$5,$6,'seed-v1','seed', now()) RETURNING id`,
          [
            a.id,
            h.key,
            h.score,
            tierFor(h.score),
            h.confidence,
            h.key === "nowcast" ? a.leadTimeMin : null,
          ],
        );
        if (h.key === "nowcast") nowcastId = rows[0].id;
      }
      for (let i = 0; i < a.drivers.length; i++) {
        const d = a.drivers[i];
        await c.query(
          `INSERT INTO risk_drivers (risk_score_id, label, value, impact, domain, hint, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [nowcastId, d.label, d.value, d.impact, d.domain, d.hint, i],
        );
      }
    }

    // Weather forecast --------------------------------------------------
    for (const a of areas) {
      for (const f of forecastRows({
        elevationM: a.elevation,
        score: a.score,
        soilSaturationPct: a.soilSaturation,
        rainfall1hMm: a.rainfall1h,
      })) {
        await c.query(
          `INSERT INTO weather_forecast (area_id, hour_offset, label, rain_mm, kind)
           VALUES ($1,$2,$3,$4,$5)`,
          [a.id, f.hourOffset, f.label, f.rainMm, f.kind],
        );
      }
    }

    // Community reports ----------------------------------------------
    for (const r of communityReports) {
      await c.query(
        `INSERT INTO community_reports
           (area_id, location, severity, note, reporter, reporter_role,
            lat, lng, accuracy_m, verified, verified_by, submitted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now() - ($12 || ' minutes')::interval)`,
        [
          r.areaId, r.location, r.severity, r.note, r.reporter, r.reporterRole,
          r.coords[0], r.coords[1], r.accuracy, r.verified,
          r.verified ? "District control room" : null, String(r.minutesAgo),
        ],
      );
    }

    // Broadcasts ---------------------------------------------------
    for (const b of broadcastLog) {
      const { rows } = await c.query(
        `INSERT INTO broadcasts (tier, message, channels, reach, officer, issued_at)
         VALUES ($1,$2,$3,$4,$5, now() - ($6 || ' minutes')::interval) RETURNING id`,
        [b.tier, b.message, b.channels, b.reach, b.officer, String(b.minutesAgo)],
      );
      for (const areaId of b.areaIds) {
        await c.query(
          `INSERT INTO broadcast_areas (broadcast_id, area_id) VALUES ($1,$2)`,
          [rows[0].id, areaId],
        );
      }
    }

    // History ----------------------------------------------------
    for (const e of historyEvents) {
      await c.query(
        `INSERT INTO history_events
           (id, district_id, title, event_date, peak_score, rainfall_total_mm, duration, outcome)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [e.id, e.districtId, e.title, e.date, e.peakScore, e.rainfallTotal, e.duration, e.outcome],
      );
      for (let i = 0; i < e.timeline.length; i++) {
        const t = e.timeline[i];
        await c.query(
          `INSERT INTO history_timeline (event_id, t, text, sort_order) VALUES ($1,$2,$3,$4)`,
          [e.id, t.t, t.text, i],
        );
      }
    }

    // Feature importance + model meta -------------------------------
    for (let i = 0; i < featureImportance.length; i++) {
      const f = featureImportance[i];
      await c.query(
        `INSERT INTO feature_importance (name, weight, domain, model_version, sort_order)
         VALUES ($1,$2,$3,$4,$5)`,
        [f.name, f.weight, f.domain, modelMeta.modelVersion, i],
      );
    }
    await c.query(
      `INSERT INTO model_meta (id, model_version, confidence, events_calibrated, last_refresh_at)
       VALUES (1,$1,$2,$3, now())`,
      [modelMeta.modelVersion, modelMeta.confidence, modelMeta.eventsCalibrated],
    );

    // Users ------------------------------------------------------
    for (const u of demoUsers) {
      const hash = await bcrypt.hash(u.password, 10);
      const { rows } = await c.query(
        `INSERT INTO users (email, name, role, district_id, password_hash)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [u.email, u.name, u.role, u.districtId, hash],
      );
      const userId = rows[0].id;
      await c.query(
        `INSERT INTO notification_preferences (user_id) VALUES ($1)`,
        [userId],
      );
      for (const areaId of u.followed) {
        await c.query(
          `INSERT INTO user_followed_areas (user_id, area_id) VALUES ($1,$2)`,
          [userId, areaId],
        );
      }
    }
  });

  console.log(
    `Seeded ${districts.length} districts, ${areas.length} areas, ` +
      `${communityReports.length} reports, ${broadcastLog.length} broadcasts, ` +
      `${historyEvents.length} history events, ${demoUsers.length} demo users.`,
  );
  console.log("Demo login: officer@himvaah.in / demo1234  (also resident@ and admin@)");
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

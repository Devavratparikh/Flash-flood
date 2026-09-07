import { Router } from "express";
import { query } from "../db/pool.js";
import { getAreasFull, getAreaFull } from "../db/areas-repo.js";
import { weatherFor, horizonsFor } from "../lib/weather.js";
import { enqueueRecompute } from "../lib/queue.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// GET /api/areas  — every area in the frontend `Area` shape
router.get("/", async (_req, res, next) => {
  try {
    res.json(await getAreasFull());
  } catch (err) {
    next(err);
  }
});

// GET /api/areas/:id
router.get("/:id", async (req, res, next) => {
  try {
    const area = await getAreaFull(req.params.id);
    if (!area) return res.status(404).json({ error: "Area not found" });
    res.json(area);
  } catch (err) {
    next(err);
  }
});

// GET /api/areas/:id/weather  — current weather + multi-horizon risk
router.get("/:id/weather", async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM areas WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Area not found" });
    const a = rows[0];
    res.json({
      weather: weatherFor({
        elevationM: a.elevation_m,
        score: a.score,
        soilSaturationPct: a.soil_saturation_pct,
        rainfall1hMm: Number(a.rainfall_1h_mm),
      }),
      horizons: horizonsFor(a.score),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/areas/:id/scores?horizon=nowcast&limit=50  — risk score time series
router.get("/:id/scores", async (req, res, next) => {
  try {
    const horizon = ["nowcast", "short", "baseline"].includes(req.query.horizon)
      ? req.query.horizon
      : "nowcast";
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const { rows } = await query(
      `SELECT score, tier, confidence, lead_time_min, model_version, source, computed_at
         FROM risk_scores
        WHERE area_id = $1 AND horizon = $2
        ORDER BY computed_at DESC
        LIMIT $3`,
      [req.params.id, horizon, limit],
    );
    res.json(
      rows
        .map((r) => ({
          score: r.score,
          tier: r.tier,
          confidence: r.confidence,
          leadTimeMin: r.lead_time_min,
          modelVersion: r.model_version,
          source: r.source,
          computedAt: r.computed_at,
        }))
        .reverse(),
    );
  } catch (err) {
    next(err);
  }
});

// POST /api/areas/:id/readings  — push an "artificial sensor" reading.
// Enqueues a risk recompute (or runs it inline if the queue is down).
router.post("/:id/readings", requireAuth, requireRole("officer", "admin"), async (req, res, next) => {
  try {
    const { rows } = await query("SELECT id FROM areas WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Area not found" });

    const b = req.body || {};
    const rainfall1h = Number(b.rainfall1h ?? b.rainfall_1h_mm);
    const soil = Number(b.soilSaturation ?? b.soil_saturation_pct);
    if (Number.isNaN(rainfall1h) || rainfall1h < 0) {
      return res.status(400).json({ error: "rainfall1h must be a non-negative number" });
    }
    if (Number.isNaN(soil) || soil < 0 || soil > 100) {
      return res.status(400).json({ error: "soilSaturation must be between 0 and 100" });
    }

    await query(
      `INSERT INTO sensor_readings
         (area_id, rainfall_1h_mm, soil_saturation_pct, reservoir_level_pct,
          dam_status, temp_c, wind_kph, humidity_pct, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        req.params.id,
        rainfall1h,
        soil,
        b.reservoirLevel ?? b.reservoir_level_pct ?? null,
        b.damStatus ?? b.dam_status ?? null,
        b.temp ?? null,
        b.wind ?? null,
        b.humidity ?? null,
        `manual:${req.user.role}`,
      ],
    );

    const inline = await enqueueRecompute(req.params.id, { by: req.user.id });
    res.status(202).json({
      queued: inline === null,
      area: inline ?? (await getAreaFull(req.params.id)),
    });
  } catch (err) {
    next(err);
  }
});

export default router;

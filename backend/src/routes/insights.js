import { Router } from "express";
import { query } from "../db/pool.js";
import { relativeTime } from "../lib/time.js";

const router = Router();

// GET /api/insights  — feature importance + deployed-model metadata
router.get("/", async (_req, res, next) => {
  try {
    const { rows: fi } = await query(
      "SELECT name, weight, domain FROM feature_importance ORDER BY sort_order",
    );
    const { rows: meta } = await query("SELECT * FROM model_meta WHERE id = 1");
    const { rows: lastScore } = await query("SELECT max(computed_at) AS at FROM risk_scores");
    const m = meta[0] ?? {};
    res.json({
      featureImportance: fi.map((f) => ({ name: f.name, weight: Number(f.weight), domain: f.domain })),
      model: {
        version: m.model_version ?? "heuristic-v1",
        confidence: m.confidence ?? 80,
        eventsCalibrated: m.events_calibrated ?? 0,
        lastRefresh: relativeTime(lastScore[0]?.at ?? m.last_refresh_at ?? new Date()),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

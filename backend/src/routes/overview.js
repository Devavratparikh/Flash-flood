import { Router } from "express";
import { query } from "../db/pool.js";
import { getAreasFull } from "../db/areas-repo.js";
import { tierFor } from "../lib/tiers.js";
import { relativeTime } from "../lib/time.js";

const router = Router();

// GET /api/overview  — system stats + every area ranked by risk.
// Feeds the home dashboard and the app shell header.
router.get("/", async (_req, res, next) => {
  try {
    const areas = await getAreasFull(); // already ordered by score DESC
    const { rows: districtCount } = await query("SELECT count(*)::int AS n FROM districts");
    const { rows: meta } = await query("SELECT * FROM model_meta WHERE id = 1");
    const { rows: lastScore } = await query(
      "SELECT max(computed_at) AS at FROM risk_scores",
    );

    const model = meta[0] ?? { model_version: "heuristic-v1", confidence: 80 };
    const lastRefreshAt = lastScore[0]?.at ?? model.last_refresh_at ?? new Date();

    res.json({
      stats: {
        districtsMonitored: districtCount[0].n,
        areasMonitored: areas.length,
        actNow: areas.filter((a) => tierFor(a.score) === "severe").length,
        watch: areas.filter((a) => tierFor(a.score) === "watch").length,
        modelConfidence: model.confidence,
        lastRefresh: relativeTime(lastRefreshAt),
        modelVersion: model.model_version,
      },
      areas,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

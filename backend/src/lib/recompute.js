/**
 * Recompute an area's risk from its latest sensor reading + upstream state,
 * persist the new snapshot / risk_scores / risk_drivers / weather_forecast,
 * and emit a `risk:update` event for the realtime layer.
 *
 * Called by the BullMQ worker (src/worker.js) and, when the queue is
 * unavailable, synchronously by the ingestion route.
 */
import { withTransaction, query } from "../db/pool.js";
import { scoreArea, mlProbability } from "./risk-engine.js";
import { buildMlFeatures } from "./ml-features.js";
import { horizonsFor, forecastRows } from "./weather.js";
import { events } from "./events.js";
import { getAreaFull } from "../db/areas-repo.js";

export async function recomputeArea(areaId) {
  const { rows: areaRows } = await query("SELECT * FROM areas WHERE id = $1", [areaId]);
  if (!areaRows.length) throw new Error(`Unknown area: ${areaId}`);
  const area = areaRows[0];

  const { rows: upRows } = await query(
    `SELECT COALESCE(MAX(a.score), 0) AS max_up
       FROM area_edges e JOIN areas a ON a.id = e.upstream_id
      WHERE e.downstream_id = $1`,
    [areaId],
  );
  const maxUpstreamScore = Number(upRows[0].max_up) || 0;

  const { rows: readingRows } = await query(
    `SELECT * FROM sensor_readings WHERE area_id = $1 ORDER BY observed_at DESC LIMIT 10`,
    [areaId],
  );
  const latest = readingRows[0];

  const rainfall1hMm = latest ? Number(latest.rainfall_1h_mm) : Number(area.rainfall_1h_mm);
  const soilSaturationPct = latest ? Number(latest.soil_saturation_pct) : Number(area.soil_saturation_pct);
  const rainfall4hMm = readingRows.length
    ? readingRows.slice(0, 4).reduce((s, r) => s + Number(r.rainfall_1h_mm), 0)
    : Number(area.rainfall_4h_mm);
  const damStatus = latest?.dam_status ?? area.dam_status;
  const reservoirLevelPct = latest?.reservoir_level_pct ?? null;

  // Feed the Layer-1 model: features computed from this area's own history.
  const features = buildMlFeatures({
    rainfall1hMm,
    soilSaturationPct,
    reservoirLevelPct: reservoirLevelPct ?? undefined,
    history: readingRows.slice(1).map((r) => ({
      rain: Number(r.rainfall_1h_mm),
      soil: Number(r.soil_saturation_pct),
      reservoir: r.reservoir_level_pct == null ? null : Number(r.reservoir_level_pct),
    })),
  });
  const ml = await mlProbability({ areaId, features });

  const result = scoreArea({
    rainfall1hMm,
    rainfall4hMm,
    soilSaturationPct,
    reservoirLevelPct: reservoirLevelPct ?? undefined,
    damStatus,
    maxUpstreamScore,
    ml: ml ?? undefined,
  });

  await withTransaction(async (c) => {
    await c.query(
      `UPDATE areas SET
         score = $2, soil_saturation_pct = $3, rainfall_1h_mm = $4,
         rainfall_4h_mm = $5, dam_status = $6, dominant_driver = $7,
         lead_time_min = $8, updated_at = now()
       WHERE id = $1`,
      [
        areaId,
        result.score,
        Math.round(soilSaturationPct),
        rainfall1hMm,
        Math.round(rainfall4hMm),
        damStatus,
        result.dominantDriver,
        result.leadTimeMin,
      ],
    );

    const horizons = horizonsFor(result.score);
    let nowcastId = null;
    for (const h of horizons) {
      const { rows } = await c.query(
        `INSERT INTO risk_scores
           (area_id, horizon, score, tier, confidence, lead_time_min, model_version, source, ml_probability)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          areaId,
          h.key,
          h.score,
          h.score >= 75 ? "severe" : h.score >= 45 ? "watch" : "normal",
          h.key === "nowcast" ? result.confidence : h.confidence,
          h.key === "nowcast" ? result.leadTimeMin : null,
          result.modelVersion,
          result.source,
          h.key === "nowcast" ? result.mlProbability : null,
        ],
      );
      if (h.key === "nowcast") nowcastId = rows[0].id;
    }

    for (let i = 0; i < result.drivers.length; i++) {
      const d = result.drivers[i];
      await c.query(
        `INSERT INTO risk_drivers (risk_score_id, label, value, impact, domain, hint, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [nowcastId, d.label, d.value, d.impact, d.domain, d.hint, i],
      );
    }

    await c.query("DELETE FROM weather_forecast WHERE area_id = $1", [areaId]);
    for (const f of forecastRows({
      elevationM: area.elevation_m,
      score: result.score,
      soilSaturationPct,
      rainfall1hMm,
    })) {
      await c.query(
        `INSERT INTO weather_forecast (area_id, hour_offset, label, rain_mm, kind)
         VALUES ($1,$2,$3,$4,$5)`,
        [areaId, f.hourOffset, f.label, f.rainMm, f.kind],
      );
    }
  });

  const full = await getAreaFull(areaId);
  events.emit("risk:update", full);
  return full;
}

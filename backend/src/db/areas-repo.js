/**
 * Reads areas and assembles them into the exact shape the frontend `Area`
 * type expects (frontend/src/lib/mock-data.ts), so components need no change.
 */
import { query } from "./pool.js";

function serializeArea(row, { rainTrend, soilTrend, drivers, upstream, downstream, scoreMeta }) {
  return {
    id: row.id,
    name: row.name,
    districtId: row.district_id,
    score: row.score,
    scoreSource: scoreMeta?.source ?? "seed", // "hydro-index" | "ml-layer1" | "seed"
    modelVersion: scoreMeta?.model_version ?? null,
    mlProbability: scoreMeta?.ml_probability ?? null,
    x: row.map_x,
    y: row.map_y,
    elevation: row.elevation_m,
    population: row.population,
    leadTimeMin: row.lead_time_min,
    dominantDriver: row.dominant_driver,
    soilSaturation: row.soil_saturation_pct,
    rainfall1h: Number(row.rainfall_1h_mm),
    rainfall4h: Number(row.rainfall_4h_mm),
    damStatus: row.dam_status,
    channels: row.channels ?? [],
    actionNote: row.action_note,
    rainTrend: rainTrend ?? [],
    soilTrend: soilTrend ?? [],
    drivers: drivers ?? [],
    upstream: upstream ?? [],
    downstream: downstream ?? [],
    shelter: {
      name: row.shelter_name,
      distanceKm: row.shelter_distance_km,
      walkMin: row.shelter_walk_min,
    },
  };
}

async function loadEdges() {
  const { rows } = await query("SELECT upstream_id, downstream_id FROM area_edges");
  const upstream = new Map();
  const downstream = new Map();
  for (const e of rows) {
    if (!downstream.has(e.upstream_id)) downstream.set(e.upstream_id, []);
    downstream.get(e.upstream_id).push(e.downstream_id);
    if (!upstream.has(e.downstream_id)) upstream.set(e.downstream_id, []);
    upstream.get(e.downstream_id).push(e.upstream_id);
  }
  return { upstream, downstream };
}

async function loadTrends(areaIds) {
  if (!areaIds.length) return new Map();
  const { rows } = await query(
    `SELECT area_id, rainfall_1h_mm, soil_saturation_pct
       FROM (
         SELECT area_id, rainfall_1h_mm, soil_saturation_pct, observed_at,
                row_number() OVER (PARTITION BY area_id ORDER BY observed_at DESC) AS rn
           FROM sensor_readings
          WHERE area_id = ANY($1)
       ) t
      WHERE rn <= 6
      ORDER BY area_id, observed_at ASC`,
    [areaIds],
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.area_id)) map.set(r.area_id, { rain: [], soil: [] });
    map.get(r.area_id).rain.push(Number(r.rainfall_1h_mm));
    map.get(r.area_id).soil.push(Math.round(Number(r.soil_saturation_pct)));
  }
  return map;
}

/** Latest nowcast risk_score per area → its drivers + its source/model_version. */
async function loadNowcast(areaIds) {
  if (!areaIds.length) return { drivers: new Map(), meta: new Map() };
  const { rows: scoreRows } = await query(
    `SELECT DISTINCT ON (area_id) id, area_id, source, model_version, ml_probability
       FROM risk_scores
      WHERE area_id = ANY($1) AND horizon = 'nowcast'
      ORDER BY area_id, computed_at DESC`,
    [areaIds],
  );
  const scoreIdToArea = new Map(scoreRows.map((r) => [r.id, r.area_id]));
  const meta = new Map(
    scoreRows.map((r) => [
      r.area_id,
      { source: r.source, model_version: r.model_version, ml_probability: r.ml_probability },
    ]),
  );
  if (!scoreRows.length) return { drivers: new Map(), meta };

  const { rows: driverRows } = await query(
    `SELECT risk_score_id, label, value, impact, domain, hint
       FROM risk_drivers
      WHERE risk_score_id = ANY($1)
      ORDER BY risk_score_id, sort_order ASC`,
    [scoreRows.map((r) => r.id)],
  );
  const drivers = new Map();
  for (const d of driverRows) {
    const areaId = scoreIdToArea.get(d.risk_score_id);
    if (!drivers.has(areaId)) drivers.set(areaId, []);
    drivers.get(areaId).push({
      label: d.label,
      value: d.value,
      impact: Number(d.impact),
      domain: d.domain,
      hint: d.hint,
    });
  }
  return { drivers, meta };
}

export async function getAreasFull() {
  const { rows } = await query("SELECT * FROM areas ORDER BY score DESC");
  const ids = rows.map((r) => r.id);
  const [{ upstream, downstream }, trends, nowcast] = await Promise.all([
    loadEdges(),
    loadTrends(ids),
    loadNowcast(ids),
  ]);
  return rows.map((row) =>
    serializeArea(row, {
      rainTrend: trends.get(row.id)?.rain,
      soilTrend: trends.get(row.id)?.soil,
      drivers: nowcast.drivers.get(row.id),
      scoreMeta: nowcast.meta.get(row.id),
      upstream: upstream.get(row.id),
      downstream: downstream.get(row.id),
    }),
  );
}

export async function getAreaFull(id) {
  const { rows } = await query("SELECT * FROM areas WHERE id = $1", [id]);
  if (!rows.length) return null;
  const [{ upstream, downstream }, trends, nowcast] = await Promise.all([
    loadEdges(),
    loadTrends([id]),
    loadNowcast([id]),
  ]);
  return serializeArea(rows[0], {
    rainTrend: trends.get(id)?.rain,
    soilTrend: trends.get(id)?.soil,
    drivers: nowcast.drivers.get(id),
    scoreMeta: nowcast.meta.get(id),
    upstream: upstream.get(id),
    downstream: downstream.get(id),
  });
}

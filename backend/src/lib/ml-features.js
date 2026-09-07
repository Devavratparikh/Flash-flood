/**
 * Builds the 13 features the Layer-1 XGBoost model expects
 * (ml/flashflood-layer1 model_config.json → feature_columns) from a
 * micro-watershed's own sensor_readings history, then the backend sends
 * them to the ML service's stateless POST /predict/vector.
 *
 * The model was trained on *daily* data; our pilot feed is roughly hourly,
 * so the "3-day" / "7-day" antecedent windows here are computed over the
 * last 3 / 7 *readings* rather than calendar days. The values are
 * deterministic and move in the right direction when an operator changes
 * the inputs — enough for a live demo — but a production deployment would
 * feed the model a matching cadence (or retrain it hourly).
 */

const SIGNIFICANT_RAIN_MM = 10;
const MONSOON_DAY_START = 135;
const MONSOON_DAY_END = 265;

function dayOfYear(d) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
}

/**
 * @param {object} p
 * @param {number} p.rainfall1hMm         current reading
 * @param {number} p.soilSaturationPct    current reading
 * @param {number} [p.reservoirLevelPct]  current reading (defaults to 50 if unknown)
 * @param {Array<{rain:number, soil:number, reservoir:number|null}>} p.history
 *        prior readings, newest first, NOT including the current one
 * @param {number} [p.urbanizationIndex]  0..1, defaults to 0.5
 * @param {Date}   [p.date]
 * @returns {Record<string, number>} the 13 feature_columns
 */
export function buildMlFeatures({
  rainfall1hMm,
  soilSaturationPct,
  reservoirLevelPct,
  history = [],
  urbanizationIndex = 0.5,
  date = new Date(),
}) {
  const rain = Number(rainfall1hMm) || 0;
  const soil = Number(soilSaturationPct) || 0;
  const reservoir = reservoirLevelPct == null ? 50 : Number(reservoirLevelPct);

  const priorRain = history.map((h) => Number(h.rain) || 0);
  const rainfall3dSum = rain + priorRain.slice(0, 2).reduce((a, b) => a + b, 0);
  const rainfall7dSum = rain + priorRain.slice(0, 6).reduce((a, b) => a + b, 0);

  const prev = history[0];
  const rainfallChange1day = rain - (prev ? Number(prev.rain) || 0 : rain);

  const threeBack = history[2];
  const soilChange3day = threeBack ? soil - (Number(threeBack.soil) || 0) : 0;
  const reservoirChange3day =
    threeBack && threeBack.reservoir != null ? reservoir - Number(threeBack.reservoir) : 0;

  let daysSinceSignificantRain;
  if (rain > SIGNIFICANT_RAIN_MM) {
    daysSinceSignificantRain = 0;
  } else {
    const idx = priorRain.findIndex((r) => r > SIGNIFICANT_RAIN_MM);
    daysSinceSignificantRain = idx === -1 ? 999 : idx + 1;
  }

  const doy = dayOfYear(date);

  return {
    rainfall_mm: rain,
    soil_saturation_pct: soil,
    reservoir_level_pct: reservoir,
    rainfall_3d_sum: rainfall3dSum,
    rainfall_7d_sum: rainfall7dSum,
    rainfall_change_1day: rainfallChange1day,
    soil_saturation_change_3day: soilChange3day,
    reservoir_change_3day: reservoirChange3day,
    rain_saturation_interaction: (rain * soil) / 100,
    days_since_significant_rain: daysSinceSignificantRain,
    month: date.getMonth() + 1,
    is_monsoon: doy >= MONSOON_DAY_START && doy <= MONSOON_DAY_END ? 1 : 0,
    urbanization_index: urbanizationIndex,
  };
}

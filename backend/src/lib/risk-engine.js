/**
 * Risk scoring.
 *
 * Default: a transparent Node heuristic that blends rainfall intensity,
 * antecedent rainfall, soil saturation, upstream dam/reservoir state and
 * upstream propagation into a 0-100 score — the drivers this README
 * describes.
 *
 * Optional (RISK_ENGINE=ml-layer1): the score comes from the Python
 * Layer-1 XGBoost service; drivers and lead time are still derived here.
 */
import { config } from "../config.js";
import { tierFor, clamp } from "./tiers.js";

/** Map free-text dam status to a 0..1 aggravating factor. */
export function damFactor(damStatus = "") {
  const s = damStatus.toLowerCase();
  if (/emergency|overtopping|breach/.test(s)) return 0.95;
  if (/spill|gates open|release:\s*high/.test(s)) return 0.75;
  if (/release/.test(s)) return 0.5;
  if (/\+\d|\bhigh\b|rising/.test(s)) return 0.4;
  return 0;
}

/**
 * @param {object} input
 * @param {number} input.rainfall1hMm
 * @param {number} input.rainfall4hMm
 * @param {number} input.soilSaturationPct
 * @param {number} [input.reservoirLevelPct]
 * @param {string} [input.damStatus]
 * @param {number} [input.maxUpstreamScore]  highest current score among upstream areas
 * @param {number} [input.mlProbability]     0..1 from the ML service, if used
 */
export function scoreArea(input) {
  const rain1 = clamp((input.rainfall1hMm || 0) / 45, 0, 1);
  const rain4 = clamp((input.rainfall4hMm || 0) / 130, 0, 1);
  const soil = clamp((input.soilSaturationPct || 0) / 100, 0, 1);
  const dam = input.damStatus != null
    ? damFactor(input.damStatus)
    : clamp((input.reservoirLevelPct || 0) / 100, 0, 1) * 0.6;
  const upstream = clamp((input.maxUpstreamScore || 0) / 100, 0, 1);

  const contributions = {
    rain1: 0.34 * rain1,
    soil: 0.3 * soil,
    rain4: 0.16 * rain4,
    dam: 0.12 * dam,
    upstream: 0.08 * upstream,
  };

  let heuristicScore = 100 * Object.values(contributions).reduce((a, b) => a + b, 0);

  const usedMl = config.riskEngine === "ml-layer1" && input.ml && typeof input.ml.prob === "number";

  // The Layer-1 model outputs a calibrated flash-flood probability. Flash
  // floods are rare, so even a severe day rarely clears ~0.5 — map the
  // probability onto the 0-100 UI scale anchored on the model's own decision
  // threshold (prob == threshold  ->  score 45, the Watch line).
  let baseScore = heuristicScore;
  let mlScore = null;
  if (usedMl) {
    const { prob, threshold } = input.ml;
    const t = threshold > 0 ? threshold : 0.182;
    mlScore = prob <= t ? (45 * prob) / t : 45 + (55 * (prob - t)) / (2 * t);
    // Blend: the model carries the flood-probability signal, the heuristic
    // keeps the score responsive to the raw inputs (the model was trained on
    // sustained multi-day antecedents this pilot's hourly feed can't supply).
    baseScore = 0.7 * mlScore + 0.3 * heuristicScore;
  }

  // Surge propagation: a SEVERE upstream reach pulls this one up. The
  // per-watershed model has no view of neighbouring reaches, so this stays;
  // a mere Watch upstream no longer pins the whole downstream chain.
  if ((input.maxUpstreamScore || 0) >= 75) {
    baseScore = Math.max(baseScore, 0.8 * input.maxUpstreamScore);
  }

  const score = Math.round(clamp(baseScore, 0, 100));
  const tier = tierFor(score);
  const leadTimeMin = Math.round(clamp(30 + (100 - score) * 2.1, 30, 240));
  const confidence = clamp(94 - Math.round(score / 12), 70, 96);

  const drivers = buildDrivers(input, contributions);
  const dominant = drivers[0];
  const dominantDriver = dominant
    ? `${dominant.label} ${dominant.value}`.replace(/\s+/g, " ").trim()
    : "Baseline susceptibility";

  return {
    score,
    tier,
    leadTimeMin,
    confidence,
    dominantDriver,
    drivers,
    source: usedMl ? "ml-layer1" : "heuristic",
    modelVersion: usedMl ? "xgb-layer1" : "heuristic-v1",
    mlProbability: usedMl ? input.ml.prob : null,
  };
}

function buildDrivers(input, c) {
  const rows = [
    {
      label: "Rainfall (1 hr)",
      value: `${Math.round(input.rainfall1hMm || 0)} mm/hr`,
      impact: round2(c.rain1 / 0.34),
      domain: "rain",
      hint: "Rain measured in this catchment over the last hour.",
    },
    {
      label: "Soil saturation",
      value: `${Math.round(input.soilSaturationPct || 0)}%`,
      impact: round2(c.soil / 0.3),
      domain: "soil",
      hint: "How full the ground already is. Saturated soil cannot absorb more rain, so it runs straight into the river.",
    },
    {
      label: "Antecedent rainfall (4 hr)",
      value: `${Math.round(input.rainfall4hMm || 0)} mm`,
      impact: round2(c.rain4 / 0.16),
      domain: "rain",
      hint: "Accumulated rain over the past four hours across the upstream catchment.",
    },
  ];

  if (c.dam > 0) {
    rows.push({
      label: "Upstream dam / reservoir",
      value: input.damStatus || `${Math.round(input.reservoirLevelPct || 0)}% full`,
      impact: round2(c.dam / 0.12),
      domain: "rain",
      hint: "Water released from an upstream dam or barrage adds to the natural river flow.",
    });
  }

  if ((input.maxUpstreamScore || 0) >= 45) {
    rows.push({
      label: "Upstream propagation",
      value: `+${Math.round(input.maxUpstreamScore)}`,
      impact: round2(clamp(input.maxUpstreamScore / 100, 0, 1)),
      domain: "model",
      hint: "Risk arriving from an area higher up the same river.",
    });
  }

  return rows.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Score a feature vector with the Python Layer-1 XGBoost model via the
 * stateless POST /predict/vector endpoint. The backend computes the 13
 * features from the area's own sensor history (see lib/ml-features.js).
 * Returns the calibrated 0..1 probability, or null on any failure so the
 * caller falls back to the heuristic.
 */
export async function mlProbability({ areaId, features }) {
  if (config.riskEngine !== "ml-layer1" || !features) return null;
  try {
    const res = await fetch(`${config.mlLayer1Url}/predict/vector`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ region_id: areaId, features }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      console.warn(`ML /predict/vector returned ${res.status}; using heuristic for ${areaId}`);
      return null;
    }
    const body = await res.json();
    if (typeof body.calibrated_probability !== "number") return null;
    return {
      prob: body.calibrated_probability,
      raw: body.raw_probability,
      threshold: body.threshold_used ?? 0.182,
    };
  } catch (err) {
    console.warn("ML Layer-1 call failed, falling back to heuristic:", err.message);
    return null;
  }
}

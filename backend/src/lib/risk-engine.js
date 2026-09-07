/**
 * Risk scoring.
 *
 * Default (RISK_ENGINE=index): a transparent, hand-built hydrological risk
 * index. It computes an *effective runoff load* from rainfall intensity, the
 * runoff coefficient (how much rain runs straight off vs infiltrates), the
 * antecedent rainfall primer and upstream dam/reservoir state — then maps
 * that to 0-100. Smooth and continuous in every input, and every driver is a
 * real term in the formula (no SHAP-on-a-tree guesswork).
 *
 * Optional (RISK_ENGINE=ml-layer1): the score is a 50/50 blend of this index
 * and the Python Layer-1 XGBoost model. Drivers and lead time always come
 * from the index.
 */
import { config } from "../config.js";
import { tierFor, clamp } from "./tiers.js";

/** Map free-text dam / reservoir status to a 0..1 aggravating factor. */
export function damFactor(damStatus = "") {
  const s = damStatus.toLowerCase();
  if (/\bno\b[^.]*\brelease\b|no active|normal|nominal/.test(s)) return 0;
  if (/emergency|overtopping|breach/.test(s)) return 0.95;
  if (/spill|gates open|release:\s*high|high release/.test(s)) return 0.75;
  if (/release/.test(s)) return 0.5;
  if (/\+\s*\d|\bhigh\b|rising|moderate/.test(s)) return 0.4;
  return 0;
}

/**
 * Core hydrological index. Returns the 0..1 effective load plus the
 * intermediate terms, so drivers can be attributed exactly.
 *
 * @param {object} p
 * @param {number} p.rainfall1hMm
 * @param {number} p.rainfall4hMm
 * @param {number} p.soilSaturationPct
 * @param {number} [p.reservoirLevelPct]
 * @param {string} [p.damStatus]
 */
export function hydroLoad(p) {
  const rain1 = Math.max(0, Number(p.rainfall1hMm) || 0);
  const rain4 = Math.max(0, Number(p.rainfall4hMm) || 0);
  const soil = clamp((Number(p.soilSaturationPct) || 0) / 100, 0, 1);

  // Rainfall intensity — the trigger. Saturating: ~0.5 at 22 mm/hr, ~0.85 at
  // 60 mm/hr, ~0.97 at 120 mm/hr.
  const R = 1 - Math.exp(-rain1 / 32);

  // Runoff coefficient: the fraction of rain that becomes runoff rather than
  // soaking in. Driven by soil saturation, but floored by intensity — no soil
  // infiltrates a cloudburst (peak infiltration is ~10-30 mm/hr), so above
  // ~30 mm/hr the ground is effectively impervious regardless of how dry it is.
  const Cs = 0.15 + 0.8 * Math.pow(soil, 1.3);
  const Ci = clamp((rain1 - 30) / 90, 0, 0.85);
  const C = Math.max(Cs, Ci);

  // Antecedent primer — a catchment already wet from the last few hours
  // responds faster and higher to new rain.
  const A = clamp(rain4 / 150, 0, 1);

  // Storage stress — an active dam release adds directly to channel flow; a
  // full reservoir has no buffering capacity left.
  const D =
    p.damStatus != null ? damFactor(p.damStatus) : clamp((Number(p.reservoirLevelPct) || 0) / 100, 0, 1) * 0.55;

  const core = R * C * (0.6 + 0.4 * A);
  const damTerm = 0.22 * D;
  const load = clamp(core + damTerm, 0, 1);

  return { load, R, C, Cs, Ci, A, D };
}

/** 0..1 load → 0-100 score. 118 so a full load slightly over-tops, then clamps. */
function loadToScore(load) {
  return Math.round(clamp(load * 118, 0, 100));
}

/**
 * @param {object} input  rainfall1hMm, rainfall4hMm, soilSaturationPct,
 *   reservoirLevelPct?, damStatus?, maxUpstreamScore?, ml? ({raw, prob})
 */
export function scoreArea(input) {
  const t = hydroLoad(input);
  let indexScore = loadToScore(t.load);

  const usedMl = config.riskEngine === "ml-layer1" && input.ml && typeof input.ml.raw === "number";
  let baseScore = indexScore;
  if (usedMl) {
    const mlScore = 100 * Math.pow(clamp(input.ml.raw, 0, 1), 0.85);
    baseScore = 0.5 * mlScore + 0.5 * indexScore;
  }

  // Surge propagation: risk arriving from a much higher upstream reach. The
  // index is per-watershed, so this is added on top.
  const up = Number(input.maxUpstreamScore) || 0;
  if (up >= 55) baseScore = Math.max(baseScore, 0.72 * up);

  const score = Math.round(clamp(baseScore, 0, 100));
  const tier = tierFor(score);

  // Lead time: shorter as risk rises, and shorter still for a high-intensity
  // (fast-onset) burst.
  const leadTimeMin = Math.round(clamp(35 + (100 - score) * 2.0 - t.R * 25, 25, 240));
  // Confidence: highest for clear-cut extremes, lowest mid-range.
  const confidence = Math.round(clamp(70 + Math.abs(score - 45) * 0.35, 70, 94));

  const drivers = buildDrivers(input, t, score);
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
    source: usedMl ? "ml-layer1" : "hydro-index",
    modelVersion: usedMl ? "xgb-layer1 + hydro-index" : "hydro-index-v1",
    mlProbability: usedMl ? input.ml.prob : null,
  };
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Attribute the score to each term by perturbation: how far would the score
 * fall if this factor were at a benign baseline? Exact for a hand-built
 * formula, unlike SHAP on a tree.
 */
function buildDrivers(input, t, score) {
  const at = (over) => loadToScore(hydroLoad({ ...input, ...over }).load);

  const dRain = score - at({ rainfall1hMm: 6 });
  const dSoil = score - at({ soilSaturationPct: 30 });
  const dAnte = score - at({ rainfall4hMm: 8 });
  const dDam = score - at({ damStatus: "normal", reservoirLevelPct: 25 });

  const rows = [
    {
      label: "Rainfall intensity (1 hr)",
      value: `${Math.round(input.rainfall1hMm || 0)} mm/hr`,
      impact: round2(clamp(dRain / 55, 0, 1)),
      domain: "rain",
      hint:
        t.Ci > t.Cs
          ? "This burst is intense enough to outpace how fast any soil can absorb it — nearly all of it runs off."
          : "Rain measured in this catchment over the last hour — the trigger for a flash flood.",
    },
    {
      label: "Soil saturation",
      value: `${Math.round(input.soilSaturationPct || 0)}%`,
      impact: round2(clamp(dSoil / 55, 0, 1)),
      domain: "soil",
      hint: "How full the ground already is. Saturated soil can't absorb more rain, so it runs straight into the river.",
    },
    {
      label: "Antecedent rainfall (4 hr)",
      value: `${Math.round(input.rainfall4hMm || 0)} mm`,
      impact: round2(clamp(dAnte / 55, 0, 1)),
      domain: "rain",
      hint: "Rain over the past few hours — a catchment that is already wet responds faster and higher.",
    },
  ];

  if (t.D > 0.05) {
    rows.push({
      label: "Dam / reservoir stress",
      value: input.damStatus || `${Math.round(input.reservoirLevelPct || 0)}% full`,
      impact: round2(clamp(dDam / 55, 0, 1)),
      domain: "model",
      hint: "An active upstream release adds directly to channel flow; a full reservoir has no buffering capacity left.",
    });
  }

  const up = Number(input.maxUpstreamScore) || 0;
  if (up >= 55) {
    rows.push({
      label: "Upstream surge",
      value: `+${Math.round(up)}`,
      impact: round2(clamp(up / 100, 0, 1)),
      domain: "model",
      hint: "Risk arriving from an area higher up the same river.",
    });
  }

  return rows.filter((r) => r.impact > 0.01).sort((a, b) => b.impact - a.impact);
}

/**
 * Score a feature vector with the Python Layer-1 XGBoost model via the
 * stateless POST /predict/vector endpoint (features from lib/ml-features.js).
 * Returns { prob, raw, threshold } or null on any failure — the caller then
 * scores from the hydrological index alone.
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
      console.warn(`ML /predict/vector returned ${res.status}; scoring ${areaId} from the index only`);
      return null;
    }
    const body = await res.json();
    if (typeof body.raw_probability !== "number") return null;
    return {
      prob: body.calibrated_probability,
      raw: body.raw_probability,
      threshold: body.threshold_used ?? 0.182,
    };
  } catch (err) {
    console.warn("ML Layer-1 call failed, scoring from the index only:", err.message);
    return null;
  }
}

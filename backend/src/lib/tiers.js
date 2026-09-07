/** Risk tiers — thresholds match frontend/src/lib/mock-data.ts `tierFor`. */

export function tierFor(score) {
  if (score >= 75) return "severe";
  if (score >= 45) return "watch";
  return "normal";
}

export const TIER_LABEL = {
  normal: "Normal",
  watch: "Watch",
  severe: "Act Now",
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export { clamp };

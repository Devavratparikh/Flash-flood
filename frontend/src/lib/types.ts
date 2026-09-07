/**
 * Shared domain types + pure helpers for the himvaah dashboard.
 *
 * The values that used to live here as mock arrays now come from the backend
 * API (see lib/api.ts and lib/queries.ts). Types and tier logic stay here so
 * every component keeps importing them from one place.
 */

export type Tier = "normal" | "watch" | "severe";

export const TIER_LABEL: Record<Tier, string> = {
  normal: "Normal",
  watch: "Watch",
  severe: "Act Now",
};

export function tierFor(score: number): Tier {
  if (score >= 75) return "severe";
  if (score >= 45) return "watch";
  return "normal";
}

export const tierClass: Record<Tier, string> = {
  normal: "tier-normal",
  watch: "tier-watch",
  severe: "tier-severe",
};

export const tierText: Record<Tier, string> = {
  normal: "text-normal",
  watch: "text-watch",
  severe: "text-severe",
};

export const tierBg: Record<Tier, string> = {
  normal: "bg-normal",
  watch: "bg-watch",
  severe: "bg-severe",
};

export type Driver = {
  label: string;
  value: string;
  /** SHAP-style contribution, -1..1 */
  impact: number;
  domain: "rain" | "soil" | "model";
  hint: string;
};

export type Area = {
  id: string;
  name: string;
  districtId: string;
  score: number;
  /** where the current score came from: "hydro-index" | "ml-layer1" | "seed" */
  scoreSource?: string;
  modelVersion?: string | null;
  /** raw calibrated flash-flood probability from the Layer-1 model, 0..1 */
  mlProbability?: number | null;
  /** position on the terrain canvas, 0..100 */
  x: number;
  y: number;
  elevation: number;
  population: number;
  leadTimeMin: number;
  dominantDriver: string;
  soilSaturation: number;
  rainfall1h: number;
  rainfall4h: number;
  damStatus: string;
  channels: string[];
  actionNote: string;
  rainTrend: number[];
  soilTrend: number[];
  drivers: Driver[];
  upstream: string[];
  downstream: string[];
  shelter: { name: string; distanceKm: number; walkMin: number };
};

export type District = {
  id: string;
  name: string;
  state: string;
  basin: string;
  terrain: string;
  upstreamInfra: string;
  helplines: { label: string; number: string }[];
};

export type SystemStats = {
  districtsMonitored: number;
  areasMonitored: number;
  actNow: number;
  watch: number;
  modelConfidence: number;
  lastRefresh: string;
  modelVersion: string;
};

export type WeatherNow = {
  tempC: number;
  rainRate: number;
  windKph: number;
  humidity: number;
  forecast: { hour: string; mm: number; kind: "heavy" | "rain" | "cloud" }[];
};

export type Horizon = {
  key: string;
  label: string;
  window: string;
  score: number;
  confidence: number;
  note: string;
};

export type CommunityReport = {
  id: string;
  areaId: string;
  location: string;
  severity: "Normal" | "Rising" | "Flooding";
  note: string | null;
  minutesAgo: number;
  verified: boolean;
  reporter: string;
  coords: string;
  accuracy: number | null;
  photoUrl?: string | null;
};

export type BroadcastLog = {
  id: string;
  tier: Tier;
  areas: string;
  message: string;
  messageHi?: string | null;
  channels: string[];
  reach: number;
  minutesAgo: number;
  officer: string;
};

export type HistoricEvent = {
  id: string;
  title: string;
  districtId: string;
  date: string;
  peakScore: number;
  rainfallTotal: number;
  duration: string;
  outcome: string;
  timeline: { t: string; text: string }[];
};

export type FeatureImportance = { name: string; weight: number; domain: "rain" | "soil" | "model" };

export type Insights = {
  featureImportance: FeatureImportance[];
  model: { version: string; confidence: number; eventsCalibrated: number; lastRefresh: string };
};

export type Preferences = {
  pushEnabled: boolean;
  smsEnabled: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  followedAreaIds: string[];
};

export type Role = "resident" | "officer" | "admin";

export type User = {
  id: number;
  email: string;
  name: string;
  role: Role;
  districtId: string | null;
  language: string;
};

export const languages = ["English", "हिन्दी", "ગુજરાતી", "मराठी"];

/* --------------------- pure client-side derivations --------------------- */
// Mirror the backend so the area page can render without an extra request.

export function weatherFor(a: Area): WeatherNow {
  return {
    tempC: Math.round(26 - a.elevation / 220),
    rainRate: a.rainfall1h,
    windKph: 12 + (a.score % 17),
    humidity: Math.min(99, 62 + Math.round(a.soilSaturation / 4)),
    forecast: [
      { hour: "now", mm: a.rainfall1h, kind: a.rainfall1h > 25 ? "heavy" : "rain" },
      { hour: "+1h", mm: Math.round(a.rainfall1h * 1.1), kind: "heavy" },
      { hour: "+2h", mm: Math.round(a.rainfall1h * 0.8), kind: "rain" },
      { hour: "+3h", mm: Math.round(a.rainfall1h * 0.55), kind: "rain" },
      { hour: "+4h", mm: Math.round(a.rainfall1h * 0.3), kind: "cloud" },
      { hour: "+5h", mm: Math.round(a.rainfall1h * 0.2), kind: "cloud" },
    ],
  };
}

export function horizonsFor(a: Area): Horizon[] {
  return [
    {
      key: "nowcast",
      label: "Nowcast",
      window: "0–3 hr",
      score: a.score,
      confidence: 92,
      note: "Radar-driven, updates every 5 minutes.",
    },
    {
      key: "short",
      label: "Short-term forecast",
      window: "3–24 hr",
      score: Math.max(8, Math.round(a.score * 0.78)),
      confidence: 76,
      note: "NWP ensemble blended with catchment response.",
    },
    {
      key: "baseline",
      label: "Baseline susceptibility",
      window: "static",
      score: Math.max(6, Math.round(a.score * 0.52)),
      confidence: 98,
      note: "Terrain, land use and historical exposure.",
    },
  ];
}

/* ------------------------------ lookups -------------------------------- */

export const byId = <T extends { id: string }>(list: T[] | undefined, id: string | undefined) =>
  list?.find((x) => x.id === id);

export const areasIn = (areas: Area[] | undefined, districtId: string) =>
  (areas ?? []).filter((a) => a.districtId === districtId);

export const rankByScore = <T extends { score: number }>(list: T[] | undefined) =>
  [...(list ?? [])].sort((a, b) => b.score - a.score);

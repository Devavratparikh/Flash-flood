/**
 * Current weather + hourly forecast + multi-horizon risk, derived from an
 * area's current snapshot. Formulas match the frontend's `weatherFor` and
 * `horizonsFor` in mock-data.ts so the UI is unchanged.
 */

export function weatherFor({ elevationM, score, soilSaturationPct, rainfall1hMm }) {
  const rain = Number(rainfall1hMm) || 0;
  return {
    tempC: Math.round(26 - elevationM / 220),
    rainRate: rain,
    windKph: 12 + (score % 17),
    humidity: Math.min(99, 62 + Math.round(soilSaturationPct / 4)),
    forecast: [
      { hour: "now", mm: rain, kind: rain > 25 ? "heavy" : "rain" },
      { hour: "+1h", mm: Math.round(rain * 1.1), kind: "heavy" },
      { hour: "+2h", mm: Math.round(rain * 0.8), kind: "rain" },
      { hour: "+3h", mm: Math.round(rain * 0.55), kind: "rain" },
      { hour: "+4h", mm: Math.round(rain * 0.3), kind: "cloud" },
      { hour: "+5h", mm: Math.round(rain * 0.2), kind: "cloud" },
    ],
  };
}

export function horizonsFor(score) {
  return [
    { key: "nowcast", label: "Nowcast", window: "0–3 hr", score, confidence: 92, note: "Radar-driven, updates every 5 minutes." },
    { key: "short", label: "Short-term forecast", window: "3–24 hr", score: Math.max(8, Math.round(score * 0.78)), confidence: 76, note: "NWP ensemble blended with catchment response." },
    { key: "baseline", label: "Baseline susceptibility", window: "static", score: Math.max(6, Math.round(score * 0.52)), confidence: 98, note: "Terrain, land use and historical exposure." },
  ];
}

/** Forecast rows for the weather_forecast table, from an area snapshot. */
export function forecastRows(area) {
  return weatherFor(area).forecast.map((f, i) => ({
    hourOffset: i,
    label: f.hour,
    rainMm: f.mm,
    kind: f.kind,
  }));
}

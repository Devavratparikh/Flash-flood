// Mock data for the demo. In the real build, this whole file is replaced by
// an API call to the Node.js backend (GET /api/districts), which itself
// pulls from PostGIS. The shape (id, name, zones[{score, soil, dam, rain, trend}])
// is designed to match that future response so swapping the source is a
// one-line change in App.jsx, not a rewrite of any component.

export const TIER = {
  safe: { label: "Normal", color: "#4F9D8B", glow: "rgba(79,157,139,0.18)", hex: 0x4f9d8b },
  watch: { label: "Watch", color: "#E0A542", glow: "rgba(224,165,66,0.18)", hex: 0xe0a542 },
  act: { label: "Act now", color: "#E1543B", glow: "rgba(225,84,59,0.22)", hex: 0xe1543b },
};

export function tierFor(score) {
  if (score >= 70) return "act";
  if (score >= 40) return "watch";
  return "safe";
}

export const DISTRICTS = [
  {
    id: "chamoli",
    name: "Chamoli",
    note: "Alaknanda basin, upper reaches near Joshimath — steep gradient, hydro-project activity upstream.",
    seed: 1.1,
    zones: [
      { id: "joshimath-n", name: "Joshimath North", score: 78, soil: 84, dam: "Release: High", rain: 62, trend: [8, 14, 22, 34, 48, 58, 62], x: -230, zOff: 8 },
      { id: "vishnuprayag", name: "Vishnuprayag Confluence", score: 61, soil: 71, dam: "Release: Moderate", rain: 41, trend: [5, 9, 15, 22, 30, 36, 41], x: -70, zOff: 14 },
      { id: "alaknanda-up", name: "Alaknanda Upper", score: 35, soil: 48, dam: "Normal", rain: 14, trend: [3, 4, 6, 8, 10, 12, 14], x: 90, zOff: 70 },
      { id: "badrinath", name: "Badrinath Approach", score: 22, soil: 33, dam: "Normal", rain: 6, trend: [2, 2, 3, 4, 5, 5, 6], x: 250, zOff: -85 },
    ],
  },
  {
    id: "rudraprayag",
    name: "Rudraprayag",
    note: "Mandakini–Alaknanda confluence zone — historically the highest-consequence catchment in this belt.",
    seed: 2.3,
    zones: [
      { id: "kedarnath-valley", name: "Kedarnath Valley", score: 88, soil: 91, dam: "Normal", rain: 74, trend: [10, 20, 33, 47, 60, 68, 74], x: -240, zOff: 6 },
      { id: "sonprayag", name: "Sonprayag Confluence", score: 66, soil: 74, dam: "Normal", rain: 45, trend: [6, 11, 18, 26, 34, 40, 45], x: -80, zOff: 10 },
      { id: "rudraprayag-town", name: "Rudraprayag Town", score: 44, soil: 55, dam: "Normal", rain: 24, trend: [4, 6, 10, 14, 18, 21, 24], x: 80, zOff: -60 },
      { id: "mandakini-lower", name: "Mandakini Lower", score: 29, soil: 39, dam: "Normal", rain: 11, trend: [2, 3, 5, 6, 8, 9, 11], x: 240, zOff: 75 },
    ],
  },
  {
    id: "kullu",
    name: "Kullu",
    note: "Beas River corridor — dense tourist footfall in valley-floor towns raises exposure.",
    seed: 3.7,
    zones: [
      { id: "manali-nullah", name: "Manali Nullah", score: 55, soil: 63, dam: "Normal", rain: 33, trend: [5, 8, 13, 19, 25, 29, 33], x: -230, zOff: 12 },
      { id: "beas-right", name: "Beas Right Bank", score: 73, soil: 79, dam: "Release: Moderate", rain: 52, trend: [7, 13, 21, 30, 39, 46, 52], x: -70, zOff: 8 },
      { id: "kullu-town", name: "Kullu Town Basin", score: 41, soil: 52, dam: "Normal", rain: 19, trend: [3, 5, 8, 11, 14, 17, 19], x: 90, zOff: -65 },
      { id: "banjar-valley", name: "Banjar Valley", score: 18, soil: 28, dam: "Normal", rain: 5, trend: [1, 2, 2, 3, 4, 4, 5], x: 250, zOff: 80 },
    ],
  },
  {
    id: "mandi",
    name: "Mandi",
    note: "Downstream of Pandoh Dam — release timing matters as much as local rainfall here.",
    seed: 4.9,
    zones: [
      { id: "pandoh-downstream", name: "Pandoh Dam Downstream", score: 69, soil: 66, dam: "Release: High", rain: 30, trend: [5, 9, 14, 19, 24, 27, 30], x: -230, zOff: 10 },
      { id: "suketi-khad", name: "Suketi Khad", score: 52, soil: 60, dam: "Normal", rain: 27, trend: [4, 7, 11, 16, 21, 24, 27], x: -70, zOff: -55 },
      { id: "mandi-town", name: "Mandi Town Basin", score: 33, soil: 44, dam: "Normal", rain: 12, trend: [2, 3, 5, 7, 9, 10, 12], x: 90, zOff: 9 },
      { id: "sundernagar", name: "Sundernagar Bowl", score: 15, soil: 24, dam: "Normal", rain: 4, trend: [1, 1, 2, 2, 3, 3, 4], x: 250, zOff: 65 },
    ],
  },
];

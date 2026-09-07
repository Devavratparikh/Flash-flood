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

export const districts: District[] = [
  {
    id: "chamoli",
    name: "Chamoli",
    state: "Uttarakhand",
    basin: "Alaknanda basin",
    terrain: "Steep glacial valleys, 1,300–3,600 m, thin soil over fractured rock",
    upstreamInfra: "Tapovan barrage · Rishiganga catchment · NTPC diversion tunnel",
    helplines: [
      { label: "District Emergency Ops", number: "1077" },
      { label: "SDRF Chamoli", number: "0135-2410197" },
      { label: "Ambulance", number: "108" },
    ],
  },
  {
    id: "rudraprayag",
    name: "Rudraprayag",
    state: "Uttarakhand",
    basin: "Mandakini–Alaknanda confluence",
    terrain: "Narrow gorge sections, high channel constriction, debris-prone slopes",
    upstreamInfra: "Chorabari moraine lake · Singoli-Bhatwari HEP · Sonprayag causeway",
    helplines: [
      { label: "District Control Room", number: "1077" },
      { label: "Kedarnath Yatra Cell", number: "01364-233727" },
      { label: "Ambulance", number: "108" },
    ],
  },
  {
    id: "kullu",
    name: "Kullu",
    state: "Himachal Pradesh",
    basin: "Beas basin",
    terrain: "Broad U-shaped valley with steep tributary nallahs and heavy toe erosion",
    upstreamInfra: "Larji dam · Parbati HEP-II · Manali flood embankments",
    helplines: [
      { label: "District Disaster Cell", number: "1077" },
      { label: "Police Control", number: "01902-224100" },
      { label: "Ambulance", number: "108" },
    ],
  },
  {
    id: "mandi",
    name: "Mandi",
    state: "Himachal Pradesh",
    basin: "Beas mid-reach",
    terrain: "Mid-hill terraces, saturated colluvium, dense settlement on floodplain",
    upstreamInfra: "Pandoh dam (release-controlled) · Uhl-III · BBMB diversion",
    helplines: [
      { label: "District Control Room", number: "1077" },
      { label: "Pandoh Dam Ops", number: "01905-235012" },
      { label: "Ambulance", number: "108" },
    ],
  },
];

function mkArea(a: Omit<Area, "districtId">, districtId: string): Area {
  return { ...a, districtId };
}

export const areas: Area[] = [
  // ---------------- Chamoli ----------------
  mkArea(
    {
      id: "raini",
      name: "Raini Village",
      score: 91,
      x: 22,
      y: 30,
      elevation: 2340,
      population: 1180,
      leadTimeMin: 42,
      dominantDriver: "Soil saturation 94%",
      soilSaturation: 94,
      rainfall1h: 38,
      rainfall4h: 112,
      damStatus: "Tapovan barrage — gates open, 3 of 4",
      channels: ["Push", "SMS", "IVR voice"],
      actionNote:
        "Move to higher ground now. Riverside lanes and the lower bazaar are expected to be reached within the hour.",
      rainTrend: [6, 11, 19, 27, 33, 38],
      soilTrend: [71, 76, 82, 87, 91, 94],
      drivers: [
        {
          label: "Rainfall (4 hr)",
          value: "112 mm",
          impact: 0.94,
          domain: "rain",
          hint: "Accumulated rain over the past four hours across the upstream catchment.",
        },
        {
          label: "Soil saturation",
          value: "94%",
          impact: 0.86,
          domain: "soil",
          hint: "How full the ground already is. Saturated soil cannot absorb more rain, so it runs straight into the river.",
        },
        {
          label: "Upstream release",
          value: "3 gates",
          impact: 0.61,
          domain: "rain",
          hint: "Water deliberately released from an upstream barrage adds to the natural flow.",
        },
        {
          label: "Slope angle",
          value: "34°",
          impact: 0.38,
          domain: "model",
          hint: "Baseline terrain steepness — steeper slopes move water downhill faster.",
        },
        {
          label: "Channel width",
          value: "48 m",
          impact: -0.18,
          domain: "model",
          hint: "A wider channel can carry more water before it spills over.",
        },
      ],
      upstream: [],
      downstream: ["tapovan"],
      shelter: { name: "Raini Govt. Primary School", distanceKm: 0.6, walkMin: 9 },
    },
    "chamoli",
  ),
  mkArea(
    {
      id: "tapovan",
      name: "Tapovan",
      score: 78,
      x: 40,
      y: 46,
      elevation: 1890,
      population: 3400,
      leadTimeMin: 65,
      dominantDriver: "Upstream surge inbound",
      soilSaturation: 88,
      rainfall1h: 29,
      rainfall4h: 94,
      damStatus: "Tapovan barrage — spilling",
      channels: ["Push", "SMS"],
      actionNote:
        "Surge from Raini is tracking toward this reach. Clear the riverbank and the tunnel approach road.",
      rainTrend: [4, 9, 15, 21, 26, 29],
      soilTrend: [66, 71, 77, 82, 86, 88],
      drivers: [
        {
          label: "Upstream propagation",
          value: "Raini +91",
          impact: 0.88,
          domain: "model",
          hint: "Risk arriving from an area higher up the same river.",
        },
        {
          label: "Rainfall (4 hr)",
          value: "94 mm",
          impact: 0.72,
          domain: "rain",
          hint: "Accumulated rain over the past four hours.",
        },
        {
          label: "Soil saturation",
          value: "88%",
          impact: 0.64,
          domain: "soil",
          hint: "How full the ground already is.",
        },
        {
          label: "Embankment condition",
          value: "Reinforced",
          impact: -0.31,
          domain: "model",
          hint: "Recent bank protection reduces spill probability.",
        },
      ],
      upstream: ["raini"],
      downstream: ["joshimath"],
      shelter: { name: "Tapovan Community Hall", distanceKm: 1.2, walkMin: 16 },
    },
    "chamoli",
  ),
  mkArea(
    {
      id: "joshimath",
      name: "Joshimath Lower",
      score: 54,
      x: 60,
      y: 60,
      elevation: 1620,
      population: 8900,
      leadTimeMin: 110,
      dominantDriver: "Rainfall 21 mm/hr",
      soilSaturation: 74,
      rainfall1h: 21,
      rainfall4h: 61,
      damStatus: "No active release",
      channels: ["Push"],
      actionNote: "Stay alert. Avoid the nallah crossings on the lower approach road after dark.",
      rainTrend: [3, 6, 11, 15, 19, 21],
      soilTrend: [52, 58, 63, 68, 72, 74],
      drivers: [
        {
          label: "Rainfall (4 hr)",
          value: "61 mm",
          impact: 0.66,
          domain: "rain",
          hint: "Accumulated rain over the past four hours.",
        },
        {
          label: "Soil saturation",
          value: "74%",
          impact: 0.49,
          domain: "soil",
          hint: "How full the ground already is.",
        },
        {
          label: "Subsidence zone",
          value: "Active",
          impact: 0.34,
          domain: "model",
          hint: "Ground movement recorded in this settlement raises baseline vulnerability.",
        },
        {
          label: "Drainage capacity",
          value: "Adequate",
          impact: -0.27,
          domain: "model",
          hint: "Local storm drains are currently coping with runoff.",
        },
      ],
      upstream: ["tapovan"],
      downstream: ["pipalkoti"],
      shelter: { name: "Joshimath Inter College", distanceKm: 0.9, walkMin: 12 },
    },
    "chamoli",
  ),
  mkArea(
    {
      id: "pipalkoti",
      name: "Pipalkoti",
      score: 28,
      x: 79,
      y: 74,
      elevation: 1260,
      population: 5200,
      leadTimeMin: 180,
      dominantDriver: "Baseline susceptibility",
      soilSaturation: 51,
      rainfall1h: 8,
      rainfall4h: 24,
      damStatus: "No active release",
      channels: ["Push"],
      actionNote: "No action needed. Conditions are being monitored on the normal cycle.",
      rainTrend: [1, 2, 4, 6, 7, 8],
      soilTrend: [38, 41, 44, 47, 49, 51],
      drivers: [
        {
          label: "Rainfall (4 hr)",
          value: "24 mm",
          impact: 0.31,
          domain: "rain",
          hint: "Accumulated rain over the past four hours.",
        },
        {
          label: "Soil saturation",
          value: "51%",
          impact: 0.22,
          domain: "soil",
          hint: "How full the ground already is.",
        },
        {
          label: "Distance from channel",
          value: "310 m",
          impact: -0.44,
          domain: "model",
          hint: "Settlement sits well back from the main river channel.",
        },
      ],
      upstream: ["joshimath"],
      downstream: [],
      shelter: { name: "Pipalkoti Bus Depot Hall", distanceKm: 0.4, walkMin: 6 },
    },
    "chamoli",
  ),

  // ---------------- Rudraprayag ----------------
  mkArea(
    {
      id: "sonprayag",
      name: "Sonprayag",
      score: 84,
      x: 25,
      y: 26,
      elevation: 1830,
      population: 2100,
      leadTimeMin: 38,
      dominantDriver: "Soil saturation 91%",
      soilSaturation: 91,
      rainfall1h: 34,
      rainfall4h: 103,
      damStatus: "Moraine lake level +1.8 m",
      channels: ["Push", "SMS", "IVR voice"],
      actionNote:
        "Evacuate the causeway parking and shop row. Pilgrim movement is suspended above this point.",
      rainTrend: [5, 10, 17, 24, 30, 34],
      soilTrend: [68, 74, 80, 85, 89, 91],
      drivers: [
        {
          label: "Rainfall (4 hr)",
          value: "103 mm",
          impact: 0.9,
          domain: "rain",
          hint: "Accumulated rain over the past four hours.",
        },
        {
          label: "Soil saturation",
          value: "91%",
          impact: 0.81,
          domain: "soil",
          hint: "How full the ground already is.",
        },
        {
          label: "Moraine lake level",
          value: "+1.8 m",
          impact: 0.58,
          domain: "model",
          hint: "A glacial lake filling above normal can breach and release a sudden flood wave.",
        },
        {
          label: "Channel constriction",
          value: "High",
          impact: 0.42,
          domain: "model",
          hint: "The valley narrows here, forcing water levels up quickly.",
        },
      ],
      upstream: [],
      downstream: ["guptkashi"],
      shelter: { name: "Sonprayag Rest House", distanceKm: 0.3, walkMin: 5 },
    },
    "rudraprayag",
  ),
  mkArea(
    {
      id: "guptkashi",
      name: "Guptkashi",
      score: 62,
      x: 45,
      y: 44,
      elevation: 1470,
      population: 4600,
      leadTimeMin: 85,
      dominantDriver: "Rainfall 26 mm/hr",
      soilSaturation: 79,
      rainfall1h: 26,
      rainfall4h: 77,
      damStatus: "No active release",
      channels: ["Push", "SMS"],
      actionNote: "Prepare to move. Keep documents and medicines ready; avoid the river path.",
      rainTrend: [4, 8, 13, 19, 23, 26],
      soilTrend: [58, 63, 69, 74, 77, 79],
      drivers: [
        {
          label: "Rainfall (4 hr)",
          value: "77 mm",
          impact: 0.74,
          domain: "rain",
          hint: "Accumulated rain over the past four hours.",
        },
        {
          label: "Soil saturation",
          value: "79%",
          impact: 0.57,
          domain: "soil",
          hint: "How full the ground already is.",
        },
        {
          label: "Upstream propagation",
          value: "Sonprayag +84",
          impact: 0.46,
          domain: "model",
          hint: "Risk arriving from an area higher up the same river.",
        },
        {
          label: "Terrace elevation",
          value: "+22 m",
          impact: -0.35,
          domain: "model",
          hint: "The settlement sits on a raised terrace above the channel.",
        },
      ],
      upstream: ["sonprayag"],
      downstream: ["agastyamuni"],
      shelter: { name: "Guptkashi Higher Sec. School", distanceKm: 0.7, walkMin: 10 },
    },
    "rudraprayag",
  ),
  mkArea(
    {
      id: "agastyamuni",
      name: "Agastyamuni",
      score: 47,
      x: 64,
      y: 60,
      elevation: 1010,
      population: 7300,
      leadTimeMin: 130,
      dominantDriver: "Soil saturation 71%",
      soilSaturation: 71,
      rainfall1h: 16,
      rainfall4h: 52,
      damStatus: "No active release",
      channels: ["Push"],
      actionNote: "Stay alert and keep children away from the riverbank playground.",
      rainTrend: [2, 5, 9, 12, 15, 16],
      soilTrend: [52, 57, 62, 66, 69, 71],
      drivers: [
        {
          label: "Soil saturation",
          value: "71%",
          impact: 0.55,
          domain: "soil",
          hint: "How full the ground already is.",
        },
        {
          label: "Rainfall (4 hr)",
          value: "52 mm",
          impact: 0.48,
          domain: "rain",
          hint: "Accumulated rain over the past four hours.",
        },
        {
          label: "Floodplain width",
          value: "Wide",
          impact: -0.39,
          domain: "model",
          hint: "A wide floodplain spreads water out and lowers peak depth.",
        },
      ],
      upstream: ["guptkashi"],
      downstream: ["tilwara"],
      shelter: { name: "Agastyamuni Degree College", distanceKm: 1.1, walkMin: 15 },
    },
    "rudraprayag",
  ),
  mkArea(
    {
      id: "tilwara",
      name: "Tilwara",
      score: 22,
      x: 82,
      y: 76,
      elevation: 780,
      population: 3900,
      leadTimeMin: 210,
      dominantDriver: "Baseline susceptibility",
      soilSaturation: 44,
      rainfall1h: 5,
      rainfall4h: 17,
      damStatus: "No active release",
      channels: ["Push"],
      actionNote: "No action needed. Normal monitoring.",
      rainTrend: [1, 1, 2, 3, 4, 5],
      soilTrend: [34, 36, 39, 41, 43, 44],
      drivers: [
        {
          label: "Rainfall (4 hr)",
          value: "17 mm",
          impact: 0.24,
          domain: "rain",
          hint: "Accumulated rain over the past four hours.",
        },
        {
          label: "Soil saturation",
          value: "44%",
          impact: 0.19,
          domain: "soil",
          hint: "How full the ground already is.",
        },
        {
          label: "Bank protection",
          value: "Concrete",
          impact: -0.41,
          domain: "model",
          hint: "Engineered banks resist erosion and overtopping.",
        },
      ],
      upstream: ["agastyamuni"],
      downstream: [],
      shelter: { name: "Tilwara Panchayat Bhawan", distanceKm: 0.5, walkMin: 7 },
    },
    "rudraprayag",
  ),

  // ---------------- Kullu ----------------
  mkArea(
    {
      id: "manali-old",
      name: "Old Manali",
      score: 88,
      x: 24,
      y: 28,
      elevation: 2050,
      population: 6100,
      leadTimeMin: 45,
      dominantDriver: "Nallah surge + saturation 92%",
      soilSaturation: 92,
      rainfall1h: 36,
      rainfall4h: 108,
      damStatus: "Manali embankment — overtopping risk",
      channels: ["Push", "SMS", "IVR voice"],
      actionNote:
        "Leave riverside guesthouses and campsites now. The left-bank footbridge is closed.",
      rainTrend: [7, 12, 20, 28, 33, 36],
      soilTrend: [70, 76, 82, 87, 90, 92],
      drivers: [
        {
          label: "Rainfall (4 hr)",
          value: "108 mm",
          impact: 0.92,
          domain: "rain",
          hint: "Accumulated rain over the past four hours.",
        },
        {
          label: "Soil saturation",
          value: "92%",
          impact: 0.84,
          domain: "soil",
          hint: "How full the ground already is.",
        },
        {
          label: "Tributary nallah inflow",
          value: "Surging",
          impact: 0.67,
          domain: "rain",
          hint: "Small side streams filling fast can flood before the main river does.",
        },
        {
          label: "Bank setback",
          value: "12 m",
          impact: 0.29,
          domain: "model",
          hint: "Buildings very close to the channel are exposed sooner.",
        },
      ],
      upstream: [],
      downstream: ["kullu-town"],
      shelter: { name: "Manali Municipal Hall", distanceKm: 0.8, walkMin: 11 },
    },
    "kullu",
  ),
  mkArea(
    {
      id: "kullu-town",
      name: "Kullu Town Ghat",
      score: 69,
      x: 44,
      y: 45,
      elevation: 1230,
      population: 18400,
      leadTimeMin: 95,
      dominantDriver: "Larji release + upstream surge",
      soilSaturation: 81,
      rainfall1h: 24,
      rainfall4h: 71,
      damStatus: "Larji dam — controlled release 1,900 cumecs",
      channels: ["Push", "SMS"],
      actionNote: "Prepare to move. Ghat steps and the vegetable market are the first to flood.",
      rainTrend: [4, 8, 14, 19, 22, 24],
      soilTrend: [61, 67, 73, 77, 80, 81],
      drivers: [
        {
          label: "Dam release",
          value: "1,900 cumecs",
          impact: 0.79,
          domain: "rain",
          hint: "Volume of water being let out of the upstream dam every second.",
        },
        {
          label: "Upstream propagation",
          value: "Old Manali +88",
          impact: 0.63,
          domain: "model",
          hint: "Risk arriving from an area higher up the same river.",
        },
        {
          label: "Soil saturation",
          value: "81%",
          impact: 0.55,
          domain: "soil",
          hint: "How full the ground already is.",
        },
        {
          label: "Ghat wall height",
          value: "4.2 m",
          impact: -0.33,
          domain: "model",
          hint: "Raised embankment walls hold back moderate rises.",
        },
      ],
      upstream: ["manali-old"],
      downstream: ["bhuntar"],
      shelter: { name: "Kullu Dhalpur Stadium Hall", distanceKm: 1.4, walkMin: 18 },
    },
    "kullu",
  ),
  mkArea(
    {
      id: "bhuntar",
      name: "Bhuntar Confluence",
      score: 58,
      x: 63,
      y: 61,
      elevation: 1090,
      population: 9800,
      leadTimeMin: 120,
      dominantDriver: "Confluence backwater",
      soilSaturation: 76,
      rainfall1h: 18,
      rainfall4h: 55,
      damStatus: "Parbati HEP-II — normal",
      channels: ["Push"],
      actionNote: "Stay alert. Airport approach road may be waterlogged at the low point.",
      rainTrend: [3, 6, 10, 14, 17, 18],
      soilTrend: [58, 63, 68, 72, 75, 76],
      drivers: [
        {
          label: "Confluence backwater",
          value: "Rising",
          impact: 0.68,
          domain: "model",
          hint: "Where two rivers meet, one can hold the other back and raise levels.",
        },
        {
          label: "Rainfall (4 hr)",
          value: "55 mm",
          impact: 0.5,
          domain: "rain",
          hint: "Accumulated rain over the past four hours.",
        },
        {
          label: "Soil saturation",
          value: "76%",
          impact: 0.44,
          domain: "soil",
          hint: "How full the ground already is.",
        },
        {
          label: "Channel gradient",
          value: "Gentle",
          impact: -0.22,
          domain: "model",
          hint: "Flatter channels slow the flood wave down.",
        },
      ],
      upstream: ["kullu-town"],
      downstream: ["banjar"],
      shelter: { name: "Bhuntar Airport Terminal Hall", distanceKm: 1.0, walkMin: 13 },
    },
    "kullu",
  ),
  mkArea(
    {
      id: "banjar",
      name: "Banjar",
      score: 31,
      x: 81,
      y: 75,
      elevation: 1520,
      population: 2700,
      leadTimeMin: 165,
      dominantDriver: "Baseline susceptibility",
      soilSaturation: 55,
      rainfall1h: 9,
      rainfall4h: 27,
      damStatus: "No active release",
      channels: ["Push"],
      actionNote: "No action needed. Normal monitoring.",
      rainTrend: [2, 3, 5, 7, 8, 9],
      soilTrend: [41, 44, 48, 51, 53, 55],
      drivers: [
        {
          label: "Rainfall (4 hr)",
          value: "27 mm",
          impact: 0.33,
          domain: "rain",
          hint: "Accumulated rain over the past four hours.",
        },
        {
          label: "Soil saturation",
          value: "55%",
          impact: 0.26,
          domain: "soil",
          hint: "How full the ground already is.",
        },
        {
          label: "Forest cover",
          value: "Dense",
          impact: -0.37,
          domain: "soil",
          hint: "Tree cover slows runoff and holds soil in place.",
        },
      ],
      upstream: ["bhuntar"],
      downstream: [],
      shelter: { name: "Banjar Govt. School", distanceKm: 0.6, walkMin: 8 },
    },
    "kullu",
  ),

  // ---------------- Mandi ----------------
  mkArea(
    {
      id: "pandoh",
      name: "Pandoh Downstream",
      score: 81,
      x: 26,
      y: 30,
      elevation: 890,
      population: 4300,
      leadTimeMin: 50,
      dominantDriver: "Dam release 2,400 cumecs",
      soilSaturation: 87,
      rainfall1h: 31,
      rainfall4h: 96,
      damStatus: "Pandoh dam — emergency release, 5 gates",
      channels: ["Push", "SMS", "IVR voice"],
      actionNote:
        "Move away from the riverbank immediately. Release volume is rising every fifteen minutes.",
      rainTrend: [6, 11, 18, 25, 29, 31],
      soilTrend: [67, 73, 79, 84, 86, 87],
      drivers: [
        {
          label: "Dam release",
          value: "2,400 cumecs",
          impact: 0.95,
          domain: "rain",
          hint: "Volume of water being let out of the upstream dam every second.",
        },
        {
          label: "Soil saturation",
          value: "87%",
          impact: 0.7,
          domain: "soil",
          hint: "How full the ground already is.",
        },
        {
          label: "Rainfall (4 hr)",
          value: "96 mm",
          impact: 0.68,
          domain: "rain",
          hint: "Accumulated rain over the past four hours.",
        },
        {
          label: "Warning siren coverage",
          value: "Full",
          impact: -0.24,
          domain: "model",
          hint: "Siren coverage improves evacuation odds but does not lower water levels.",
        },
      ],
      upstream: [],
      downstream: ["mandi-town"],
      shelter: { name: "Pandoh Colony Community Centre", distanceKm: 0.5, walkMin: 7 },
    },
    "mandi",
  ),
  mkArea(
    {
      id: "mandi-town",
      name: "Mandi Town Floodplain",
      score: 73,
      x: 45,
      y: 47,
      elevation: 760,
      population: 26500,
      leadTimeMin: 80,
      dominantDriver: "Upstream release inbound",
      soilSaturation: 84,
      rainfall1h: 27,
      rainfall4h: 82,
      damStatus: "Pandoh release tracking downstream",
      channels: ["Push", "SMS", "IVR voice"],
      actionNote: "Prepare to move now. Riverside wards and the Suketi khad edge flood first.",
      rainTrend: [5, 10, 16, 22, 25, 27],
      soilTrend: [64, 70, 76, 80, 83, 84],
      drivers: [
        {
          label: "Upstream propagation",
          value: "Pandoh +81",
          impact: 0.85,
          domain: "model",
          hint: "Risk arriving from an area higher up the same river.",
        },
        {
          label: "Soil saturation",
          value: "84%",
          impact: 0.62,
          domain: "soil",
          hint: "How full the ground already is.",
        },
        {
          label: "Rainfall (4 hr)",
          value: "82 mm",
          impact: 0.59,
          domain: "rain",
          hint: "Accumulated rain over the past four hours.",
        },
        {
          label: "Settlement density",
          value: "Very high",
          impact: 0.41,
          domain: "model",
          hint: "More people and buildings on the floodplain means higher consequence.",
        },
      ],
      upstream: ["pandoh"],
      downstream: ["sundernagar"],
      shelter: { name: "Mandi Paddal Ground Shelter", distanceKm: 1.3, walkMin: 17 },
    },
    "mandi",
  ),
  mkArea(
    {
      id: "sundernagar",
      name: "Sundernagar",
      score: 41,
      x: 64,
      y: 62,
      elevation: 880,
      population: 14200,
      leadTimeMin: 150,
      dominantDriver: "Rainfall 14 mm/hr",
      soilSaturation: 68,
      rainfall1h: 14,
      rainfall4h: 44,
      damStatus: "BBMB diversion — normal",
      channels: ["Push"],
      actionNote: "Stay alert. Low-lying colony roads may pond briefly.",
      rainTrend: [2, 5, 8, 11, 13, 14],
      soilTrend: [50, 55, 60, 64, 66, 68],
      drivers: [
        {
          label: "Rainfall (4 hr)",
          value: "44 mm",
          impact: 0.47,
          domain: "rain",
          hint: "Accumulated rain over the past four hours.",
        },
        {
          label: "Soil saturation",
          value: "68%",
          impact: 0.4,
          domain: "soil",
          hint: "How full the ground already is.",
        },
        {
          label: "Storm drain capacity",
          value: "Upgraded",
          impact: -0.36,
          domain: "model",
          hint: "Recently enlarged drains clear runoff faster.",
        },
      ],
      upstream: ["mandi-town"],
      downstream: ["jogindernagar"],
      shelter: { name: "Sundernagar Indoor Stadium", distanceKm: 0.9, walkMin: 12 },
    },
    "mandi",
  ),
  mkArea(
    {
      id: "jogindernagar",
      name: "Jogindernagar",
      score: 26,
      x: 82,
      y: 77,
      elevation: 1220,
      population: 8100,
      leadTimeMin: 195,
      dominantDriver: "Baseline susceptibility",
      soilSaturation: 49,
      rainfall1h: 7,
      rainfall4h: 21,
      damStatus: "Uhl-III — normal",
      channels: ["Push"],
      actionNote: "No action needed. Normal monitoring.",
      rainTrend: [1, 2, 3, 5, 6, 7],
      soilTrend: [37, 40, 43, 46, 48, 49],
      drivers: [
        {
          label: "Rainfall (4 hr)",
          value: "21 mm",
          impact: 0.28,
          domain: "rain",
          hint: "Accumulated rain over the past four hours.",
        },
        {
          label: "Soil saturation",
          value: "49%",
          impact: 0.21,
          domain: "soil",
          hint: "How full the ground already is.",
        },
        {
          label: "Elevation above channel",
          value: "+64 m",
          impact: -0.48,
          domain: "model",
          hint: "Height above the river is the strongest protection there is.",
        },
      ],
      upstream: ["sundernagar"],
      downstream: [],
      shelter: { name: "Jogindernagar Town Hall", distanceKm: 0.7, walkMin: 9 },
    },
    "mandi",
  ),
];

export const areasByDistrict = (districtId: string) =>
  areas.filter((a) => a.districtId === districtId);

export const areaById = (id: string) => areas.find((a) => a.id === id);
export const districtById = (id: string) => districts.find((d) => d.id === id);

export const rankedAreas = [...areas].sort((a, b) => b.score - a.score);

export const systemStats = {
  districtsMonitored: districts.length,
  areasMonitored: areas.length,
  actNow: areas.filter((a) => tierFor(a.score) === "severe").length,
  watch: areas.filter((a) => tierFor(a.score) === "watch").length,
  modelConfidence: 87,
  lastRefresh: "2 min ago",
  modelVersion: "hydro-net v4.2.1",
};

export type WeatherNow = {
  tempC: number;
  rainRate: number;
  windKph: number;
  humidity: number;
  forecast: { hour: string; mm: number; kind: "heavy" | "rain" | "cloud" }[];
};

export const weatherFor = (a: Area): WeatherNow => ({
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
});

export const horizonsFor = (a: Area) => [
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

export type CommunityReport = {
  id: string;
  areaId: string;
  location: string;
  severity: "Normal" | "Rising" | "Flooding";
  note: string;
  minutesAgo: number;
  verified: boolean;
  reporter: string;
  coords: string;
  accuracy: number;
};

export const communityReports: CommunityReport[] = [
  {
    id: "r1",
    areaId: "raini",
    location: "Raini Village — lower bazaar",
    severity: "Flooding",
    note: "Water over the road near the tea stall, moving fast and brown.",
    minutesAgo: 4,
    verified: true,
    reporter: "Field worker · SDRF",
    coords: "30.4468° N, 79.6702° E",
    accuracy: 8,
  },
  {
    id: "r2",
    areaId: "manali-old",
    location: "Old Manali — left bank footbridge",
    severity: "Rising",
    note: "Level up roughly a metre since morning. Bridge deck still dry.",
    minutesAgo: 11,
    verified: true,
    reporter: "Resident",
    coords: "32.2611° N, 77.1836° E",
    accuracy: 12,
  },
  {
    id: "r3",
    areaId: "pandoh",
    location: "Pandoh Downstream — colony ghat",
    severity: "Flooding",
    note: "Sirens sounded. Bank path already under water.",
    minutesAgo: 18,
    verified: false,
    reporter: "Resident",
    coords: "31.6702° N, 77.0621° E",
    accuracy: 21,
  },
  {
    id: "r4",
    areaId: "guptkashi",
    location: "Guptkashi — nallah crossing",
    severity: "Rising",
    note: "Culvert half full, debris collecting at the mouth.",
    minutesAgo: 27,
    verified: true,
    reporter: "Panchayat volunteer",
    coords: "30.5312° N, 79.0546° E",
    accuracy: 15,
  },
  {
    id: "r5",
    areaId: "bhuntar",
    location: "Bhuntar — airport approach low point",
    severity: "Normal",
    note: "Some ponding but traffic moving normally.",
    minutesAgo: 44,
    verified: false,
    reporter: "Resident",
    coords: "31.8760° N, 77.1544° E",
    accuracy: 30,
  },
  {
    id: "r6",
    areaId: "sonprayag",
    location: "Sonprayag — causeway parking",
    severity: "Flooding",
    note: "Parking lot edge washed out, vehicles being moved uphill.",
    minutesAgo: 52,
    verified: true,
    reporter: "Police post",
    coords: "30.6337° N, 78.9986° E",
    accuracy: 6,
  },
];

export type BroadcastLog = {
  id: string;
  tier: Tier;
  areas: string;
  message: string;
  channels: string[];
  reach: number;
  minutesAgo: number;
  officer: string;
};

export const broadcastLog: BroadcastLog[] = [
  {
    id: "b1",
    tier: "severe",
    areas: "Raini Village, Tapovan",
    message: "Move to higher ground immediately. Riverside lanes will be reached within the hour.",
    channels: ["Push", "SMS", "IVR"],
    reach: 4580,
    minutesAgo: 6,
    officer: "A. Rawat · District Officer",
  },
  {
    id: "b2",
    tier: "severe",
    areas: "Pandoh Downstream",
    message: "Emergency dam release under way. Clear the riverbank now.",
    channels: ["Push", "SMS", "IVR"],
    reach: 4300,
    minutesAgo: 22,
    officer: "S. Thakur · NDRF Admin",
  },
  {
    id: "b3",
    tier: "watch",
    areas: "Guptkashi, Agastyamuni",
    message: "Heavy rain continuing. Keep documents ready and avoid the river path.",
    channels: ["Push", "SMS"],
    reach: 11900,
    minutesAgo: 71,
    officer: "P. Negi · District Officer",
  },
  {
    id: "b4",
    tier: "watch",
    areas: "Kullu Town Ghat",
    message: "Larji controlled release in progress. Ghat steps closed to public.",
    channels: ["Push"],
    reach: 18400,
    minutesAgo: 128,
    officer: "R. Sharma · District Officer",
  },
];

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

export const historyEvents: HistoricEvent[] = [
  {
    id: "h1",
    title: "Rishiganga debris flood",
    districtId: "chamoli",
    date: "2026-08-14",
    peakScore: 96,
    rainfallTotal: 214,
    duration: "9 hr",
    outcome:
      "Two riverside hamlets evacuated ahead of the wave. No casualties; 34 structures damaged.",
    timeline: [
      { t: "04:10", text: "Nowcast crosses Watch threshold on upstream gauge." },
      { t: "05:02", text: "Act Now issued for Raini and Tapovan — push, SMS and IVR." },
      { t: "05:48", text: "Evacuation of 620 residents completed." },
      { t: "06:35", text: "Peak flow passes Tapovan. Bank road washed out." },
      { t: "13:20", text: "Levels recede below Watch. Alert stood down." },
    ],
  },
  {
    id: "h2",
    title: "Mandakini cloudburst",
    districtId: "rudraprayag",
    date: "2026-07-29",
    peakScore: 89,
    rainfallTotal: 187,
    duration: "6 hr",
    outcome: "Yatra route suspended for 31 hours. Causeway parking lost; no injuries reported.",
    timeline: [
      { t: "15:40", text: "Cloudburst detected over Chorabari catchment." },
      { t: "16:05", text: "Act Now issued for Sonprayag." },
      { t: "16:50", text: "Pilgrim movement halted above Sonprayag." },
      { t: "18:30", text: "Peak level recorded, 3.4 m above normal." },
      { t: "21:15", text: "Alert downgraded to Watch." },
    ],
  },
  {
    id: "h3",
    title: "Beas mid-reach surge",
    districtId: "kullu",
    date: "2026-07-11",
    peakScore: 82,
    rainfallTotal: 156,
    duration: "11 hr",
    outcome: "Riverside guesthouses cleared. Larji release staged over 4 hours to reduce peak.",
    timeline: [
      { t: "02:20", text: "Watch issued for Old Manali on rising nallah inflow." },
      { t: "04:00", text: "Larji release staged after coordination call." },
      { t: "06:45", text: "Act Now issued for Old Manali riverside strip." },
      { t: "12:10", text: "Peak passes Kullu Town Ghat below wall height." },
      { t: "13:30", text: "Stand-down." },
    ],
  },
  {
    id: "h4",
    title: "Pandoh emergency release",
    districtId: "mandi",
    date: "2026-06-27",
    peakScore: 78,
    rainfallTotal: 132,
    duration: "8 hr",
    outcome: "Floodplain wards evacuated with 74 minutes of lead time. Market losses moderate.",
    timeline: [
      { t: "09:15", text: "Dam operator signals emergency release." },
      { t: "09:31", text: "Act Now issued for Pandoh Downstream and Mandi Town." },
      { t: "10:45", text: "Evacuation of floodplain wards completed." },
      { t: "14:20", text: "Release tapered. Levels falling." },
      { t: "17:05", text: "Stand-down." },
    ],
  },
  {
    id: "h5",
    title: "Alaknanda monsoon peak",
    districtId: "chamoli",
    date: "2026-06-09",
    peakScore: 64,
    rainfallTotal: 98,
    duration: "5 hr",
    outcome: "Watch only. Local drainage coped; no evacuation required.",
    timeline: [
      { t: "18:40", text: "Watch issued for Joshimath Lower." },
      { t: "20:10", text: "Peak below action threshold." },
      { t: "23:00", text: "Stand-down." },
    ],
  },
];

export const featureImportance = [
  { name: "Rainfall intensity (1 hr)", weight: 0.24, domain: "rain" as const },
  { name: "Soil saturation", weight: 0.21, domain: "soil" as const },
  { name: "Upstream release volume", weight: 0.17, domain: "rain" as const },
  { name: "Antecedent rainfall (72 hr)", weight: 0.12, domain: "rain" as const },
  { name: "Slope & flow accumulation", weight: 0.11, domain: "model" as const },
  { name: "Channel geometry", weight: 0.08, domain: "model" as const },
  { name: "Land cover", weight: 0.07, domain: "soil" as const },
];

export const languages = ["English", "हिन्दी", "ગુજરાતી", "मराठी"];

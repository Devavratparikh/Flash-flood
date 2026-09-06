// Single source of truth for UI colors. Previously each component (App.jsx,
// ZonePanel.jsx, AlertsFeed.jsx) defined its own local `C` constant with
// slightly-drifting values — this file replaces all of those.

export const C = {
  bg: "#0B0F14",
  panel: "#121820",
  panelAlt: "#161E27",
  border: "#232C36",
  text: "#E8ECEF",
  textMuted: "#7C8994",
  textDim: "#B7C1C9",
  accent: "#3B82F6",
};
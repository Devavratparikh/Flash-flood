# himvaah — flash flood risk (frontend)

Micro-watershed flash flood risk dashboard for hilly districts in India — built for SIH 2026.
Pilot districts: Chamoli, Rudraprayag (Uttarakhand), Kullu, Mandi (Himachal Pradesh).

This repo currently contains **frontend only**, with hardcoded mock data standing in for
the real backend/ML pipeline. See "Roadmap" below for what's next.

## Getting started

Requires [Node.js](https://nodejs.org) 18+ and npm.

```bash
npm install
npm run dev
```

This starts a local dev server (usually at `http://localhost:5173`) with hot-reload —
edit any file in `src/` and the browser updates instantly.

To build a production bundle:

```bash
npm run build   # outputs to dist/
npm run preview # serve the production build locally to sanity-check it
```

## Project structure

```
src/
├── main.jsx              entry point
├── App.jsx                layout + state (selected district/zone)
├── data/districts.js      mock district & zone data (swap for API later)
├── utils/terrain.js       heightmap math + Three.js scene-building helpers
├── components/
│   ├── TerrainCanvas.jsx  the 3D terrain scene (Three.js + OrbitControls)
│   ├── ZonePanel.jsx      risk score + explainability panel
│   ├── Sparkline.jsx      rainfall trend mini-chart
│   └── AlertsFeed.jsx     ranked list of active alerts
└── styles/index.css       fonts, layout, responsive rules
```

## Roadmap (what's not built yet, on purpose)

- **Backend** (Node.js + Express, PostgreSQL/PostGIS) — will replace `src/data/districts.js`
  with a real `GET /api/districts` call. The data shape is already designed to match.
- **ML service** (Python + FastAPI, isolated microservice) — `soil`, `dam`, `rain`, `score`
  fields will come from a real prediction pipeline instead of being hardcoded.
- **Real terrain data** — `utils/terrain.js`'s `heightAt()` is procedural (sine-wave based).
  Swap for real elevation data (SRTM/Bhuvan DEM) sampled onto the same mesh grid.
- **Real satellite imagery** — `makeDetailTexture()` currently generates a synthetic
  mottled texture. Mapbox GL JS's `raster-dem` + `satellite-v9` style supports draping real
  satellite imagery over real 3D terrain — this is the intended real-world replacement.
- **Offline/SMS alert fallback**, **community ground-truth reporting** — not yet represented
  in the UI at all; planned as additional screens.

## Tech notes

- **Vite** for dev/build tooling (fast HMR, minimal config).
- **Three.js + OrbitControls** for the 3D terrain — see `components/TerrainCanvas.jsx`.
- **Recharts** for the rainfall sparkline.
- **lucide-react** for icons.
- Plain CSS (`styles/index.css`) rather than a utility framework, to keep the build simple
  and avoid tooling surprises — see the "gotcha" note below if you add Tailwind later.

> **Gotcha to remember:** if you add Tailwind CSS to this project, arbitrary bracket values
> like `bg-[#121820]` require Tailwind's CLI/PostCSS build step to generate the actual CSS.
> That's set up automatically by `npm install tailwindcss` + its config — just don't assume
> it "just works" without checking the build output if styles seem to silently not apply.

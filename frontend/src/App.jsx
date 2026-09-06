import React, { useMemo, useState } from "react";
import { Waves, MapPin, Move3d } from "lucide-react";
import TerrainCanvas from "./components/TerrainCanvas.jsx";
import ZonePanel from "./components/ZonePanel.jsx";
import AlertsFeed from "./components/AlertsFeed.jsx";
import { DISTRICTS, TIER, tierFor } from "./data/districts.js";
import { C } from "./theme.js";

export default function App() {
  const [districtId, setDistrictId] = useState("chamoli");
  const district = DISTRICTS.find((d) => d.id === districtId);
  const [selected, setSelected] = useState(district.zones[0]);

  const handleDistrict = (id) => {
    if (id === districtId) return;
    setDistrictId(id);
    const d = DISTRICTS.find((x) => x.id === id);
    setSelected(d.zones[0]);
  };

  const allAlerts = useMemo(() => {
    const out = [];
    DISTRICTS.forEach((d) =>
      d.zones.forEach((z) => {
        const t = tierFor(z.score);
        if (t !== "safe") out.push({ ...z, district: d.name, tier: t });
      })
    );
    return out.sort((a, b) => b.score - a.score);
  }, []);

  return (
    <div className="ff-root">
      <div className="ff-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Waves size={22} color={C.accent} />
          <span className="disp" style={{ fontSize: 18 }}>himvaah</span>
          <span style={{ color: C.textMuted, fontSize: 14, marginLeft: 4 }}>micro-watershed flood risk</span>
        </div>
        <div style={{ color: C.textMuted, fontSize: 14 }}>Pilot belt · Uttarakhand &amp; Himachal Pradesh</div>
      </div>

      <div className="ff-tabs">
        {DISTRICTS.map((d) => (
          <button key={d.id} onClick={() => handleDistrict(d.id)} className={`ff-tab${d.id === districtId ? " active" : ""}`}>
            {d.name}
          </button>
        ))}
      </div>

      <div className="ff-note">
        <p style={{ color: C.textMuted, fontSize: 14, maxWidth: 640, margin: 0 }}>{district.note}</p>
      </div>

      <div className="ff-layout">
        <div className="ff-panel">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textMuted, fontSize: 14 }}>
              <MapPin size={15} />
              <span>Terrain view — click a marker for detail</span>
            </div>
            <div className="ff-legend">
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Move3d size={13} /> drag to rotate · scroll to zoom</span>
              {Object.entries(TIER).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 999, background: v.color }} />
                  {v.label}
                </div>
              ))}
            </div>
          </div>
          <TerrainCanvas district={district} selected={selected} onSelect={setSelected} />
        </div>

        <ZonePanel district={district} selected={selected} />
      </div>

      <AlertsFeed alerts={allAlerts} />
    </div>
  );
}
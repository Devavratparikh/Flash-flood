import React from "react";
import { AlertTriangle, Droplets, Waves, TrendingUp } from "lucide-react";
import Sparkline from "./Sparkline.jsx";
import { TIER, tierFor } from "../data/districts.js";

const C = {
  border: "#2B3540",
  textMuted: "#8FA0AC",
  textDim: "#C7D0D6",
};

export default function ZonePanel({ district, selected }) {
  const tier = tierFor(selected.score);

  return (
    <div className="ff-panel" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 4 }}>{district.name} district</div>
        <div className="disp" style={{ fontSize: 18 }}>{selected.name}</div>
      </div>

      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderRadius: 3,
          background: TIER[tier].glow, border: `1px solid ${TIER[tier].color}55`,
        }}
      >
        <div>
          <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 2 }}>Risk score</div>
          <div className="disp tabular" style={{ fontSize: 30, color: TIER[tier].color }}>{selected.score}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 3, background: TIER[tier].color }}>
          {tier === "act" && <AlertTriangle size={14} color="#12181C" />}
          <span style={{ fontSize: 12, fontWeight: 500, color: "#12181C" }}>{TIER[tier].label}</span>
        </div>
      </div>

      <div>
        <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 8 }}>Driven by</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, color: C.textDim }}><Droplets size={14} /> Soil saturation (3-day)</span>
            <span className="tabular">{selected.soil}%</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, color: C.textDim }}><Waves size={14} /> Dam / reservoir status</span>
            <span>{selected.dam}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 4 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, color: C.textDim }}><TrendingUp size={14} /> Rainfall (last 1hr)</span>
            <span className="tabular">{selected.rain} mm</span>
          </div>
        </div>
      </div>

      <div>
        <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 4 }}>6-hour rainfall trend</div>
        <Sparkline data={selected.trend} color={TIER[tier].color} />
      </div>

      <div style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.6, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
        {tier === "act" && "Act-now tier: short lead time. Alert routes to residents via push + SMS fallback, and to district disaster management."}
        {tier === "watch" && "Watch tier: conditions building. Alert routes to district disaster management; residents notified to stay alert."}
        {tier === "safe" && "Normal tier: no active drivers above threshold. Monitoring continues."}
      </div>
    </div>
  );
}

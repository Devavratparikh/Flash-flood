import React from "react";
import { Radio } from "lucide-react";
import { TIER } from "../data/districts.js";

const C = { border: "#2B3540", textMuted: "#8FA0AC" };

export default function AlertsFeed({ alerts }) {
  return (
    <div className="ff-alerts-wrap">
      <div className="ff-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textMuted, fontSize: 14, marginBottom: 12 }}>
          <Radio size={15} />
          <span>Active alerts — all districts, ranked by risk</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {alerts.map((a) => (
            <div
              key={a.district + a.id}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span className={a.tier === "act" ? "pulse" : ""} style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: TIER[a.tier].color }} />
                <span>{a.name}</span>
                <span style={{ color: C.textMuted, fontSize: 12 }}>{a.district}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 12, color: TIER[a.tier].color }}>{TIER[a.tier].label}</span>
                <span className="tabular" style={{ fontSize: 14, width: 32, textAlign: "right" }}>{a.score}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

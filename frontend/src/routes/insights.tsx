import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Layers, Satellite } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Panel, SectionTitle } from "@/components/app/primitives";
import { areas, districtById, featureImportance, systemStats, tierFor } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Model Insights | FlashWatch Officer Console" },
      {
        name: "description",
        content:
          "Model confidence, region-wide feature importance, SAR flood-extent validation and the watershed propagation graph.",
      },
      { property: "og:title", content: "Model Insights | FlashWatch Officer Console" },
      {
        property: "og:description",
        content: "Model confidence, feature importance and watershed risk propagation.",
      },
    ],
  }),
  component: ModelInsights,
});

const domainVar = { rain: "var(--rain)", soil: "var(--soil)", model: "var(--model)" } as const;

function ConfidenceGauge({ value }: { value: number }) {
  const r = 54;
  const c = Math.PI * r;
  return (
    <div className="relative w-full max-w-[220px]">
      <svg viewBox="0 0 140 78" className="w-full">
        <path
          d="M 16 70 A 54 54 0 0 1 124 70"
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 16 70 A 54 54 0 0 1 124 70"
          fill="none"
          stroke="var(--model)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="num text-4xl font-bold text-model">{value}%</p>
        <p className="text-[11px] text-muted-foreground">model confidence</p>
      </div>
    </div>
  );
}

function WatershedGraph() {
  const nodes = areas.map((a, i) => ({
    ...a,
    gx: 12 + (i % 4) * 26,
    gy: 14 + Math.floor(i / 4) * 24,
  }));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges = nodes.flatMap((n) =>
    n.downstream.filter((d) => byId[d]).map((d) => ({ from: n, to: byId[d]! })),
  );
  return (
    <svg viewBox="0 0 100 100" className="h-[300px] w-full">
      {edges.map((e, i) => {
        const hot = e.to.score >= 75 || e.from.score >= 75;
        return (
          <line
            key={i}
            x1={e.from.gx}
            y1={e.from.gy}
            x2={e.to.gx}
            y2={e.to.gy}
            stroke={hot ? "var(--severe)" : "var(--rain)"}
            strokeOpacity={hot ? 0.7 : 0.25}
            strokeWidth={hot ? 0.8 : 0.4}
            strokeDasharray={hot ? "3 2" : undefined}
            className={hot ? "animate-ticker" : undefined}
          />
        );
      })}
      {nodes.map((n) => {
        const t = tierFor(n.score);
        const color =
          t === "severe" ? "var(--severe)" : t === "watch" ? "var(--watch)" : "var(--normal)";
        return (
          <g key={n.id}>
            <circle cx={n.gx} cy={n.gy} r={n.score / 22} fill={color} fillOpacity={0.18} />
            <circle cx={n.gx} cy={n.gy} r={1.8} fill={color} />
            <text
              x={n.gx}
              y={n.gy + 5}
              textAnchor="middle"
              fontSize="2.4"
              fill="var(--muted-foreground)"
            >
              {n.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ModelInsights() {
  const [after, setAfter] = useState(true);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Officer analytics
          </p>
          <h1 className="display mt-1 text-3xl font-bold">Model insights</h1>
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel className="flex flex-col items-center justify-center p-5">
            <ConfidenceGauge value={systemStats.modelConfidence} />
            <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
              {systemStats.modelVersion} · calibrated against 214 historical events. Confidence
              drops with forecast distance and sparse gauge coverage.
            </p>
          </Panel>

          <Panel className="p-5 lg:col-span-2">
            <SectionTitle
              title="Feature importance"
              hint="Region-wide contribution across all monitored areas"
            />
            <ul className="mt-4 space-y-3">
              {featureImportance.map((f) => (
                <li key={f.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{f.name}</span>
                    <span className="num font-semibold">{Math.round(f.weight * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2">
                    <div
                      className="h-1.5 rounded-full transition-all duration-700"
                      style={{
                        width: `${f.weight * 100 * 3.4}%`,
                        background: domainVar[f.domain],
                        opacity: 0.85,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="p-5">
            <SectionTitle
              title="Satellite flood-extent validation"
              hint="Sentinel-1 SAR backscatter, 14 Aug event"
              right={
                <div className="flex rounded-lg border border-hairline bg-surface-2/60 p-0.5 text-xs">
                  {[
                    { k: false, l: "Before" },
                    { k: true, l: "After" },
                  ].map((o) => (
                    <button
                      key={o.l}
                      onClick={() => setAfter(o.k)}
                      className={cn(
                        "rounded-md px-2.5 py-1",
                        after === o.k ? "bg-surface-2" : "text-muted-foreground",
                      )}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              }
            />
            <div className="relative mt-4 overflow-hidden rounded-xl border border-hairline bg-surface">
              <svg viewBox="0 0 100 60" className="w-full" aria-hidden>
                <rect width="100" height="60" fill="oklch(0.2 0.012 250)" />
                {Array.from({ length: 40 }).map((_, i) => (
                  <line
                    key={i}
                    x1="0"
                    y1={i * 1.5}
                    x2="100"
                    y2={i * 1.5}
                    stroke="oklch(1 0 0 / 0.03)"
                    strokeWidth="0.4"
                  />
                ))}
                <path
                  d="M 2 12 C 24 22, 40 26, 62 36 S 88 50, 99 56"
                  fill="none"
                  stroke="var(--rain)"
                  strokeOpacity="0.6"
                  strokeWidth="1.2"
                />
                <path
                  d="M 2 8 C 26 20, 42 24, 64 34 S 90 48, 99 52 L 99 60 L 2 60 Z"
                  fill="var(--rain)"
                  className="transition-opacity duration-700"
                  opacity={after ? 0.28 : 0}
                />
                <text x="3" y="6" fontSize="3" fill="var(--muted-foreground)">
                  SAR VV · {after ? "post-event extent" : "pre-event baseline"}
                </text>
              </svg>
            </div>
            <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Satellite className="size-3.5" /> Observed extent overlaps 91% of the predicted
              inundation footprint.
            </p>
          </Panel>

          <Panel className="p-5">
            <SectionTitle
              title="Watershed propagation"
              hint="Nodes are areas, edges follow drainage downstream"
            />
            <WatershedGraph />
            <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Layers className="size-3.5" /> Pulsing edges carry risk toward a high-scoring node.
              Largest halo:{" "}
              {
                areas.reduce((m, a) => (a.score > m.score ? a : m)).name
              }{" "}
              ({districtById(areas.reduce((m, a) => (a.score > m.score ? a : m)).districtId)?.name})
            </p>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

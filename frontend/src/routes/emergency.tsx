import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Footprints, Navigation, Phone, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Panel, TierChip } from "@/components/app/primitives";
import { areasByDistrict, districts, tierFor } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/emergency")({
  head: () => ({
    meta: [
      { title: "Emergency Info & Safe Zones | FlashWatch" },
      {
        name: "description",
        content:
          "Helpline numbers, your nearest shelter and a simple checklist for what to do if water starts rising.",
      },
      { property: "og:title", content: "Emergency Info & Safe Zones | FlashWatch" },
      {
        property: "og:description",
        content: "Helplines, nearest safe zone and rising-water safety checklist.",
      },
    ],
  }),
  component: EmergencyInfo,
});

const CHECKLIST = [
  "Move uphill immediately — do not wait to collect belongings.",
  "Never walk or drive through moving water, even ankle-deep.",
  "Stay off bridges and culverts once water is touching the deck.",
  "Take medicines, ID papers and a charged phone if they are within reach.",
  "Tell a neighbour where you are going, especially if you live alone.",
];

function EmergencyInfo() {
  const [districtId, setDistrictId] = useState(districts[0]!.id);
  const district = districts.find((d) => d.id === districtId)!;
  const area = areasByDistrict(districtId).sort((a, b) => b.score - a.score)[0]!;
  const tier = tierFor(area.score);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-5">
        <header>
          <h1 className="display text-3xl font-bold">If water is rising</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything you need on one screen. No login required.
          </p>
        </header>

        <div className="flex flex-wrap gap-1 rounded-xl border border-hairline bg-surface p-1">
          {districts.map((d) => (
            <button
              key={d.id}
              onClick={() => setDistrictId(d.id)}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                d.id === districtId
                  ? "bg-surface-2 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d.name}
            </button>
          ))}
        </div>

        <Panel className="p-5" alert={tier === "severe"}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Highest risk near you</p>
              <p className="display text-xl font-bold">{area.name}</p>
            </div>
            <TierChip tier={tier} />
          </div>
          <p className="mt-3 text-base leading-relaxed">{area.actionNote}</p>
        </Panel>

        <Panel className="p-5">
          <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold">
            <Phone className="size-4 text-primary" /> Helplines — {district.name}
          </p>
          <div className="space-y-2">
            {district.helplines.map((h) => (
              <a
                key={h.number}
                href={`tel:${h.number}`}
                className="flex h-14 items-center justify-between rounded-xl border border-hairline bg-surface-2/60 px-4 text-base"
              >
                <span>{h.label}</span>
                <span className="num font-bold text-primary">{h.number}</span>
              </a>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold">
            <Navigation className="size-4 text-normal" /> Nearest safe zone
          </p>
          <div className="flex items-center gap-4">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-hairline bg-surface">
              <svg viewBox="0 0 100 100" className="size-full" aria-hidden>
                {Array.from({ length: 9 }).map((_, i) => (
                  <g key={i} stroke="oklch(1 0 0 / 0.06)" strokeWidth="0.5">
                    <line x1={(i + 1) * 10} y1="0" x2={(i + 1) * 10} y2="100" />
                    <line x1="0" y1={(i + 1) * 10} x2="100" y2={(i + 1) * 10} />
                  </g>
                ))}
                <path
                  d="M 0 72 C 28 66, 54 60, 100 40"
                  fill="none"
                  stroke="var(--rain)"
                  strokeOpacity="0.5"
                  strokeWidth="2.5"
                />
                <path
                  d="M 28 78 L 48 58 L 68 34"
                  fill="none"
                  stroke="var(--normal)"
                  strokeWidth="1.6"
                  strokeDasharray="4 3"
                />
                <circle cx="28" cy="78" r="3" fill="var(--foreground)" />
                <circle cx="68" cy="34" r="5" fill="var(--normal)" fillOpacity="0.25" />
                <circle cx="68" cy="34" r="2.5" fill="var(--normal)" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold">{area.shelter.name}</p>
              <p className="num mt-1 text-sm text-muted-foreground">
                {area.shelter.distanceKm} km away
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-normal">
                <Footprints className="size-4" /> about {area.shelter.walkMin} min on foot
              </p>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="size-4 text-watch" /> If you see rising water
          </p>
          <ol className="space-y-3">
            {CHECKLIST.map((c, i) => (
              <li key={c} className="flex gap-3 text-base leading-relaxed">
                <span className="num grid size-6 shrink-0 place-items-center rounded-full border border-hairline text-xs text-muted-foreground">
                  {i + 1}
                </span>
                {c}
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </AppShell>
  );
}

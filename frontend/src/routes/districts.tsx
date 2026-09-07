import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Mountain, Waves, Building2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { TerrainMap } from "@/components/app/TerrainMap";
import { AreaPanel } from "@/components/app/AreaPanel";
import { Panel } from "@/components/app/primitives";
import { Loading } from "@/components/app/Loading";
import { useAreas, useDistricts } from "@/lib/queries";
import { rankByScore } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/districts")({
  validateSearch: z.object({ d: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "District Explorer | FlashWatch Early-Warning" },
      {
        name: "description",
        content:
          "Explore terrain, drainage and sub-area flood risk for each monitored hill district on an interactive 3D risk map.",
      },
      { property: "og:title", content: "District Explorer | FlashWatch Early-Warning" },
      {
        property: "og:description",
        content: "Interactive terrain risk console for monitored hill districts.",
      },
    ],
  }),
  component: DistrictExplorer,
});

function DistrictExplorer() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { districts, isLoading: dLoading } = useDistricts();
  const { areas, areaById, isLoading: aLoading } = useAreas();
  const [selected, setSelected] = useState<string | null>(null);

  if (dLoading || aLoading)
    return (
      <AppShell>
        <Loading label="Loading districts…" />
      </AppShell>
    );
  if (!districts.length)
    return (
      <AppShell>
        <Loading label="Backend unavailable" error />
      </AppShell>
    );

  const activeId =
    search.d && districts.some((d) => d.id === search.d) ? search.d : districts[0]!.id;
  const district = districts.find((d) => d.id === activeId)!;
  const list = rankByScore(areas.filter((a) => a.districtId === activeId));
  const selectedArea = selected ? areaById(selected) : undefined;
  const shown = selectedArea && selectedArea.districtId === activeId ? selectedArea : list[0];

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            District explorer
          </p>
          <h1 className="display mt-1 text-3xl font-bold">Terrain risk console</h1>
        </header>

        <div className="flex flex-wrap gap-1 rounded-xl border border-hairline bg-surface p-1">
          {districts.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setSelected(null);
                navigate({ search: { d: d.id } });
              }}
              className={cn(
                "flex-1 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                d.id === activeId
                  ? "bg-surface-2 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d.name}
            </button>
          ))}
        </div>

        <div className="grid gap-3 text-xs sm:grid-cols-3">
          <div className="glass flex items-start gap-2 rounded-lg p-3">
            <Waves className="mt-0.5 size-4 shrink-0 text-rain" />
            <span>
              <span className="block text-muted-foreground">Basin</span>
              {district.basin}
            </span>
          </div>
          <div className="glass flex items-start gap-2 rounded-lg p-3">
            <Mountain className="mt-0.5 size-4 shrink-0 text-soil" />
            <span>
              <span className="block text-muted-foreground">Terrain</span>
              {district.terrain}
            </span>
          </div>
          <div className="glass flex items-start gap-2 rounded-lg p-3">
            <Building2 className="mt-0.5 size-4 shrink-0 text-model" />
            <span>
              <span className="block text-muted-foreground">Upstream infrastructure</span>
              {district.upstreamInfra}
            </span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <TerrainMap areas={list} selectedId={shown?.id} onSelect={setSelected} />
          <Panel className="p-5" alert={shown ? shown.score >= 75 : false}>
            {shown ? <AreaPanel area={shown} /> : null}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

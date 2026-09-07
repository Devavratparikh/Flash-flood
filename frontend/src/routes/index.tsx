import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Droplets, Eye, LifeBuoy, MapPin, Radio } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AlertRow, Panel, RiskScore, SectionTitle, TierChip, Sparkline } from "@/components/app/primitives";
import { useAppState } from "@/lib/app-state";
import {
  areasByDistrict,
  districtById,
  districts,
  rankedAreas,
  systemStats,
  tierFor,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "National Risk Overview | FlashWatch Early-Warning" },
      {
        name: "description",
        content:
          "Live flash flood risk across monitored hill districts: Act Now alerts, Watch areas and ranked at-risk locations.",
      },
      { property: "og:title", content: "National Risk Overview | FlashWatch Early-Warning" },
      {
        property: "og:description",
        content: "Live flash flood risk across monitored hill districts, ranked by risk score.",
      },
    ],
  }),
  component: Home,
});

function StatTile({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  tone?: "severe" | "watch" | "normal";
  icon: typeof Eye;
}) {
  return (
    <Panel className="p-4" alert={tone === "severe"}>
      <div className="flex items-start justify-between">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
        <Icon
          className={cn(
            "size-4",
            tone === "severe"
              ? "text-severe"
              : tone === "watch"
                ? "text-watch"
                : tone === "normal"
                  ? "text-normal"
                  : "text-muted-foreground",
          )}
        />
      </div>
      <p
        className={cn(
          "num mt-2 text-4xl font-bold",
          tone === "severe"
            ? "text-severe"
            : tone === "watch"
              ? "text-watch"
              : tone === "normal"
                ? "text-normal"
                : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </Panel>
  );
}

function ResidentHome() {
  const top = rankedAreas[0]!;
  const tier = tierFor(top.score);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Panel className="p-6 text-center" alert={tier === "severe"}>
        <TierChip tier={tier} className="mx-auto" />
        <p className="display mt-4 text-2xl font-bold">{top.name}</p>
        <p className="text-sm text-muted-foreground">
          {districtById(top.districtId)?.name}, {districtById(top.districtId)?.state}
        </p>
        <div className="mt-4 flex justify-center">
          <RiskScore score={top.score} size="xl" />
        </div>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed">{top.actionNote}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            to="/emergency"
            className="flex h-14 items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground"
          >
            <LifeBuoy className="size-5" /> Safety & helplines
          </Link>
          <Link
            to="/report"
            className="flex h-14 items-center justify-center gap-2 rounded-xl border border-hairline bg-surface-2 text-base font-semibold"
          >
            <MapPin className="size-5" /> Report what you see
          </Link>
        </div>
      </Panel>

      <div>
        <SectionTitle title="Areas near you" hint="Simple status, updated every few minutes" />
        <div className="space-y-2">
          {rankedAreas.slice(0, 6).map((a) => {
            const t = tierFor(a.score);
            return (
              <Link
                key={a.id}
                to="/area/$areaId"
                params={{ areaId: a.id }}
                className="glass flex items-center gap-4 rounded-xl p-4"
              >
                <span
                  className={cn(
                    "size-3 shrink-0 rounded-full transition-colors duration-500",
                    t === "severe" ? "bg-severe" : t === "watch" ? "bg-watch" : "bg-normal",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {districtById(a.districtId)?.name}
                  </p>
                </div>
                <TierChip tier={t} dot={false} />
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Home() {
  const { view } = useAppState();

  return (
    <AppShell>
      {view === "resident" ? (
        <ResidentHome />
      ) : (
        <div className="mx-auto max-w-7xl space-y-8">
          <header className="animate-rise">
            <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
              National / State overview
            </p>
            <h1 className="display mt-1 text-3xl font-bold sm:text-4xl">
              Flash flood risk, right now
            </h1>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Districts monitored"
              value={systemStats.districtsMonitored}
              sub={`${systemStats.areasMonitored} sub-areas under watch`}
              icon={Eye}
            />
            <StatTile
              label="Act Now alerts"
              value={systemStats.actNow}
              sub="Immediate evacuation advised"
              tone="severe"
              icon={AlertTriangle}
            />
            <StatTile
              label="Watch areas"
              value={systemStats.watch}
              sub="Prepare to move, monitor closely"
              tone="watch"
              icon={Droplets}
            />
            <StatTile
              label="Model refresh"
              value={systemStats.lastRefresh}
              sub={`${systemStats.modelVersion} · confidence ${systemStats.modelConfidence}%`}
              tone="normal"
              icon={Radio}
            />
          </div>

          <section>
            <SectionTitle
              title="Districts"
              hint="Highest risk area per district and its dominant driver"
              right={
                <Link
                  to="/districts"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open explorer <ArrowRight className="size-3" />
                </Link>
              }
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {districts.map((d) => {
                const list = areasByDistrict(d.id).sort((a, b) => b.score - a.score);
                const worst = list[0]!;
                const tier = tierFor(worst.score);
                return (
                  <Link
                    key={d.id}
                    to="/districts"
                    search={{ d: d.id }}
                    className="block"
                  >
                    <Panel
                      className="h-full p-4 transition-transform hover:-translate-y-0.5"
                      alert={tier === "severe"}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="display text-lg font-semibold">{d.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {d.state} · {d.basin}
                          </p>
                        </div>
                        <TierChip tier={tier} dot={false} />
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-3">
                        <RiskScore score={worst.score} size="lg" />
                        <Sparkline
                          data={worst.rainTrend}
                          className="max-w-[96px] flex-1"
                          height={40}
                        />
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Peak at <span className="text-foreground">{worst.name}</span> ·{" "}
                        {worst.dominantDriver}
                      </p>
                      <div className="mt-3 flex gap-1">
                        {list.map((a) => {
                          const t = tierFor(a.score);
                          return (
                            <span
                              key={a.id}
                              className={cn(
                                "h-1 flex-1 rounded-full transition-colors duration-500",
                                t === "severe"
                                  ? "bg-severe"
                                  : t === "watch"
                                    ? "bg-watch"
                                    : "bg-normal",
                              )}
                            />
                          );
                        })}
                      </div>
                    </Panel>
                  </Link>
                );
              })}
            </div>
          </section>

          <section>
            <SectionTitle
              title="Active alerts — ranked by risk"
              hint="Every at-risk area across all districts, highest score first"
              right={
                <Link
                  to="/alerts"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Full feed <ArrowRight className="size-3" />
                </Link>
              }
            />
            <Panel className="divide-y divide-hairline p-1.5">
              {rankedAreas.map((a, i) => (
                <AlertRow
                  key={a.id}
                  area={a}
                  rank={i + 1}
                  districtName={districtById(a.districtId)?.name ?? ""}
                />
              ))}
            </Panel>
          </section>
        </div>
      )}
    </AppShell>
  );
}

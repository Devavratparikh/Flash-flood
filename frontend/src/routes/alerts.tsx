import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, Filter } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { DriverBars, Panel, RiskScore, SectionTitle, TierChip } from "@/components/app/primitives";
import { districtById, districts, rankedAreas, tierFor, type Tier } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts Feed | FlashWatch Early-Warning" },
      {
        name: "description",
        content:
          "Every at-risk area ranked by flood risk score, filterable by district, risk tier and time window.",
      },
      { property: "og:title", content: "Alerts Feed | FlashWatch Early-Warning" },
      {
        property: "og:description",
        content: "Live ranked flash flood alerts across all monitored districts.",
      },
    ],
  }),
  component: AlertsFeed,
});

const TIERS: (Tier | "all")[] = ["all", "severe", "watch", "normal"];
const WINDOWS = ["Last 1 hr", "Last 6 hr", "Last 24 hr"];

function AlertsFeed() {
  const [district, setDistrict] = useState("all");
  const [tier, setTier] = useState<Tier | "all">("all");
  const [win, setWin] = useState(WINDOWS[1]);
  const [open, setOpen] = useState<string | null>(rankedAreas[0]!.id);

  const rows = useMemo(
    () =>
      rankedAreas.filter(
        (a) =>
          (district === "all" || a.districtId === district) &&
          (tier === "all" || tierFor(a.score) === tier),
      ),
    [district, tier],
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Alerts feed</p>
          <h1 className="display mt-1 text-3xl font-bold">Ranked by risk</h1>
        </header>

        <Panel className="flex flex-wrap items-center gap-2 p-3">
          <Filter className="size-4 text-muted-foreground" />
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="h-8 rounded-lg border border-hairline bg-surface-2/60 px-2 text-xs outline-none"
          >
            <option value="all">All districts</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg border border-hairline bg-surface-2/60 p-0.5">
            {TIERS.map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors",
                  tier === t ? "bg-surface-2 text-foreground" : "text-muted-foreground",
                )}
              >
                {t === "all" ? "All" : t === "severe" ? "Act Now" : t === "watch" ? "Watch" : "Normal"}
              </button>
            ))}
          </div>
          <select
            value={win}
            onChange={(e) => setWin(e.target.value)}
            className="h-8 rounded-lg border border-hairline bg-surface-2/60 px-2 text-xs outline-none"
          >
            {WINDOWS.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
          <span className="num ml-auto text-xs text-muted-foreground">{rows.length} areas</span>
        </Panel>

        <div className="space-y-2">
          {rows.map((a, i) => {
            const t = tierFor(a.score);
            const expanded = open === a.id;
            return (
              <Panel key={a.id} className="overflow-hidden" alert={t === "severe"}>
                <button
                  onClick={() => setOpen(expanded ? null : a.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="num w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                  <span
                    className={cn(
                      "h-9 w-1 shrink-0 rounded-full transition-colors duration-500",
                      t === "severe" ? "bg-severe" : t === "watch" ? "bg-watch" : "bg-normal",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {districtById(a.districtId)?.name} · {a.dominantDriver}
                    </span>
                  </span>
                  <RiskScore score={a.score} size="sm" suffix={false} />
                  <TierChip tier={t} className="hidden sm:inline-flex" />
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
                {expanded ? (
                  <div className="animate-rise grid gap-5 border-t border-hairline px-4 py-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
                        Driver breakdown
                      </p>
                      <DriverBars drivers={a.drivers} />
                    </div>
                    <div className="space-y-3 text-sm">
                      <p className="leading-relaxed">{a.actionNote}</p>
                      <dl className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <dt>Lead time</dt>
                          <dd className="num text-foreground">{a.leadTimeMin} min</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Channels</dt>
                          <dd className="text-foreground">{a.channels.join(", ")}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Population exposed</dt>
                          <dd className="num text-foreground">
                            {a.population.toLocaleString("en-IN")}
                          </dd>
                        </div>
                      </dl>
                      <div className="flex gap-2 pt-1">
                        <Link
                          to="/area/$areaId"
                          params={{ areaId: a.id }}
                          className="rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 text-xs font-medium"
                        >
                          Deep-dive
                        </Link>
                        <Link
                          to="/broadcast"
                          search={{ area: a.id }}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                        >
                          Broadcast
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : null}
              </Panel>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

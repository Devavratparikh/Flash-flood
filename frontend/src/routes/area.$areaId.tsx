import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Cloud,
  CloudRain,
  CloudDrizzle,
  Droplets,
  Gauge,
  Thermometer,
  Wind,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import {
  DriverBars,
  Explain,
  Panel,
  RiskScore,
  SectionTitle,
  Sparkline,
  TierChip,
} from "@/components/app/primitives";
import { Loading } from "@/components/app/Loading";
import { useArea, useAreas, useDistricts } from "@/lib/queries";
import { horizonsFor, tierFor, weatherFor, type Area } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/area/$areaId")({
  head: () => ({
    meta: [
      { title: "Area risk deep-dive | FlashWatch" },
      {
        name: "description",
        content:
          "Current weather, multi-horizon flood risk, model reasoning and upstream propagation for a monitored area.",
      },
    ],
  }),
  component: AreaDetail,
});

const icons = { heavy: CloudRain, rain: CloudDrizzle, cloud: Cloud };

function Neighbour({ area, direction }: { area: Area; direction: "up" | "down" }) {
  const tier = tierFor(area.score);
  return (
    <Link
      to="/area/$areaId"
      params={{ areaId: area.id }}
      className="glass flex min-w-44 items-center gap-3 rounded-lg p-3"
    >
      <span
        className={cn(
          "h-8 w-1 rounded-full",
          tier === "severe" ? "bg-severe" : tier === "watch" ? "bg-watch" : "bg-normal",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{area.name}</span>
        <span className="block text-[11px] text-muted-foreground">
          {direction === "up" ? "Upstream" : "Downstream"} · score {area.score}
        </span>
      </span>
      <ArrowUpRight className="size-3.5 text-muted-foreground" />
    </Link>
  );
}

function AreaDetail() {
  const { areaId } = Route.useParams();
  const { data: area, isLoading, isError } = useArea(areaId);
  const { areaById } = useAreas();
  const { districtById } = useDistricts();

  if (isLoading)
    return (
      <AppShell>
        <Loading label="Loading area…" />
      </AppShell>
    );
  if (isError || !area)
    return (
      <AppShell>
        <Loading label="Area not found" error />
      </AppShell>
    );

  const district = districtById(area.districtId);
  const weather = weatherFor(area);
  const horizons = horizonsFor(area);
  const tier = tierFor(area.score);
  const upstream = area.upstream.map((id) => areaById(id)).filter(Boolean) as Area[];
  const downstream = area.downstream.map((id) => areaById(id)).filter(Boolean) as Area[];
  const incoming = upstream.some((u) => u.score > area.score);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              to="/districts"
              search={{ d: district?.id }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {district?.name}, {district?.state} ←
            </Link>
            <h1 className="display mt-1 text-4xl font-bold">{area.name}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {area.elevation} m · {area.population.toLocaleString("en-IN")} residents ·{" "}
              {district?.basin}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <TierChip tier={tier} />
            <RiskScore score={area.score} size="lg" />
          </div>
        </header>

        <Panel className="p-4" alert={tier === "severe"}>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            {[
              { icon: Thermometer, label: "Temperature", value: `${weather.tempC}°C`, tone: "" },
              {
                icon: Droplets,
                label: "Rain rate",
                value: `${weather.rainRate} mm/hr`,
                tone: "text-rain",
              },
              { icon: Wind, label: "Wind", value: `${weather.windKph} km/h`, tone: "" },
              { icon: Gauge, label: "Humidity", value: `${weather.humidity}%`, tone: "text-soil" },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="flex items-center gap-2.5">
                  <Icon className={cn("size-4", m.tone || "text-muted-foreground")} />
                  <div>
                    <p className="text-[11px] text-muted-foreground">{m.label}</p>
                    <p className={cn("num text-lg font-semibold", m.tone)}>{m.value}</p>
                  </div>
                </div>
              );
            })}

            <div className="ml-auto flex gap-2 overflow-x-auto">
              {weather.forecast.map((f) => {
                const Icon = icons[f.kind];
                return (
                  <div
                    key={f.hour}
                    className="min-w-[62px] rounded-lg border border-hairline bg-surface-2/50 px-2.5 py-2 text-center"
                  >
                    <p className="text-[10px] text-muted-foreground">{f.hour}</p>
                    <Icon
                      className={cn(
                        "mx-auto my-1 size-4",
                        f.kind === "heavy" ? "text-rain" : "text-muted-foreground",
                      )}
                    />
                    <p className="num text-xs">{f.mm} mm</p>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>

        <section>
          <SectionTitle
            title="Multi-horizon risk"
            hint="How the picture changes with forecast distance"
          />
          <div className="grid gap-3 md:grid-cols-3">
            {horizons.map((h) => {
              const t = tierFor(h.score);
              return (
                <Panel key={h.key} className="p-4" alert={t === "severe"}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{h.label}</p>
                    <span className="rounded-md border border-hairline px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {h.window}
                    </span>
                  </div>
                  <div className="mt-3">
                    <RiskScore score={h.score} size="md" />
                  </div>
                  <div className="mt-3 h-1 rounded-full bg-surface-2">
                    <div
                      className="h-1 rounded-full bg-model transition-all duration-700"
                      style={{ width: `${h.confidence}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Confidence {h.confidence}% · {h.note}
                  </p>
                </Panel>
              );
            })}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="p-5">
            <SectionTitle
              title="Why the model says this"
              hint="Each factor's push toward or away from risk"
            />
            <div className="mt-4">
              <DriverBars drivers={area.drivers} />
            </div>
            <div className="mt-4 flex flex-wrap gap-3 border-t border-hairline pt-3 text-[11px] text-muted-foreground">
              {[
                { c: "bg-rain", l: "Rainfall / hydrology" },
                { c: "bg-soil", l: "Soil & ground" },
                { c: "bg-model", l: "Model / terrain" },
              ].map((k) => (
                <span key={k.l} className="inline-flex items-center gap-1.5">
                  <span className={cn("size-1.5 rounded-full", k.c)} /> {k.l}
                </span>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <SectionTitle title="Rainfall & soil saturation" hint="Last six hours" />
            <div className="relative mt-4">
              <Sparkline data={area.rainTrend} stroke="var(--rain)" height={140} />
              <div className="absolute inset-0">
                <Sparkline data={area.soilTrend} stroke="var(--soil)" fill={false} height={140} />
              </div>
            </div>
            <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-rain" /> Rainfall (mm/hr) — peak{" "}
                {Math.max(...area.rainTrend, 0)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-soil" /> Soil saturation (%) — now{" "}
                {area.soilSaturation}
              </span>
            </div>
          </Panel>
        </div>

        <section>
          <SectionTitle
            title="Upstream & downstream propagation"
            hint={
              incoming
                ? "Risk is trending toward this area from upstream"
                : "No inbound surge detected from upstream reaches"
            }
          />
          <Panel className={cn("p-4", incoming && "glow-watch")}>
            <div className="flex flex-wrap items-center gap-3">
              {upstream.length ? (
                upstream.map((u) => <Neighbour key={u.id} area={u} direction="up" />)
              ) : (
                <span className="text-xs text-muted-foreground">Headwater — no upstream link</span>
              )}
              <ArrowRight
                className={cn("size-4", incoming ? "text-severe" : "text-muted-foreground")}
              />
              <div
                className={cn(
                  "min-w-44 rounded-lg border p-3",
                  tier === "severe"
                    ? "tier-severe"
                    : tier === "watch"
                      ? "tier-watch"
                      : "tier-normal",
                )}
              >
                <p className="text-sm font-semibold">{area.name}</p>
                <p className="num text-xs">score {area.score}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" />
              {downstream.length ? (
                downstream.map((d) => <Neighbour key={d.id} area={d} direction="down" />)
              ) : (
                <span className="text-xs text-muted-foreground">Basin outlet</span>
              )}
            </div>
          </Panel>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/broadcast"
            search={{ area: area.id }}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Broadcast alert for this area
          </Link>
          <Link
            to="/emergency"
            className="rounded-lg border border-hairline bg-surface-2 px-4 py-2.5 text-sm font-semibold"
          >
            Resident safety info
          </Link>
        </div>

        <p className="text-[11px] text-muted-foreground">
          <Explain hint="Risk scores are produced by the himvaah backend from the latest sensor readings and upstream state.">
            <span>Live risk score</span>
          </Explain>
        </p>
      </div>
    </AppShell>
  );
}

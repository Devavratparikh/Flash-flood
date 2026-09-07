import { Link } from "@tanstack/react-router";
import { ArrowRight, Bell, Clock, Droplets, Waves } from "lucide-react";
import {
  DriverBars,
  Explain,
  RiskScore,
  Sparkline,
  TierChip,
} from "@/components/app/primitives";
import { tierFor, type Area } from "@/lib/types";

export function AreaPanel({ area }: { area: Area }) {
  const tier = tierFor(area.score);
  return (
    <div key={area.id} className="animate-slide-in space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="display text-xl font-bold">{area.name}</p>
          <p className="text-xs text-muted-foreground">
            {area.elevation} m · {area.population.toLocaleString("en-IN")} residents
          </p>
        </div>
        <TierChip tier={tier} />
      </div>

      <RiskScore score={area.score} size="xl" />

      <div>
        <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">Driven by</p>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <Explain hint="How full the ground already is. Saturated soil cannot absorb more rain, so it runs straight into the river.">
              <dt className="text-muted-foreground">Soil saturation</dt>
            </Explain>
            <dd className="num font-semibold text-soil">{area.soilSaturation}%</dd>
          </div>
          <div className="flex items-center justify-between">
            <Explain hint="Rain measured in this catchment over the last hour.">
              <dt className="text-muted-foreground">Rainfall, last 1 hr</dt>
            </Explain>
            <dd className="num font-semibold text-rain">{area.rainfall1h} mm</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <Explain hint="Water deliberately released from an upstream dam or barrage adds to natural river flow.">
              <dt className="shrink-0 text-muted-foreground">Dam / reservoir</dt>
            </Explain>
            <dd className="text-right text-xs font-medium">{area.damStatus}</dd>
          </div>
        </dl>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Droplets className="size-3 text-rain" /> Rainfall, last 6 hr
          </span>
          <span className="num text-rain">{area.rainfall4h} mm total</span>
        </div>
        <Sparkline data={area.rainTrend} stroke="var(--rain)" height={52} />
      </div>

      <div className="rounded-lg border border-hairline bg-surface-2/50 p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="size-3.5" /> Lead time {area.leadTimeMin} min
          <span className="mx-1">·</span>
          <Bell className="size-3.5" /> {area.channels.join(" · ")}
        </div>
        <p className="mt-2 text-sm leading-relaxed">{area.actionNote}</p>
      </div>

      <div>
        <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
          Model reasoning
        </p>
        <DriverBars drivers={area.drivers} />
      </div>

      <Link
        to="/area/$areaId"
        params={{ areaId: area.id }}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <Waves className="size-4" /> Open full area deep-dive <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

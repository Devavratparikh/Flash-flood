import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Info, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  TIER_LABEL,
  tierClass,
  tierFor,
  tierText,
  type Area,
  type Driver,
  type Tier,
} from "@/lib/types";

/* ---------------------------------- Card ---------------------------------- */

export function Panel({
  children,
  className,
  alert,
}: {
  children: ReactNode;
  className?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={cn(
        "glass rounded-xl transition-colors duration-500",
        alert && "animate-pulse-ring border-severe/40",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="display text-lg font-semibold">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {right}
    </div>
  );
}

/* --------------------------------- Tier UI -------------------------------- */

export function TierChip({
  tier,
  className,
  dot = true,
}: {
  tier: Tier;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase transition-colors duration-500",
        tierClass[tier],
        className,
      )}
    >
      {dot ? (
        <span
          className={cn(
            "size-1.5 rounded-full bg-current",
            tier === "severe" && "animate-ticker",
          )}
        />
      ) : null}
      {TIER_LABEL[tier]}
    </span>
  );
}

export function RiskScore({
  score,
  size = "md",
  suffix = true,
}: {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
  suffix?: boolean;
}) {
  const tier = tierFor(score);
  const sizes = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-6xl",
    xl: "text-7xl sm:text-8xl",
  } as const;
  return (
    <div className="flex items-baseline gap-1">
      <span
        className={cn(
          "num font-bold transition-colors duration-700",
          tierText[tier],
          sizes[size],
        )}
      >
        {score}
      </span>
      {suffix ? <span className="text-xs text-muted-foreground">/100</span> : null}
    </div>
  );
}

/* -------------------------------- Tooltips -------------------------------- */

export function Explain({ children, hint }: { children: ReactNode; hint: string }) {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help items-center gap-1 decoration-dotted underline-offset-4 hover:underline">
            {children}
            <Info className="size-3 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-60 text-xs leading-relaxed">{hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* -------------------------------- Sparkline ------------------------------- */

export function Sparkline({
  data,
  className,
  stroke = "var(--rain)",
  fill = true,
  height = 40,
}: {
  data: number[];
  className?: string;
  stroke?: string;
  fill?: boolean;
  height?: number;
}) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((v - min) / span) * 88 - 6;
    return `${x},${y}`;
  });
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
      aria-hidden
    >
      {fill ? (
        <polygon points={`0,100 ${pts.join(" ")} 100,100`} fill={stroke} opacity={0.12} />
      ) : null}
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------- Driver bars ------------------------------ */

const domainVar = { rain: "var(--rain)", soil: "var(--soil)", model: "var(--model)" } as const;

export function DriverBars({ drivers }: { drivers: Driver[] }) {
  return (
    <ul className="space-y-2.5">
      {drivers.map((d) => {
        const pct = Math.abs(d.impact) * 50;
        const positive = d.impact >= 0;
        return (
          <li key={d.label} className="text-xs">
            <div className="mb-1 flex items-center justify-between gap-2">
              <Explain hint={d.hint}>
                <span className="text-muted-foreground">{d.label}</span>
              </Explain>
              <span className="num font-semibold">
                {d.value}{" "}
                <span className={positive ? "text-severe" : "text-normal"}>
                  {positive ? "↑" : "↓"}
                </span>
              </span>
            </div>
            <div className="relative h-1.5 rounded-full bg-surface-2">
              <div className="absolute inset-y-0 left-1/2 w-px bg-hairline" />
              <div
                className="absolute inset-y-0 rounded-full transition-all duration-700"
                style={{
                  background: domainVar[d.domain],
                  width: `${pct}%`,
                  left: positive ? "50%" : `${50 - pct}%`,
                  opacity: 0.85,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------- Alert row ------------------------------- */

export function AlertRow({
  area,
  districtName,
  rank,
}: {
  area: Area;
  districtName: string;
  rank?: number;
}) {
  const tier = tierFor(area.score);
  return (
    <Link
      to="/area/$areaId"
      params={{ areaId: area.id }}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-hairline hover:bg-surface-2/60",
        tier === "severe" && "bg-severe-soft/40",
      )}
    >
      {rank !== undefined ? (
        <span className="num w-5 shrink-0 text-xs text-muted-foreground">{rank}</span>
      ) : null}
      <span
        className={cn(
          "h-8 w-1 shrink-0 rounded-full transition-colors duration-500",
          tier === "severe" ? "bg-severe" : tier === "watch" ? "bg-watch" : "bg-normal",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{area.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {districtName} · {area.dominantDriver}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <RiskScore score={area.score} size="sm" suffix={false} />
      </div>
      <TierChip tier={tier} className="hidden shrink-0 sm:inline-flex" />
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

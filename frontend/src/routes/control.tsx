import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, Cpu, Gauge, Radio, Waves } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { DriverBars, Panel, RiskScore, SectionTitle, TierChip } from "@/components/app/primitives";
import { Loading } from "@/components/app/Loading";
import { useAppState } from "@/lib/app-state";
import { useAreas, usePushReading } from "@/lib/queries";
import { tierFor, type Area } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/control")({
  head: () => ({
    meta: [
      { title: "Sensor Control | FlashWatch NDRF Console" },
      {
        name: "description",
        content:
          "NDRF admin console: adjust a micro-watershed's live sensor inputs and see the Layer-1 model re-score it in real time.",
      },
    ],
  }),
  component: SensorControl,
});

type SourceInfo = { label: string; cls: string };
const SEED_SOURCE: SourceInfo = {
  label: "Seed baseline — no reading pushed yet",
  cls: "text-muted-foreground",
};
const SOURCE_LABEL: Record<string, SourceInfo> = {
  "ml-layer1": { label: "XGBoost Layer-1 model", cls: "text-model" },
  heuristic: { label: "Node heuristic (ML service offline)", cls: "text-watch" },
  seed: SEED_SOURCE,
};

function Field({
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label className="text-xs tracking-wide text-muted-foreground uppercase">{label}</label>
        <span className="num text-sm font-semibold">
          {value}
          <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

function AreaControl({ area }: { area: Area }) {
  const push = usePushReading();
  const [rainfall1h, setRainfall1h] = useState(Math.round(area.rainfall1h));
  const [soil, setSoil] = useState(area.soilSaturation);
  const [reservoir, setReservoir] = useState(55);
  const [dam, setDam] = useState(area.damStatus);
  const [result, setResult] = useState<Area | null>(null);

  useEffect(() => {
    setRainfall1h(Math.round(area.rainfall1h));
    setSoil(area.soilSaturation);
    setDam(area.damStatus);
    setResult(null);
  }, [area.id]); // reset when the operator switches area

  const shown = result ?? area;
  const src = SOURCE_LABEL[shown.scoreSource ?? "seed"] ?? SEED_SOURCE;

  async function submit() {
    try {
      const res = await push.mutateAsync({
        areaId: area.id,
        rainfall1h,
        soilSaturation: soil,
        reservoirLevel: reservoir,
        damStatus: dam,
      });
      setResult(res.area);
      const s = res.area.scoreSource === "ml-layer1" ? "XGBoost model" : "heuristic fallback";
      toast.success(`${area.name} re-scored: ${res.area.score}/100`, {
        description: `Scored by the ${s}. Pushed live to every open dashboard.`,
      });
    } catch (err) {
      toast.error("Push failed", { description: (err as Error).message });
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Panel className="space-y-5 p-5">
        <SectionTitle title="Sensor inputs" hint={`Micro-watershed: ${area.name}`} />
        <Field
          label="Rainfall (last 1 hr)"
          unit="mm/hr"
          value={rainfall1h}
          onChange={setRainfall1h}
          min={0}
          max={120}
        />
        <Field label="Soil saturation" unit="%" value={soil} onChange={setSoil} min={0} max={100} />
        <Field
          label="Upstream reservoir level"
          unit="%"
          value={reservoir}
          onChange={setReservoir}
          min={0}
          max={100}
        />
        <div>
          <label className="mb-1 block text-xs tracking-wide text-muted-foreground uppercase">
            Dam / barrage status
          </label>
          <input
            value={dam}
            onChange={(e) => setDam(e.target.value)}
            className="h-10 w-full rounded-lg border border-hairline bg-surface-2/60 px-3 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <button
          onClick={submit}
          disabled={push.isPending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Radio className="size-4" />
          {push.isPending ? "Scoring…" : "Push reading → re-score"}
        </button>
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <Activity className="mt-0.5 size-3 shrink-0 text-normal" />
          The backend rolls this into the 13 antecedent features the Layer-1 model needs, calls the
          Python service, and pushes the new score to every open dashboard over the live channel.
        </p>
      </Panel>

      <Panel className="space-y-4 p-5" alert={shown.score >= 75}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {result ? "New risk score" : "Current risk score"}
            </p>
            <p className="display text-lg font-bold">{shown.name}</p>
          </div>
          <TierChip tier={tierFor(shown.score)} />
        </div>
        <RiskScore score={shown.score} size="xl" />
        <div className="space-y-1">
          <p className={cn("inline-flex items-center gap-1.5 text-xs font-medium", src.cls)}>
            <Cpu className="size-3.5" /> {src.label}
          </p>
          {typeof shown.mlProbability === "number" ? (
            <p className="num text-[11px] text-muted-foreground">
              model flash-flood probability {(shown.mlProbability * 100).toFixed(1)}% · UI score
              blends model 70% / heuristic 30%
            </p>
          ) : null}
        </div>
        <div className="border-t border-hairline pt-3">
          <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
            Driver breakdown
          </p>
          {shown.drivers.length ? (
            <DriverBars drivers={shown.drivers} />
          ) : (
            <p className="text-xs text-muted-foreground">
              Push a reading to generate the breakdown.
            </p>
          )}
        </div>
        <dl className="space-y-1 border-t border-hairline pt-3 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <dt>Lead time</dt>
            <dd className="num text-foreground">{shown.leadTimeMin} min</dd>
          </div>
          <div className="flex justify-between">
            <dt>Population exposed</dt>
            <dd className="num text-foreground">{shown.population.toLocaleString("en-IN")}</dd>
          </div>
        </dl>
        <Link
          to="/area/$areaId"
          params={{ areaId: area.id }}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Waves className="size-3.5" /> Open the public area page
        </Link>
      </Panel>
    </div>
  );
}

function SensorControl() {
  const { user, authReady } = useAppState();
  const { areas, isLoading } = useAreas();
  const [areaId, setAreaId] = useState("");

  const ranked = useMemo(() => [...areas].sort((a, b) => b.score - a.score), [areas]);
  useEffect(() => {
    if (!areaId && ranked.length) setAreaId(ranked[0]!.id);
  }, [ranked, areaId]);

  if (authReady && user?.role !== "admin") {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg">
          <Panel className="p-6 text-center text-sm">
            <Gauge className="mx-auto mb-2 size-6 text-muted-foreground" />
            <p className="mb-1 font-semibold">NDRF Admin only</p>
            <p className="text-muted-foreground">
              The sensor control console adjusts live model inputs, so it's limited to the admin
              role.
            </p>
            <Link
              to="/login"
              className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Sign in as admin
            </Link>
            <p className="mt-2 text-[11px] text-muted-foreground">admin@himvaah.in / demo1234</p>
          </Panel>
        </div>
      </AppShell>
    );
  }

  if (!authReady || isLoading)
    return (
      <AppShell>
        <Loading label="Loading sensor console…" />
      </AppShell>
    );

  const area = ranked.find((a) => a.id === areaId);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">NDRF console</p>
          <h1 className="display mt-1 text-3xl font-bold">Sensor control</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Adjust a micro-watershed's inputs and re-score it through the Layer-1 model, live.
          </p>
        </header>

        <Panel className="flex flex-wrap items-center gap-2 p-3">
          <Gauge className="size-4 text-muted-foreground" />
          <select
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            className="h-9 min-w-56 rounded-lg border border-hairline bg-surface-2/60 px-2 text-sm outline-none"
          >
            {ranked.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {a.score}/100
              </option>
            ))}
          </select>
        </Panel>

        {area ? <AreaControl key={area.id} area={area} /> : null}
      </div>
    </AppShell>
  );
}

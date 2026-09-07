import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, ChevronDown, CloudRain, Timer } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Panel, RiskScore } from "@/components/app/primitives";
import { Loading } from "@/components/app/Loading";
import { useDistricts, useHistory } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Event History | FlashWatch Early-Warning" },
      {
        name: "description",
        content:
          "Past flash flood events by district with peak risk score, rainfall totals, response timeline and outcome notes.",
      },
      { property: "og:title", content: "Event History | FlashWatch Early-Warning" },
      {
        property: "og:description",
        content: "Past flood events, response timelines and outcomes by district.",
      },
    ],
  }),
  component: History,
});

function History() {
  const [district, setDistrict] = useState("all");
  const [from, setFrom] = useState("2026-06-01");
  const [open, setOpen] = useState<string | null>(null);
  const { districts } = useDistricts();
  const { data: rows = [], isLoading } = useHistory(district, from);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Archive</p>
          <h1 className="display mt-1 text-3xl font-bold">Past events</h1>
        </header>

        <Panel className="flex flex-wrap items-center gap-2 p-3">
          <CalendarDays className="size-4 text-muted-foreground" />
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
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-8 rounded-lg border border-hairline bg-surface-2/60 px-2 text-xs outline-none"
          />
          <span className="num ml-auto text-xs text-muted-foreground">{rows.length} events</span>
        </Panel>

        {isLoading ? (
          <Loading label="Loading history…" />
        ) : (
          <div className="space-y-2">
            {rows.map((e) => {
              const expanded = open === e.id;
              return (
                <Panel key={e.id} className="overflow-hidden">
                  <button
                    onClick={() => setOpen(expanded ? null : e.id)}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <p className="num truncate text-xs text-muted-foreground">
                        {districts.find((d) => d.id === e.districtId)?.name} · {e.date} ·{" "}
                        {e.duration}
                      </p>
                    </div>
                    <span className="num hidden items-center gap-1.5 text-xs text-rain sm:inline-flex">
                      <CloudRain className="size-3.5" /> {e.rainfallTotal} mm
                    </span>
                    <RiskScore score={e.peakScore} size="sm" suffix={false} />
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
                        <p className="mb-3 inline-flex items-center gap-1.5 text-xs tracking-wide text-muted-foreground uppercase">
                          <Timer className="size-3.5" /> Response timeline
                        </p>
                        <ol className="space-y-3 border-l border-hairline pl-4">
                          {e.timeline.map((t) => (
                            <li key={t.t} className="relative text-xs leading-relaxed">
                              <span className="absolute top-1.5 -left-[21px] size-1.5 rounded-full bg-primary" />
                              <span className="num mr-2 text-muted-foreground">{t.t}</span>
                              {t.text}
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div className="space-y-3">
                        <dl className="grid grid-cols-2 gap-3 text-xs">
                          <div className="rounded-lg border border-hairline bg-surface-2/40 p-3">
                            <dt className="text-muted-foreground">Peak risk score</dt>
                            <dd className="num mt-1 text-xl font-bold">{e.peakScore}</dd>
                          </div>
                          <div className="rounded-lg border border-hairline bg-surface-2/40 p-3">
                            <dt className="text-muted-foreground">Rainfall total</dt>
                            <dd className="num mt-1 text-xl font-bold text-rain">
                              {e.rainfallTotal} mm
                            </dd>
                          </div>
                        </dl>
                        <div>
                          <p className="text-xs tracking-wide text-muted-foreground uppercase">
                            Outcome
                          </p>
                          <p className="mt-1 text-sm leading-relaxed">{e.outcome}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </Panel>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

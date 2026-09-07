import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Camera, CheckCircle2, Crosshair, ImageUp, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Panel, SectionTitle } from "@/components/app/primitives";
import { communityReports } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report Ground Conditions | FlashWatch" },
      {
        name: "description",
        content:
          "Submit a geo-tagged photo of current water conditions and see verified community reports from nearby areas.",
      },
      { property: "og:title", content: "Report Ground Conditions | FlashWatch" },
      {
        property: "og:description",
        content: "Send a geo-tagged ground report and browse recent community sightings.",
      },
    ],
  }),
  component: ReportGroundConditions,
});

const SEVERITIES = [
  { key: "Normal", cls: "tier-normal" },
  { key: "Rising", cls: "tier-watch" },
  { key: "Flooding", cls: "tier-severe" },
] as const;

const sevClass: Record<string, string> = {
  Normal: "tier-normal",
  Rising: "tier-watch",
  Flooding: "tier-severe",
};

function ReportGroundConditions() {
  const [severity, setSeverity] = useState<string>("Rising");
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("");

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Community reporting
          </p>
          <h1 className="display mt-1 text-3xl font-bold">Report ground conditions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What you see on the ground helps confirm what the model predicts.
          </p>
        </header>

        <Panel className="space-y-5 p-5">
          <label className="block cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setPhoto(f.name);
                  toast.success("Photo attached", { description: "Location captured from EXIF." });
                }
              }}
            />
            <div
              className={cn(
                "grid h-40 place-items-center rounded-xl border border-dashed border-hairline bg-surface-2/40 text-center transition-colors hover:bg-surface-2/70",
                photo && "border-normal/50",
              )}
            >
              {photo ? (
                <div className="space-y-1">
                  <CheckCircle2 className="mx-auto size-6 text-normal" />
                  <p className="text-sm font-medium">{photo}</p>
                  <p className="text-xs text-muted-foreground">Tap to replace</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <ImageUp className="mx-auto size-6 text-muted-foreground" />
                  <p className="text-sm font-medium">Take or upload a photo</p>
                  <p className="text-xs text-muted-foreground">
                    Your location is attached automatically
                  </p>
                </div>
              )}
            </div>
          </label>

          {/* Captured location */}
          <div className="flex items-center gap-4 rounded-xl border border-hairline bg-surface-2/40 p-3">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-hairline bg-surface">
              <svg viewBox="0 0 100 100" className="size-full" aria-hidden>
                {Array.from({ length: 9 }).map((_, i) => (
                  <g key={i} stroke="oklch(1 0 0 / 0.07)" strokeWidth="0.5">
                    <line x1={(i + 1) * 10} y1="0" x2={(i + 1) * 10} y2="100" />
                    <line x1="0" y1={(i + 1) * 10} x2="100" y2={(i + 1) * 10} />
                  </g>
                ))}
                <path
                  d="M 0 30 C 30 45, 55 40, 100 68"
                  fill="none"
                  stroke="var(--rain)"
                  strokeOpacity="0.6"
                  strokeWidth="2"
                />
                <circle cx="50" cy="50" r="16" fill="var(--rain)" fillOpacity="0.14" />
                <circle cx="50" cy="50" r="3.5" fill="var(--rain)" />
              </svg>
            </div>
            <div className="min-w-0 text-xs">
              <p className="inline-flex items-center gap-1.5 font-medium">
                <Crosshair className="size-3.5 text-rain" /> Location captured
              </p>
              <p className="num mt-1 text-muted-foreground">30.4468° N, 79.6702° E</p>
              <p className="text-muted-foreground">Accuracy ±9 m · Raini Village, Chamoli</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
              How bad is it right now?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {SEVERITIES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSeverity(s.key)}
                  className={cn(
                    "h-14 rounded-xl border text-sm font-semibold transition-colors",
                    severity === s.key ? s.cls : "border-hairline text-muted-foreground",
                  )}
                >
                  {s.key}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Anything else worth knowing? (optional)"
            className="w-full resize-none rounded-xl border border-hairline bg-surface-2/60 p-3 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
          />

          <button
            onClick={() => {
              toast.success("Report submitted", {
                description: `${severity} · sent to the district control room for verification.`,
              });
              setNote("");
              setPhoto(null);
            }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground"
          >
            <Camera className="size-5" /> Submit report
          </button>
        </Panel>

        <section>
          <SectionTitle
            title="Recent community reports"
            hint="Verified by district officers where marked"
          />
          <div className="space-y-2">
            {communityReports.map((r) => (
              <Panel key={r.id} className="flex items-start gap-3 p-3">
                <div className="grid size-14 shrink-0 place-items-center rounded-lg border border-hairline bg-surface-2">
                  <Camera className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{r.location}</p>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
                        sevClass[r.severity],
                      )}
                    >
                      {r.severity}
                    </span>
                    {r.verified ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-normal">
                        <ShieldCheck className="size-3" /> Verified
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Awaiting review</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.note}</p>
                  <p className="num mt-1 text-[11px] text-muted-foreground">
                    {r.reporter} · {r.minutesAgo} min ago · {r.coords} ±{r.accuracy} m
                  </p>
                </div>
              </Panel>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

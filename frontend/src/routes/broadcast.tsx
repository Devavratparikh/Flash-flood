import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Bell, Check, MessageSquare, PhoneCall, Radio, Send, X } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Panel, SectionTitle, TierChip } from "@/components/app/primitives";
import { Loading } from "@/components/app/Loading";
import { useAppState } from "@/lib/app-state";
import { useAreas, useBroadcasts, useCreateBroadcast, useDistricts } from "@/lib/queries";
import { TIER_LABEL, tierFor, type Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/broadcast")({
  validateSearch: z.object({ area: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Broadcast Alert | FlashWatch Officer Console" },
      {
        name: "description",
        content:
          "Compose and issue a flood alert to selected areas over push, SMS and IVR voice, with estimated reach and a confirmation step.",
      },
      { property: "og:title", content: "Broadcast Alert | FlashWatch Officer Console" },
      {
        property: "og:description",
        content: "Issue a multi-channel flood alert with estimated reach per channel.",
      },
    ],
  }),
  component: BroadcastAlert,
});

const CHANNELS = [
  { key: "Push", icon: Bell, perHead: 1 },
  { key: "SMS", icon: MessageSquare, perHead: 0.86 },
  { key: "IVR voice", icon: PhoneCall, perHead: 0.42 },
] as const;

const HINDI_PREVIEW =
  "तुरंत ऊँचे स्थान पर जाएँ। नदी किनारे की गलियों में एक घंटे के भीतर पानी आने की संभावना है।";

function BroadcastAlert() {
  const { area: preset } = Route.useSearch();
  const { user } = useAppState();
  const { areas, isLoading } = useAreas();
  const { districtById } = useDistricts();
  const { data: log = [] } = useBroadcasts();
  const createBroadcast = useCreateBroadcast();

  const presetArea = areas.find((a) => a.id === preset);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [channels, setChannels] = useState<string[]>(["Push", "SMS"]);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [confirming, setConfirming] = useState(false);

  const effSelected =
    selected ??
    (presetArea
      ? [presetArea.id]
      : areas.filter((a) => tierFor(a.score) === "severe").map((a) => a.id));
  const effTier = tier ?? (presetArea ? tierFor(presetArea.score) : "severe");
  const effMessage =
    message ??
    presetArea?.actionNote ??
    "Move to higher ground now. Riverside lanes are expected to flood within the hour.";

  const population = useMemo(
    () => areas.filter((a) => effSelected.includes(a.id)).reduce((s, a) => s + a.population, 0),
    [areas, effSelected],
  );

  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const canSend =
    (user?.role === "officer" || user?.role === "admin") && effSelected.length && channels.length;

  async function send() {
    try {
      await createBroadcast.mutateAsync({
        tier: effTier,
        message: effMessage,
        areaIds: effSelected,
        channels,
        ...(lang === "hi" ? { messageHi: HINDI_PREVIEW } : {}),
      });
      setConfirming(false);
      toast.success("Alert broadcast", {
        description: `${TIER_LABEL[effTier]} sent to ${effSelected.length} area(s) over ${channels.join(", ")}.`,
      });
    } catch (err) {
      setConfirming(false);
      toast.error("Broadcast failed", { description: (err as Error).message });
    }
  }

  if (isLoading)
    return (
      <AppShell>
        <Loading label="Loading areas…" />
      </AppShell>
    );

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Officer console
          </p>
          <h1 className="display mt-1 text-3xl font-bold">Broadcast alert</h1>
        </header>

        {!user || (user.role !== "officer" && user.role !== "admin") ? (
          <Panel className="p-4 text-sm tier-watch">
            Broadcasting requires an officer or admin sign-in.{" "}
            <Link to="/login" className="font-semibold underline">
              Sign in
            </Link>{" "}
            (officer@himvaah.in / demo1234). You can still compose a draft below.
          </Panel>
        ) : null}

        <Panel className="space-y-6 p-5" alert={effTier === "severe"}>
          <div>
            <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
              Areas ({effSelected.length} selected · {population.toLocaleString("en-IN")} people)
            </p>
            <div className="flex flex-wrap gap-2">
              {areas.map((a) => {
                const on = effSelected.includes(a.id);
                const t = tierFor(a.score);
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelected(toggle(effSelected, a.id))}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                      on ? "border-ring/60 bg-surface-2" : "border-hairline text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        t === "severe" ? "bg-severe" : t === "watch" ? "bg-watch" : "bg-normal",
                      )}
                    />
                    {a.name}
                    <span className="text-[10px] text-muted-foreground">
                      {districtById(a.districtId)?.name}
                    </span>
                    {on ? <Check className="size-3" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
              Severity tier
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["normal", "watch", "severe"] as Tier[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-semibold transition-colors",
                    effTier === t
                      ? t === "severe"
                        ? "tier-severe"
                        : t === "watch"
                          ? "tier-watch"
                          : "tier-normal"
                      : "border-hairline text-muted-foreground",
                  )}
                >
                  {TIER_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Message</p>
              <div className="flex rounded-lg border border-hairline bg-surface-2/60 p-0.5 text-xs">
                {(["en", "hi"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={cn(
                      "rounded-md px-2.5 py-1",
                      lang === l ? "bg-surface-2" : "text-muted-foreground",
                    )}
                  >
                    {l === "en" ? "English" : "हिन्दी preview"}
                  </button>
                ))}
              </div>
            </div>
            {lang === "en" ? (
              <textarea
                value={effMessage}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={280}
                className="w-full resize-none rounded-xl border border-hairline bg-surface-2/60 p-3 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
              />
            ) : (
              <div className="rounded-xl border border-hairline bg-surface-2/40 p-3 text-sm leading-relaxed">
                {HINDI_PREVIEW}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Machine translation preview — reviewed before send.
                </p>
              </div>
            )}
            <p className="num mt-1 text-right text-[11px] text-muted-foreground">
              {effMessage.length}/280
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">Channels</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {CHANNELS.map((c) => {
                const on = channels.includes(c.key);
                const Icon = c.icon;
                return (
                  <button
                    key={c.key}
                    onClick={() => setChannels(toggle(channels, c.key))}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      on ? "border-ring/60 bg-surface-2" : "border-hairline",
                    )}
                  >
                    <Icon className={cn("size-4", on ? "text-primary" : "text-muted-foreground")} />
                    <span>
                      <span className="block text-sm font-medium">{c.key}</span>
                      <span className="num block text-[11px] text-muted-foreground">
                        reach ≈ {Math.round(population * c.perHead).toLocaleString("en-IN")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {!confirming ? (
            <button
              disabled={!canSend}
              onClick={() => setConfirming(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              <Radio className="size-4" /> Review & send
            </button>
          ) : (
            <div className="animate-rise space-y-3 rounded-xl border border-severe/40 bg-severe-soft p-4">
              <p className="text-sm font-semibold text-severe">Confirm broadcast</p>
              <p className="text-xs leading-relaxed">
                Sending a <strong>{TIER_LABEL[effTier]}</strong> alert to {effSelected.length} area
                {effSelected.length > 1 ? "s" : ""} over {channels.join(", ")} — estimated{" "}
                {Math.round(population * 0.9).toLocaleString("en-IN")} people reached. This cannot
                be recalled.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={send}
                  disabled={createBroadcast.isPending}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-severe text-sm font-semibold text-foreground disabled:opacity-50"
                >
                  <Send className="size-4" /> {createBroadcast.isPending ? "Sending…" : "Send now"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-hairline px-4 text-sm"
                >
                  <X className="size-4" /> Cancel
                </button>
              </div>
            </div>
          )}
        </Panel>

        <section>
          <SectionTitle title="Recently broadcast" hint="Last 24 hours across all districts" />
          <div className="space-y-2">
            {log.map((b) => (
              <Panel key={b.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <TierChip tier={b.tier} dot={false} />
                  <p className="text-sm font-medium">{b.areas}</p>
                  <span className="num ml-auto text-[11px] text-muted-foreground">
                    {b.minutesAgo} min ago
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.message}</p>
                <p className="num mt-2 text-[11px] text-muted-foreground">
                  {b.channels.join(" · ")} · reached {b.reach.toLocaleString("en-IN")} · {b.officer}
                </p>
              </Panel>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BellRing, Check, MessageSquare, MoonStar } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Panel } from "@/components/app/primitives";
import { Switch } from "@/components/ui/switch";
import { areas, districtById } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/preferences")({
  head: () => ({
    meta: [
      { title: "Notification Preferences | FlashWatch" },
      {
        name: "description",
        content:
          "Choose which areas to follow, how you receive flood alerts, and set quiet hours that Act Now alerts always bypass.",
      },
      { property: "og:title", content: "Notification Preferences | FlashWatch" },
      {
        property: "og:description",
        content: "Follow areas and pick your alert channels and quiet hours.",
      },
    ],
  }),
  component: NotificationPreferences,
});

function NotificationPreferences() {
  const [followed, setFollowed] = useState<string[]>(["raini", "tapovan"]);
  const [push, setPush] = useState(true);
  const [sms, setSms] = useState(true);
  const [quiet, setQuiet] = useState(false);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-5">
        <header>
          <h1 className="display text-3xl font-bold">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose what you want to hear about, and how.
          </p>
        </header>

        <Panel className="p-5">
          <p className="mb-3 text-sm font-semibold">Areas you follow</p>
          <div className="flex flex-wrap gap-2">
            {areas.map((a) => {
              const on = followed.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() =>
                    setFollowed(
                      on ? followed.filter((x) => x !== a.id) : [...followed, a.id],
                    )
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs transition-colors",
                    on ? "border-ring/60 bg-surface-2" : "border-hairline text-muted-foreground",
                  )}
                >
                  {a.name}
                  <span className="text-[10px] text-muted-foreground">
                    {districtById(a.districtId)?.name}
                  </span>
                  {on ? <Check className="size-3 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel className="divide-y divide-hairline p-1">
          {[
            {
              icon: BellRing,
              title: "Push notifications",
              sub: "Instant alerts on this device",
              value: push,
              set: setPush,
            },
            {
              icon: MessageSquare,
              title: "SMS",
              sub: "Works without internet — best on weak networks",
              value: sms,
              set: setSms,
            },
            {
              icon: MoonStar,
              title: "Quiet hours (10 pm – 6 am)",
              sub: "Act Now alerts always come through, even during quiet hours",
              value: quiet,
              set: setQuiet,
            },
          ].map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.title} className="flex items-center gap-4 p-4">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{row.title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{row.sub}</p>
                </div>
                <Switch checked={row.value} onCheckedChange={row.set} />
              </div>
            );
          })}
        </Panel>

        {quiet ? (
          <p className="animate-rise tier-watch rounded-xl border p-3 text-xs leading-relaxed">
            Quiet hours are on. You will still be woken for an Act Now alert in any area you
            follow — that override cannot be turned off.
          </p>
        ) : null}

        <button
          onClick={() =>
            toast.success("Preferences saved", {
              description: `Following ${followed.length} area(s).`,
            })
          }
          className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
        >
          Save preferences
        </button>
      </div>
    </AppShell>
  );
}

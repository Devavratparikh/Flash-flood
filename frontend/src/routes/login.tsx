import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CloudRain, Shield, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/app-state";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in | FlashWatch Early-Warning" },
      {
        name: "description",
        content:
          "Sign in to the FlashWatch flash flood early-warning console as a resident, district officer or NDRF admin.",
      },
      { property: "og:title", content: "Sign in | FlashWatch Early-Warning" },
      {
        property: "og:description",
        content: "Access the flash flood early-warning console for your district.",
      },
    ],
  }),
  component: Login,
});

const ROLES = [
  {
    key: "resident",
    label: "Resident",
    icon: User,
    desc: "Simple risk view and safety guidance",
    email: "resident@himvaah.in",
  },
  {
    key: "officer",
    label: "District Officer",
    icon: Building2,
    desc: "Full data, drivers and broadcast tools",
    email: "officer@himvaah.in",
  },
  {
    key: "admin",
    label: "NDRF Admin",
    icon: Shield,
    desc: "Region-wide model and response ops",
    email: "admin@himvaah.in",
  },
] as const;

function Login() {
  const [role, setRole] = useState<(typeof ROLES)[number]["key"]>("officer");
  const [email, setEmail] = useState("officer@himvaah.in");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { login } = useAppState();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate({ to: "/" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-hairline bg-surface lg:block">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden
        >
          {Array.from({ length: 30 }).map((_, i) => (
            <path
              key={i}
              d={`M -5 ${102 - i * 2.6} C 18 ${94 - i * 2.9}, 44 ${104 - i * 2.4}, 70 ${88 - i * 2.7} S 96 ${80 - i * 2.5}, 105 ${84 - i * 2.6}`}
              fill="none"
              stroke="oklch(1 0 0 / 0.05)"
              strokeWidth="0.22"
            />
          ))}
          <path
            d="M -5 78 L 14 52 L 26 64 L 42 34 L 58 58 L 72 42 L 88 62 L 105 48 L 105 105 L -5 105 Z"
            fill="oklch(1 0 0 / 0.028)"
          />
          <path
            d="M -5 92 L 18 70 L 34 82 L 50 60 L 68 78 L 84 66 L 105 84 L 105 105 L -5 105 Z"
            fill="oklch(1 0 0 / 0.035)"
          />
          <path
            d="M 34 -2 C 40 22, 34 40, 46 58 S 62 82, 60 104"
            fill="none"
            stroke="var(--rain)"
            strokeOpacity="0.55"
            strokeWidth="0.8"
          />
          <path
            d="M 12 20 C 24 32, 30 36, 39 46"
            fill="none"
            stroke="var(--rain)"
            strokeOpacity="0.3"
            strokeWidth="0.4"
          />
          <path
            d="M 84 34 C 70 46, 60 54, 51 66"
            fill="none"
            stroke="var(--rain)"
            strokeOpacity="0.3"
            strokeWidth="0.4"
          />
        </svg>
        <div className="absolute inset-0">
          {Array.from({ length: 44 }).map((_, i) => (
            <span
              key={i}
              className="absolute w-px bg-rain/30"
              style={{
                left: `${(i * 7.3) % 100}%`,
                top: `-${(i * 13) % 60}%`,
                height: `${8 + (i % 5) * 4}%`,
                animation: `fall ${2 + (i % 7) * 0.4}s linear ${i * 0.09}s infinite`,
              }}
            />
          ))}
        </div>
        <div className="absolute right-10 bottom-12 left-10">
          <p className="display text-3xl font-bold">
            Minutes of warning
            <br />
            change everything.
          </p>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Continuous rainfall, soil and upstream-release monitoring across Himalayan hill
            districts, translated into one clear instruction.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-14">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg border border-hairline bg-surface-2">
              <CloudRain className="size-4 text-primary" />
            </span>
            <div>
              <p className="display text-sm font-bold">FLASHWATCH</p>
              <p className="text-[10px] tracking-wider text-muted-foreground uppercase">
                Early-warning system
              </p>
            </div>
          </div>

          <h1 className="display mt-8 text-2xl font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Demo accounts are seeded — pick a role to prefill.
          </p>

          <div className="mt-6 space-y-2">
            {ROLES.map((r) => {
              const Icon = r.icon;
              const active = role === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => {
                    setRole(r.key);
                    setEmail(r.email);
                    setPassword("demo1234");
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    active
                      ? "border-ring/60 bg-surface-2"
                      : "border-hairline hover:bg-surface-2/60",
                  )}
                >
                  <Icon
                    className={cn("size-4", active ? "text-primary" : "text-muted-foreground")}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{r.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <form className="mt-6 space-y-3" onSubmit={onSubmit}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Official email"
              className="h-11 w-full rounded-lg border border-hairline bg-surface-2/60 px-3 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="h-11 w-full rounded-lg border border-hairline bg-surface-2/60 px-3 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
            />
            {error ? <p className="text-xs text-severe">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Continue"}
            </button>
          </form>

          <p className="mt-8 text-[11px] leading-relaxed text-muted-foreground">
            Demonstration build with simulated sensor data. Do not use for real emergency decisions.
          </p>
        </div>
      </div>
    </div>
  );
}

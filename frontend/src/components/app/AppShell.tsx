import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Brain,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  History,
  LifeBuoy,
  Map as MapIcon,
  Menu,
  Radio,
  Search,
  Settings2,
  Upload,
  Waves,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/app-state";
import { areas, districtById, districts, languages, systemStats } from "@/lib/mock-data";

type NavItem = { to: string; label: string; icon: typeof MapIcon; officerOnly?: boolean };

const NAV: NavItem[] = [
  { to: "/", label: "Home · Risk Map", icon: Waves },
  { to: "/districts", label: "District Explorer", icon: MapIcon },
  { to: "/alerts", label: "Alerts Feed", icon: AlertTriangle },
  { to: "/report", label: "Report Conditions", icon: Upload },
  { to: "/emergency", label: "Emergency Info", icon: LifeBuoy },
  { to: "/broadcast", label: "Broadcast Alert", icon: Radio, officerOnly: true },
  { to: "/insights", label: "Model Insights", icon: Brain, officerOnly: true },
  { to: "/history", label: "History", icon: History },
  { to: "/preferences", label: "Notifications", icon: Settings2 },
];

function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const a = areas
      .filter((x) => x.name.toLowerCase().includes(term))
      .slice(0, 5)
      .map((x) => ({
        key: x.id,
        label: x.name,
        sub: districtById(x.districtId)?.name ?? "",
        go: () => navigate({ to: "/area/$areaId", params: { areaId: x.id } }),
      }));
    const d = districts
      .filter((x) => x.name.toLowerCase().includes(term))
      .slice(0, 3)
      .map((x) => ({
        key: `d-${x.id}`,
        label: x.name,
        sub: `${x.state} · district`,
        go: () => navigate({ to: "/districts", search: { d: x.id } }),
      }));
    return [...a, ...d];
  }, [q, navigate]);

  return (
    <div ref={wrap} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Jump to district or area…"
        className="h-9 w-full rounded-lg border border-hairline bg-surface-2/60 pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
      />
      {open && results.length > 0 ? (
        <ul className="animate-rise absolute top-11 z-50 w-full overflow-hidden rounded-lg border border-hairline bg-popover shadow-2xl">
          {results.map((r) => (
            <li key={r.key}>
              <button
                onClick={() => {
                  r.go();
                  setQ("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                <span>{r.label}</span>
                <span className="text-xs text-muted-foreground">{r.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SyncPill() {
  const { online, setOnline } = useAppState();
  return (
    <button
      onClick={() => setOnline(!online)}
      title="Toggle simulated connectivity"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-500",
        online ? "tier-normal" : "tier-watch",
      )}
    >
      {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
      <span className="hidden sm:inline">
        {online ? "Live · synced 2 min ago" : "Offline · cached data from 14 min ago"}
      </span>
      <span className="sm:hidden">{online ? "Live" : "Offline"}</span>
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { view, setView, language, setLanguage, role } = useAppState();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = NAV.filter((n) => view === "officer" || !n.officerOnly);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-surface-2 font-medium text-foreground"
                : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
            )}
            title={item.label}
          >
            <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
            {!collapsed ? <span className="truncate">{item.label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <Link to="/" className="flex items-center gap-2.5 px-4 py-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-hairline bg-surface-2">
        <CloudRain className="size-4 text-primary" />
      </span>
      {!collapsed ? (
        <span className="min-w-0">
          <span className="display block truncate text-sm font-bold">FLASHWATCH</span>
          <span className="block truncate text-[10px] tracking-wider text-muted-foreground uppercase">
            Early-warning system
          </span>
        </span>
      ) : null}
    </Link>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "panel sticky top-0 hidden h-screen shrink-0 flex-col border-r transition-[width] duration-300 lg:flex",
          collapsed ? "w-[76px]" : "w-64",
        )}
      >
        {brand}
        {nav}
        <div className="border-t border-hairline p-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <>
                <ChevronLeft className="size-4" /> Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="animate-slide-in panel absolute inset-y-0 left-0 flex w-72 flex-col">
            <div className="flex items-center justify-between">
              {brand}
              <button onClick={() => setMobileOpen(false)} className="p-4 text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-hairline bg-background/80 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-hairline p-2 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-4" />
            </button>

            <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
              <GlobalSearch />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <SyncPill />

              <Link
                to="/alerts"
                className="tier-severe inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold"
                title="Active Act Now alerts"
              >
                <AlertTriangle className="size-3.5" />
                <span className="num">{systemStats.actNow}</span>
              </Link>

              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                aria-label="Language"
                className="hidden h-8 rounded-lg border border-hairline bg-surface-2/60 px-2 text-xs outline-none md:block"
              >
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>


              <div className="flex items-center rounded-full border border-hairline bg-surface-2/60 p-0.5">
                {(["officer", "resident"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setView(m)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      view === m
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m === "officer" ? "Officer" : "Resident"}
                  </button>
                ))}
              </div>

              <div className="hidden items-center gap-2 rounded-full border border-hairline bg-surface-2/60 py-1 pr-3 pl-1 xl:flex">
                <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  {view === "officer" ? "DO" : "RS"}
                </span>
                <span className="text-xs text-muted-foreground">{role}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-hairline px-4 py-1.5 text-[11px] text-muted-foreground sm:px-6">
            <Activity className="size-3 text-normal" />
            <span>
              {systemStats.modelVersion} · last model refresh {systemStats.lastRefresh} ·{" "}
              {systemStats.areasMonitored} areas across {systemStats.districtsMonitored} districts
            </span>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 pb-20 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

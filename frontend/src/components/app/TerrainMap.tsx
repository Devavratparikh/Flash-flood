import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { tierFor, type Area } from "@/lib/mock-data";
import { RotateCcw, Move3d } from "lucide-react";

const tierColor = {
  normal: "var(--normal)",
  watch: "var(--watch)",
  severe: "var(--severe)",
} as const;

export function TerrainMap({
  areas,
  selectedId,
  onSelect,
}: {
  areas: Area[];
  selectedId?: string | undefined;
  onSelect: (id: string) => void;
}) {
  const isMobile = useIsMobile();
  const [rot, setRot] = useState({ x: 52, z: -18 });
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const flat = isMobile;

  const onDown = (e: React.PointerEvent) => {
    if (flat) return;
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setRot((r) => ({
      x: Math.min(78, Math.max(12, r.x - dy * 0.3)),
      z: r.z + dx * 0.3,
    }));
  };
  const onUp = () => {
    drag.current = null;
  };

  const river = "M 8 6 C 26 20, 22 34, 40 44 S 60 58, 68 68 S 84 82, 96 96";

  return (
    <div className="relative overflow-hidden rounded-xl border border-hairline bg-surface">
      <div
        className="relative h-[420px] touch-pan-y select-none sm:h-[520px]"
        style={{ perspective: "1200px" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onWheel={(e) => {
          if (flat) return;
          setZoom((z) => Math.min(1.8, Math.max(0.7, z - e.deltaY * 0.001)));
        }}
      >
        <div
          className="absolute inset-0 grid place-items-center"
          style={{ transformStyle: "preserve-3d" }}
        >
          <div
            className={cn("relative aspect-square w-[88%]", !flat && "cursor-grab")}
            style={{
              transform: flat
                ? "none"
                : `rotateX(${rot.x}deg) rotateZ(${rot.z}deg) scale(${zoom})`,
              transformStyle: "preserve-3d",
              transition: drag.current ? "none" : "transform 0.25s ease-out",
            }}
          >
            {/* terrain plate */}
            <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
              <defs>
                <linearGradient id="plate" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="oklch(0.24 0.017 250)" />
                  <stop offset="100%" stopColor="oklch(0.19 0.014 250)" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" fill="url(#plate)" rx="1" />
              {/* grid */}
              {Array.from({ length: 19 }).map((_, i) => (
                <g key={i} stroke="oklch(1 0 0 / 0.05)" strokeWidth="0.15">
                  <line x1={(i + 1) * 5} y1="0" x2={(i + 1) * 5} y2="100" />
                  <line x1="0" y1={(i + 1) * 5} x2="100" y2={(i + 1) * 5} />
                </g>
              ))}
              {/* contours */}
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <path
                  key={i}
                  d={`M ${-10 + i * 6} 100 C ${20 + i * 6} ${72 - i * 7}, ${52 + i * 5} ${
                    68 - i * 6
                  }, ${110} ${28 - i * 4}`}
                  fill="none"
                  stroke="oklch(1 0 0 / 0.07)"
                  strokeWidth="0.3"
                />
              ))}
              {/* drainage / river */}
              <path
                d={river}
                fill="none"
                stroke="var(--rain)"
                strokeOpacity="0.22"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <path
                d={river}
                fill="none"
                stroke="var(--rain)"
                strokeOpacity="0.75"
                strokeWidth="0.9"
                strokeLinecap="round"
              />
              {/* tributaries */}
              <path
                d="M 34 8 C 36 20, 34 34, 41 45"
                fill="none"
                stroke="var(--rain)"
                strokeOpacity="0.35"
                strokeWidth="0.5"
              />
              <path
                d="M 88 34 C 76 44, 74 56, 69 68"
                fill="none"
                stroke="var(--rain)"
                strokeOpacity="0.35"
                strokeWidth="0.5"
              />
              <rect
                width="100"
                height="100"
                fill="none"
                stroke="oklch(1 0 0 / 0.12)"
                strokeWidth="0.3"
              />
            </svg>

            {/* markers */}
            {areas.map((a) => {
              const tier = tierFor(a.score);
              const selected = a.id === selectedId;
              return (
                <button
                  key={a.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(a.id);
                  }}
                  className="absolute"
                  style={{
                    left: `${a.x}%`,
                    top: `${a.y}%`,
                    transform: flat
                      ? "translate(-50%,-50%)"
                      : `translate(-50%,-50%) translateZ(26px) rotateZ(${-rot.z}deg) rotateX(${-rot.x}deg)`,
                    transformStyle: "preserve-3d",
                  }}
                  title={a.name}
                >
                  <span
                    className={cn(
                      "grid place-items-center rounded-full border-2 transition-all duration-500",
                      selected ? "size-6" : "size-4",
                    )}
                    style={{
                      borderColor: tierColor[tier],
                      background: "oklch(0.16 0.014 250 / 0.9)",
                      boxShadow:
                        tier === "severe"
                          ? `0 0 18px -2px ${tierColor[tier]}`
                          : `0 0 10px -4px ${tierColor[tier]}`,
                    }}
                  >
                    <span
                      className={cn(
                        "rounded-full transition-all duration-500",
                        selected ? "size-2.5" : "size-1.5",
                        tier === "severe" && "animate-ticker",
                      )}
                      style={{ background: tierColor[tier] }}
                    />
                  </span>
                  <span
                    className="mt-1 block text-center text-[10px] font-medium whitespace-nowrap"
                    style={{ color: tierColor[tier] }}
                  >
                    {a.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-hairline px-3 py-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Move3d className="size-3.5" />
          {flat ? "2D pin map · tap a marker" : "Drag to rotate · scroll to zoom · click a marker"}
        </span>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-3 sm:flex">
            {(["normal", "watch", "severe"] as const).map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: tierColor[t] }}
                />
                {t === "normal" ? "Normal" : t === "watch" ? "Watch" : "Act Now"}
              </span>
            ))}
          </span>
          {!flat ? (
            <button
              onClick={() => {
                setRot({ x: 52, z: -18 });
                setZoom(1);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-hairline px-2 py-1 hover:bg-surface-2"
            >
              <RotateCcw className="size-3" /> Reset
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import { useMemo, useEffect, useRef, useState } from "react";
import { LegoPiece, type BrickColor } from "./LegoPiece";

/**
 * Shared floating LEGO brick background — the same effect from the Login page,
 * reusable on Dashboard, Events, and Profile.
 *
 * `density` controls how many pieces (default 12 — subtler than Login's 22).
 * `opacity` controls overall layer opacity (default 0.35 — background-level).
 */

type Piece = {
  cols: number;
  rows: number;
  color: BrickColor;
  x: number;
  y: number;
  rot: number;
  unit: number;
  blur: number;
  dur: number;
  delay: number;
};

const COLORS: BrickColor[] = ["yellow", "red", "blue", "black"];
const SHAPES = [
  { cols: 2, rows: 1 },
  { cols: 2, rows: 2 },
  { cols: 4, rows: 2 },
  { cols: 3, rows: 1 },
  { cols: 1, rows: 1 },
];

function buildPieces(count: number, seed = 20260427): Piece[] {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: count }).map((_, i) => {
    const x = rnd() * 100;
    const y = rnd() * 100;
    const dist = Math.hypot(x - 50, y - 50) / 70;
    const shape = SHAPES[Math.floor(rnd() * SHAPES.length)]!;
    return {
      cols: shape.cols,
      rows: shape.rows,
      color: COLORS[i % COLORS.length]!,
      x,
      y,
      rot: rnd() * 70 - 35,
      unit: 14 + rnd() * 12,
      blur: Math.min(5, Math.max(0, dist * 6)),
      dur: 7000 + rnd() * 6000,
      delay: rnd() * 3000,
    };
  });
}

export function BrickField({
  density = 12,
  opacity = 0.3,
  seed,
}: {
  density?: number;
  opacity?: number;
  seed?: number;
}) {
  const pieces = useMemo(() => buildPieces(density, seed), [density, seed]);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none)").matches) return;
    const onMove = (e: PointerEvent) => setPointer({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ opacity }}
      aria-hidden
    >
      {pieces.map((p, i) => {
        let dx = 0;
        let dy = 0;
        if (pointer && typeof window !== "undefined") {
          const px = (p.x / 100) * window.innerWidth;
          const py = (p.y / 100) * window.innerHeight;
          const vx = px - pointer.x;
          const vy = py - pointer.y;
          const d = Math.hypot(vx, vy);
          if (d < 220 && d > 0.5) {
            const force = (1 - d / 220) * 32;
            dx = (vx / d) * force;
            dy = (vy / d) * force;
          }
        }
        return (
          <div
            key={i}
            className="absolute transition-transform duration-700 ease-out"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: `translate3d(${dx}px, ${dy}px, 0)`,
              filter: `blur(${p.blur}px)`,
            }}
          >
            <div
              style={{
                // @ts-expect-error custom property
                "--piece-rot": `${p.rot}deg`,
                animation: `brick-drift ${p.dur}ms ease-in-out ${p.delay}ms infinite`,
              }}
            >
              <LegoPiece cols={p.cols} rows={p.rows} color={p.color} unit={p.unit} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

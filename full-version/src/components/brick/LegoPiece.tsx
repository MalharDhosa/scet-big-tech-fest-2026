import { cn } from "@/lib/utils";

export type BrickColor = "yellow" | "red" | "blue" | "black" | "white";

const COLORS: Record<BrickColor, { base: string; light: string; dark: string }> = {
  yellow: { base: "#FFD700", light: "#FFF08A", dark: "#B99700" },
  red: { base: "#C91A09", light: "#F26454", dark: "#8A1105" },
  blue: { base: "#0055BF", light: "#3F8BE8", dark: "#003377" },
  black: { base: "#0D0D0D", light: "#4A4A4A", dark: "#000000" },
  white: { base: "#FFFFFF", light: "#FFFFFF", dark: "#C6C6CC" },
};

/**
 * A realistically proportioned LEGO brick: correct stud grid, glossy plastic
 * shading and a soft ground shadow.
 */
export function LegoPiece({
  cols = 4,
  rows = 2,
  color = "yellow",
  unit = 22,
  className,
  style,
}: {
  cols?: number;
  rows?: number;
  color?: BrickColor;
  unit?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const c = COLORS[color];
  const w = cols * unit;
  const h = rows * unit;
  const studSize = unit * 0.56;

  return (
    <div
      className={cn("relative", className)}
      style={{ width: w, height: h + unit * 0.28, ...style }}
      aria-hidden
    >
      {/* body */}
      <div
        className="absolute inset-x-0 bottom-0 rounded-[3px]"
        style={{
          height: h,
          background: `linear-gradient(145deg, ${c.light} 0%, ${c.base} 42%, ${c.dark} 100%)`,
          boxShadow: `inset 0 ${unit * 0.1}px 0 rgba(255,255,255,0.25), inset 0 -${unit * 0.12}px 0 rgba(0,0,0,0.28), 0 ${unit * 0.35}px ${unit * 0.5}px rgba(13,13,13,0.28)`,
        }}
      />
      {/* studs */}
      <div
        className="absolute left-0 top-0 grid"
        style={{
          width: w,
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, ${unit}px)`,
          paddingTop: unit * 0.06,
        }}
      >
        {Array.from({ length: cols * rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-center" style={{ height: unit }}>
            <span
              className="rounded-full"
              style={{
                width: studSize,
                height: studSize,
                background: `radial-gradient(circle at 32% 28%, ${c.light} 0%, ${c.base} 55%, ${c.dark} 100%)`,
                boxShadow: `0 ${unit * 0.06}px ${unit * 0.12}px rgba(0,0,0,0.35), inset 0 -1px 2px rgba(0,0,0,0.3)`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export const PIECE_VARIANTS: Array<{ cols: number; rows: number }> = [
  { cols: 2, rows: 1 },
  { cols: 2, rows: 2 },
  { cols: 4, rows: 2 },
  { cols: 3, rows: 1 },
  { cols: 1, rows: 1 },
];

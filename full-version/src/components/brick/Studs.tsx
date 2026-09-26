import { cn } from "@/lib/utils";

/** A row of 3D embossed LEGO studs [•] sitting along the top edge of a surface. */
export function StudRow({
  count = 4,
  color = "#FFD700",
  className,
}: {
  count?: number;
  color?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute -top-3 left-0 z-20 flex w-full justify-center gap-3.5 px-4",
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="relative flex h-5 w-5 items-center justify-center rounded-full border-[2.5px] border-brick-black"
          style={{
            background: color || "#FFD700",
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.7), inset 0 -2px 0 rgba(0,0,0,0.25), 0 3px 0 #0D0D0D",
          }}
        >
          {/* Inner embossed center pip [•] */}
          <span
            className="h-1.5 w-1.5 rounded-full border border-brick-black/45 bg-brick-black/25"
            style={{
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
            }}
          />
        </span>
      ))}
    </div>
  );
}

/** Small circular stud badge — counts, statuses, bullets. */
export function StudBadge({
  children,
  color = "var(--brick-yellow)",
  className,
  title,
}: {
  children?: React.ReactNode;
  color?: string;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex min-h-6 min-w-6 items-center justify-center rounded-full border-[3px] border-brick-black px-1 font-display text-[11px] font-bold text-brick-black",
        className,
      )}
      style={{
        background: color,
        boxShadow:
          "inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.22), 2px 2px 0 rgba(13,13,13,0.7)",
      }}
    >
      {children}
    </span>
  );
}

/**
 * Brick Snapping Animation Loader (Phase 3)
 * Custom animation showing an isometric colored brick tumbling down and
 * satisfyingly snapping into place on top of a gray studded baseplate.
 */
export function BrickSnapLoader({
  size = 28,
  brickColor = "#FFD700",
  className,
}: {
  size?: number;
  brickColor?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("relative inline-flex flex-col items-center justify-center", className)}
      style={{ width: size, height: size * 1.15 }}
      role="status"
      aria-label="Loading"
    >
      {/* Falling & Snapping Isometric Colored Brick */}
      <svg
        width={size}
        height={size * 0.72}
        viewBox="0 0 40 28"
        fill="none"
        className="brick-snap-loader relative z-10 overflow-visible"
      >
        {/* Top Studs */}
        <ellipse cx="14" cy="5" rx="4.5" ry="2.2" fill={brickColor} stroke="#0D0D0D" strokeWidth="1.8" />
        <ellipse cx="26" cy="5" rx="4.5" ry="2.2" fill={brickColor} stroke="#0D0D0D" strokeWidth="1.8" />
        {/* Brick Top Face */}
        <polygon points="6,9 34,9 30,17 2,17" fill={brickColor} stroke="#0D0D0D" strokeWidth="1.8" />
        {/* Brick Front Face */}
        <polygon points="2,17 30,17 30,25 2,25" fill={brickColor} stroke="#0D0D0D" strokeWidth="1.8" />
        {/* Brick Right Face (shaded) */}
        <polygon points="30,17 34,9 34,17 30,25" fill="rgba(0,0,0,0.25)" stroke="#0D0D0D" strokeWidth="1.8" />
      </svg>

      {/* Gray Studded Baseplate (receiving the snap) */}
      <svg
        width={size * 1.15}
        height={size * 0.45}
        viewBox="0 0 46 16"
        fill="none"
        className="baseplate-stud-pulse -mt-1"
      >
        {/* Baseplate top face */}
        <polygon points="5,4 41,4 38,12 2,12" fill="#E5E7EB" stroke="#0D0D0D" strokeWidth="1.8" />
        {/* Baseplate studs */}
        <ellipse cx="15" cy="4" rx="3.5" ry="1.8" fill="#9CA3AF" stroke="#0D0D0D" strokeWidth="1.4" />
        <ellipse cx="29" cy="4" rx="3.5" ry="1.8" fill="#9CA3AF" stroke="#0D0D0D" strokeWidth="1.4" />
        {/* Baseplate front face */}
        <polygon points="2,12 38,12 38,15 2,15" fill="#9CA3AF" stroke="#0D0D0D" strokeWidth="1.8" />
      </svg>
    </span>
  );
}

/** Legacy OrbitLoader mapped to BrickSnapLoader for full thematic consistency */
export function OrbitLoader({
  size = 24,
  color = "var(--brick-yellow)",
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return <BrickSnapLoader size={size} brickColor={color} className={className || ""} />;
}

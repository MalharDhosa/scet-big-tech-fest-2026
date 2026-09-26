import { cn } from "@/lib/utils";

/**
 * InfoCard — the default, professional card for Dashboard, Events, and Profile.
 *
 * A calm rectangular surface: 1px border at ~15-20% opacity, one soft
 * single-direction drop shadow (not the chunky BrickCard shadow), 8-10px
 * border radius, white fill. At most ONE small brand detail per card —
 * a single stud in one corner, or a thin 3px colored top-edge accent line.
 */
export function InfoCard({
  children,
  className,
  accent,
  stud,
  style,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  /** Thin 3px top-edge accent color. Pass a CSS color string. */
  accent?: string;
  /** Show a single small stud in the top-right corner. */
  stud?: boolean;
}) {
  return (
    <div
      className={cn(
        "snap-in relative rounded-[8px] border border-brick-black/[0.12] bg-brick-white shadow-[0_2px_8px_rgba(0,0,0,0.07)]",
        className,
      )}
      style={style}
      {...rest}
    >
      {/* Optional thin top-edge accent stripe */}
      {accent && (
        <span
          className="absolute inset-x-0 top-0 h-[3px] rounded-t-[8px]"
          style={{ background: accent }}
          aria-hidden
        />
      )}

      {/* Optional single corner stud */}
      {stud && (
        <span
          className="absolute right-3 top-3 h-3.5 w-3.5 rounded-full border-[2px] border-brick-black/20"
          style={{
            background: accent ?? "var(--brick-yellow)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.15)",
          }}
          aria-hidden
        />
      )}

      {children}
    </div>
  );
}

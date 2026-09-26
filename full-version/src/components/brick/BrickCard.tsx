import { cn } from "@/lib/utils";
import { StudRow } from "./Studs";

export function BrickCard({
  children,
  className,
  studs = 4,
  studColor,
  surface = "white",
  style,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  studs?: number;
  studColor?: string;
  surface?: "white" | "blue-deep" | "yellow" | "red" | "blue";
}) {
  const surfaces: Record<string, string> = {
    white: "#FFFFFF",
    "blue-deep": "var(--brick-blue-deep)",
    yellow: "var(--brick-yellow)",
    red: "var(--brick-red)",
    blue: "var(--brick-blue)",
  };
  const bg = surfaces[surface] ?? "#FFFFFF";

  return (
    <div
      className={cn(
        "brick-bevel relative rounded-[5px] border-[3px] border-brick-black",
        surface === "white" || surface === "yellow" ? "text-brick-black" : "text-brick-white",
        className,
      )}
      style={{ background: bg, ...style }}
      {...rest}
    >
      {studs > 0 && (
        <StudRow
          count={studs}
          color={studColor ?? (surface === "white" ? "#FFD700" : bg)}
        />
      )}
      {children}
    </div>
  );
}

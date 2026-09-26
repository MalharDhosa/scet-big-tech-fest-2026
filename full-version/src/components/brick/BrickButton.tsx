import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Ripple = { id: number; x: number; y: number };

export function BrickButton({
  children,
  variant = "yellow",
  size = "md",
  className,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "yellow" | "red" | "blue" | "white" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const idRef = useRef(0);

  const palettes: Record<string, string> = {
    yellow: "bg-brick-yellow text-brick-black border-brick-black",
    red: "bg-brick-red text-brick-white border-brick-black",
    blue: "bg-brick-blue text-brick-white border-brick-black",
    white: "bg-brick-white text-brick-black border-brick-black",
    ghost: "bg-transparent text-brick-black border-brick-black",
  };
  const sizes: Record<string, string> = {
    sm: "px-3.5 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-base",
  };

  return (
    <button
      className={cn(
        "relative select-none overflow-hidden rounded-[5px] border-[3px] font-display font-bold uppercase tracking-[0.08em] cursor-pointer shimmer-on-hover",
        // Thematic LEGO Upgrade: Subtle bottom drop-shadow block & Plastic Click
        "shadow-[2.5px_4px_0_#0D0D0D]",
        "transition-[transform,box-shadow] duration-120 ease-[cubic-bezier(0.2,0.8,0.4,1)]",
        "hover:-translate-y-[2px] hover:shadow-[3.5px_6px_0_#0D0D0D]",
        "active:translate-y-[3px] active:translate-x-[1px] active:shadow-[1px_1px_0_#0D0D0D]",
        "disabled:cursor-not-allowed disabled:opacity-70 disabled:transform-none disabled:shadow-[2.5px_4px_0_#0D0D0D]",
        palettes[variant],
        sizes[size],
        className,
      )}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const id = idRef.current++;
        setRipples((p) => [...p, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
        setTimeout(() => setRipples((p) => p.filter((x) => x.id !== id)), 550);
        onClick?.(e);
      }}
      {...rest}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: r.x,
            top: r.y,
            width: 10,
            height: 10,
            marginLeft: -5,
            marginTop: -5,
            background: "rgba(255,255,255,0.55)",
            animation: "brick-ripple 500ms ease-out forwards",
          }}
        />
      ))}
      <span className="relative inline-flex items-center justify-center gap-2">{children}</span>
      <style>{`@keyframes brick-ripple{to{transform:scale(22);opacity:0}}`}</style>
    </button>
  );
}

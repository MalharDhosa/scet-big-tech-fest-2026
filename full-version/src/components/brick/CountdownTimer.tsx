import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import { useSiteConfig } from "@/lib/firebase-site-config";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

function calculateTimeLeft(targetDate: number): TimeLeft {
  const now = new Date().getTime();
  const diff = targetDate - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, isPast: false };
}

export function CountdownTimer({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "pill" | "hero";
}) {
  const { config } = useSiteConfig();
  const targetDateStr = config?.landing?.festStartDate || "2026-04-26T09:00:00";
  // Add +05:30 to interpret the time in IST properly if not already present
  const fullDateStr = targetDateStr.includes("+") || targetDateStr.includes("Z") 
    ? targetDateStr 
    : `${targetDateStr}+05:30`;
  const targetDateMs = new Date(fullDateStr).getTime();

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft(targetDateMs));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDateMs));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDateMs]);

  const pad = (n: number) => n.toString().padStart(2, "0");

  const segments = [
    { value: pad(timeLeft.days), label: "D", color: "#FFD700" },
    { value: pad(timeLeft.hours), label: "H", color: "#60A5FA" },
    { value: pad(timeLeft.minutes), label: "M", color: "#F87171" },
    { value: pad(timeLeft.seconds), label: "S", color: "#4ADE80" },
  ];

  if (variant === "pill") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-[5px] border-[2px] border-brick-black bg-white px-2.5 py-1 text-xs shadow-[2px_2px_0_#0D0D0D]",
          className,
        )}
      >
        <span className="relative flex h-2 w-2 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brick-red opacity-75" />
          <span className="relative inline-block h-2 w-2 rounded-full border border-brick-black bg-brick-red" />
        </span>
        <span className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-brick-black/60">
          Starts In:
        </span>
        <span className="font-mono text-xs font-black tracking-wider text-brick-black">
          {timeLeft.days}d {pad(timeLeft.hours)}h {pad(timeLeft.minutes)}m {pad(timeLeft.seconds)}s
        </span>
      </div>
    );
  }

  // Small & Professional Live Countdown Timer Bar
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2.5 rounded-[5px] border-[2px] border-brick-black bg-[#12131A] px-3 py-2 text-white shadow-[2.5px_2.5px_0_#0D0D0D]",
        className,
      )}
    >
      {/* Left: Label */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <span className="font-display text-[10px] font-bold uppercase tracking-[0.16em] text-brick-yellow leading-tight">
            Live Kickoff
          </span>
          <span className="font-mono text-[8px] text-white/50 tracking-tight leading-tight">
            26 APR 2K26
          </span>
        </div>
      </div>

      {/* Right: 4 Sleek Micro-Segments */}
      <div className="flex items-center gap-1.5 font-mono">
        {segments.map((seg, i) => (
          <div key={seg.label} className="flex items-center gap-1">
            <div className="flex items-baseline gap-0.5 rounded-[3px] border border-white/15 bg-white/[0.08] px-1.5 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
              <span className="text-xs font-black tracking-wider text-white sm:text-sm">
                {seg.value}
              </span>
              <span
                className="text-[8px] font-bold uppercase tracking-wider"
                style={{ color: seg.color }}
              >
                {seg.label}
              </span>
            </div>
            {i < segments.length - 1 && (
              <span className="text-[10px] font-bold text-white/35 animate-pulse">:</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

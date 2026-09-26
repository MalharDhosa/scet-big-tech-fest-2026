import { useId } from "react";
import { cn } from "@/lib/utils";

export function BrickInput({
  label,
  hint,
  invalid,
  onDark,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  invalid?: boolean;
  onDark?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex w-full flex-col gap-2">
      <label
        htmlFor={id}
        className={cn(
          "font-display text-xs sm:text-[13px] font-bold uppercase tracking-[0.14em]",
          onDark ? "text-brick-white" : "text-brick-black/85",
        )}
      >
        {label}
      </label>
      <input
        id={id}
        className={cn(
          "slot-inset w-full rounded-[4px] border-[3px] px-4 py-3.5 font-body text-sm outline-none transition-[box-shadow,border-color] duration-150",
          onDark
            ? "border-brick-black bg-[#001f5c] text-white font-medium placeholder:text-[#E2E8F0]"
            : "border-brick-black bg-[#dcdce2] text-brick-black placeholder:text-brick-black/50",
          invalid
            ? "border-brick-red shadow-[0_0_0_3px_rgba(201,26,9,0.45)]"
            : "focus:border-brick-yellow focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.4),0_0_0_3px_rgba(255,215,0,0.45)]",
          className,
        )}
        {...rest}
      />
      {hint && (
        <p className={cn("font-body text-xs", onDark ? "text-brick-white/60" : "text-brick-black/60")}>
          {hint}
        </p>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { Instagram } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventFloatingSocialsProps {
  whatsappUrl?: string | undefined;
  instagramUrl?: string | undefined;
  eventTitle?: string | undefined;
  promptText?: string | undefined;
  tooltipText?: string | undefined;
  className?: string | undefined;
}

export function EventFloatingSocials({
  whatsappUrl,
  instagramUrl,
  eventTitle,
  promptText,
  tooltipText,
  className,
}: EventFloatingSocialsProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Animate speech bubble message when event page opens, then auto-dismiss after ~3.8 seconds
  useEffect(() => {
    const enterTimer = setTimeout(() => {
      setShowPrompt(true);
    }, 450);

    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 3800);

    const removeTimer = setTimeout(() => {
      setShowPrompt(false);
      setIsExiting(false);
    }, 4200);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3200);
  };

  const handleWhatsAppClick = () => {
    const trimmed = whatsappUrl?.trim();
    if (
      trimmed &&
      (trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("whatsapp://"))
    ) {
      window.open(trimmed, "_blank", "noopener,noreferrer");
    } else {
      showToast(
        eventTitle
          ? `WhatsApp group link for ${eventTitle} will be shared shortly!`
          : "WhatsApp group link will be shared shortly!"
      );
    }
  };

  const handleInstagramClick = () => {
    const trimmed = instagramUrl?.trim();
    if (trimmed && (trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
      window.open(trimmed, "_blank", "noopener,noreferrer");
    } else {
      // Fall back to main festival Instagram
      window.open("https://www.instagram.com/converse_2k26/", "_blank", "noopener,noreferrer");
    }
  };

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[150] animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-none">
          <div className="flex items-center gap-2 rounded-[8px] border-[2.5px] border-black bg-[#FFE817] px-4 py-2 text-xs font-display font-bold uppercase tracking-wider text-black shadow-[4px_4px_0_#0D0D0D]">
            <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Floating Action Buttons (Bottom Right) */}
      <div
        className={cn(
          "fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-3",
          className
        )}
      >
        {/* WhatsApp Group Button (Square) */}
        <div className="group relative flex items-center">
          {/* Animated "Click to join the group" Speech Bubble on Mount */}
          {showPrompt && (
            <div
              onClick={handleWhatsAppClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleWhatsAppClick();
                }
              }}
              aria-label="Click to join WhatsApp group"
              className={cn(
                "absolute right-full mr-3 top-1/2 -translate-y-1/2 z-50 cursor-pointer select-none whitespace-nowrap",
                "flex items-center gap-1.5 rounded-[8px] border-[2.5px] border-black bg-[#FFE817] px-3 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-display font-extrabold uppercase tracking-wider text-black shadow-[3px_3px_0_#0D0D0D]",
                "transition-all duration-300 ease-out hover:-translate-x-1 hover:shadow-[4px_4px_0_#0D0D0D] active:translate-x-0 active:shadow-[1px_1px_0_#0D0D0D]",
                isExiting
                  ? "opacity-0 translate-x-3 scale-95 pointer-events-none"
                  : "opacity-100 translate-x-0 scale-100 animate-in fade-in slide-in-from-right-3 duration-300"
              )}
            >
              {/* Caret arrow pointing towards the WhatsApp square button */}
              <div className="absolute -right-[7px] top-1/2 -translate-y-1/2 h-3 w-3 rotate-45 border-t-[2.5px] border-r-[2.5px] border-black bg-[#FFE817]" />
              
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              <span>{promptText || "Click to join the group!"}</span>
              <span className="text-xs sm:text-sm">👉</span>
            </div>
          )}

          {/* Hover Tooltip (Shown when prompt is not active) */}
          {!showPrompt && (
            <div className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-[6px] border-[2px] border-black bg-black px-2.5 py-1 text-[11px] font-display font-bold uppercase tracking-wider text-white shadow-[2px_2px_0_rgba(0,0,0,0.5)] group-hover:block transition-all">
              <span>
                {tooltipText ||
                  (whatsappUrl
                    ? eventTitle
                      ? `Join ${eventTitle} Group`
                      : "Join WhatsApp Group"
                    : "WhatsApp Group (Coming Soon)")}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleWhatsAppClick}
            aria-label="Join Event WhatsApp Group"
            className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-[10px] sm:rounded-xl border-[2.5px] border-black bg-[#25D366] text-white shadow-[3px_3px_0_#0D0D0D] transition-all duration-150 hover:-translate-y-1 hover:shadow-[5px_5px_0_#0D0D0D] active:translate-y-0 active:shadow-[1px_1px_0_#0D0D0D] cursor-pointer"
          >
            {/* WhatsApp SVG Icon */}
            <svg
              className="h-6 w-6 fill-white"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.979-.276-.1-.476-.15-.677.15-.201.3-.778.979-.953 1.18-.175.2-.351.226-.652.075-.3-.151-1.267-.467-2.413-1.488-.893-.795-1.496-1.777-1.671-2.078-.175-.3-.019-.462.132-.612.136-.135.301-.351.451-.527.151-.176.201-.3.301-.501.101-.2.05-.376-.025-.526-.075-.151-.677-1.632-.928-2.235-.245-.588-.493-.509-.677-.518-.176-.01-.376-.01-.577-.01-.201 0-.527.075-.802.376-.276.3-1.054 1.03-1.054 2.512 0 1.482 1.079 2.913 1.23 3.114.15.201 2.124 3.243 5.145 4.549.719.311 1.28.497 1.718.636.722.23 1.379.197 1.899.12.579-.087 1.78-.728 2.031-1.431.251-.703.251-1.305.176-1.431-.076-.126-.276-.201-.577-.352zM12.04 21.75c-1.748 0-3.461-.469-4.966-1.359l-.356-.21-3.693.968.985-3.6-.231-.368A9.708 9.708 0 0 1 2.3 12.04C2.3 6.67 6.67 2.3 12.04 2.3c2.607 0 5.059 1.015 6.902 2.859 1.844 1.843 2.858 4.295 2.858 6.901 0 5.37-4.37 9.69-9.76 9.69zm7.962-16.662A11.233 11.233 0 0 0 12.04.8C5.83.8.766 5.864.766 12.074c0 1.984.518 3.921 1.503 5.626L.8 23.2l5.65-1.482a11.258 11.258 0 0 0 5.59 1.482h.005c6.208 0 11.272-5.064 11.272-11.274 0-3.011-1.173-5.842-3.315-7.988z" />
            </svg>
          </button>
        </div>

        {/* Instagram Button (Square) */}
        <div className="group relative flex items-center">
          {/* Tooltip */}
          <div className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-[6px] border-[2px] border-black bg-black px-2.5 py-1 text-[11px] font-display font-bold uppercase tracking-wider text-white shadow-[2px_2px_0_rgba(0,0,0,0.5)] group-hover:block transition-all">
            <span>{instagramUrl ? "View Event Instagram" : "Festival Instagram"}</span>
          </div>

          <button
            type="button"
            onClick={handleInstagramClick}
            aria-label="View Event on Instagram"
            className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-[10px] sm:rounded-xl border-[2.5px] border-black text-white shadow-[3px_3px_0_#0D0D0D] transition-all duration-150 hover:-translate-y-1 hover:shadow-[5px_5px_0_#0D0D0D] active:translate-y-0 active:shadow-[1px_1px_0_#0D0D0D] cursor-pointer"
            style={{
              background:
                "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)",
            }}
          >
            <Instagram className="h-6 w-6 stroke-[2.2]" />
          </button>
        </div>
      </div>
    </>
  );
}

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn, ZoomOut, RotateCcw, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PosterZoomModalProps {
  posterUrl: string;
  title: string;
  onClose: () => void;
}

export function PosterZoomModal({ posterUrl, title, onClose }: PosterZoomModalProps) {
  const [mounted, setMounted] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMovedRef = useRef(false);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  // Non-passive wheel listener for smooth zooming without page scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const zoomFactor = e.deltaY < 0 ? 0.25 : -0.25;
      setScale((prevScale) => {
        const nextScale = Math.min(4, Math.max(1, +(prevScale + zoomFactor).toFixed(2)));
        if (nextScale === 1) {
          setPosition({ x: 0, y: 0 });
        }
        return nextScale;
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(4, +(prev + 0.35).toFixed(2)));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(1, +(prev - 0.35).toFixed(2));
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      handleResetZoom();
    } else {
      setScale(2.5);
    }
  };

  // Mouse Drag / Panning Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    if (scale <= 1) return; // Only pan when zoomed in
    e.preventDefault();
    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    hasMovedRef.current = true;
    const nextX = e.clientX - dragStartRef.current.x;
    const nextY = e.clientY - dragStartRef.current.y;
    setPosition({ x: nextX, y: nextY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !hasMovedRef.current) {
      onClose();
    }
  };

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/92 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={handleBackdropClick}
    >
      {/* Top Bar with Title and Close */}
      <div className="absolute top-4 sm:top-6 left-4 sm:left-6 right-4 sm:right-6 z-30 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/25 bg-black/80 px-4 py-2 backdrop-blur-md text-xs font-display font-bold uppercase tracking-wider text-white shadow-xl">
          <span className="h-2 w-2 rounded-full bg-[#FFD700] animate-pulse shrink-0" />
          <span className="truncate max-w-[200px] sm:max-w-md">{title.toLowerCase().includes("poster") ? title : `${title} Poster`}</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border-[2.5px] border-black bg-brick-yellow text-brick-black shadow-[3px_3px_0_#000] hover:scale-110 active:scale-95 transition-all cursor-pointer"
          title="Close (Esc)"
          aria-label="Close"
        >
          <X className="h-6 w-6 stroke-[2.5]" />
        </button>
      </div>

      {/* Interactive Poster Viewport */}
      <div
        ref={containerRef}
        className={cn(
          "relative flex h-full max-h-[88vh] w-full max-w-4xl items-center justify-center overflow-hidden rounded-2xl",
          scale > 1
            ? isDragging
              ? "cursor-grabbing"
              : "cursor-grab"
            : "cursor-zoom-in"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={posterUrl}
          alt={`${title} Full Poster`}
          draggable={false}
          className="max-h-[82vh] w-auto max-w-full rounded-xl object-contain shadow-2xl transition-transform duration-75 will-change-transform"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          }}
        />
      </div>

      {/* Floating Bottom Control Deck */}
      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
        {/* Interaction Hint */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[11px] font-body text-white/80 backdrop-blur-md shadow-lg">
          <MousePointer2 className="h-3 w-3 text-[#FFD700]" />
          <span>Scroll mouse wheel to zoom in/out • Drag to pan • Double-click to reset</span>
        </div>

        {/* Floating Zoom Controls Pill */}
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border-2 border-black bg-white px-2.5 py-1.5 shadow-[3px_3px_0_#000]">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer text-brick-black"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          <span className="min-w-[48px] text-center font-mono text-xs font-bold text-brick-black">
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 4}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer text-brick-black"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          <div className="h-4 w-[1.5px] bg-neutral-300 mx-0.5" />

          <button
            type="button"
            onClick={handleResetZoom}
            disabled={scale === 1 && position.x === 0 && position.y === 0}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer text-brick-black"
            title="Reset Zoom (100%)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

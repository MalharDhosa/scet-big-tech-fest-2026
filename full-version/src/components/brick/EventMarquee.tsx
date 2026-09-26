import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { FEST_EVENTS, type FestEvent } from "@/lib/fest-state";
import { useFirestoreEvents } from "@/lib/firebase-events";
import { getEventSlug } from "@/lib/event-slugs";
import { parseEventTeamSize } from "@/lib/firebase-registrations";
import { cn } from "@/lib/utils";
import {
  Clock,
  MapPin,
  Users,
  Award,
  Shield,
  HelpCircle,
  Terminal,
  Cpu,
  Bot,
  BarChart3,
  Sparkles,
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  Shield,
  HelpCircle,
  Terminal,
  Cpu,
  Bot,
  BarChart3,
  Sparkles,
};

export function EventMarquee() {
  const { events: fsEvents } = useFirestoreEvents();
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [activeCategory, setActiveCategory] = useState<"TECH" | "NON-TECH">("TECH");
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Interaction refs (to avoid re-renders in RAF loop)
  const isInteractingRef = useRef(false);
  const isPointerDownRef = useRef(false);
  const hasMovedRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedScrollRef = useRef(0);
  const lastTimestampRef = useRef(0);

  // Dynamically merged events partitioned into TECH and NON-TECH
  const { techEvents, nonTechEvents } = useMemo(() => {
    const list = FEST_EVENTS.map((fe, idx) => {
      const dynamicEvent = fsEvents.find((e) => e.id === fe.id);
      const merged = { ...fe, ...(dynamicEvent || {}) };
      merged.number = merged.number || `#0${idx + 1}`;
      return merged as FestEvent;
    });

    fsEvents.forEach((fe) => {
      if (!list.some((e) => e.id === fe.id)) {
        list.push({
          ...fe,
          number: fe.number || `#0${list.length + 1}`,
        } as FestEvent);
      }
    });

    const seenTech = new Set<string>();
    const tech: FestEvent[] = [];
    const seenNonTech = new Set<string>();
    const nonTech: FestEvent[] = [];

    list.forEach((e) => {
      const key = (e.id || e.title).toLowerCase().trim();
      const cleanTrack = (e.track || "").replace(/ TRACK$/i, "").trim().toUpperCase();
      const isTech = cleanTrack === "TECH" || cleanTrack === "IT";
      const isNonTech =
        cleanTrack === "NON-TECH" ||
        cleanTrack === "NON TECH" ||
        cleanTrack === "NONTECH" ||
        cleanTrack.includes("NON") ||
        cleanTrack === "AIDS";

      if (isTech && !seenTech.has(key)) {
        seenTech.add(key);
        tech.push(e);
      } else if (isNonTech && !seenNonTech.has(key)) {
        seenNonTech.add(key);
        nonTech.push(e);
      }
    });

    return {
      techEvents: tech.slice(0, 7), // 7 flagship tech challenges
      nonTechEvents: nonTech,
    };
  }, [fsEvents]);

  // Current events list based on activeCategory
  const currentEvents = activeCategory === "TECH" ? techEvents : nonTechEvents;

  // Build a base array with at least 6 items so the marquee has plenty of width to loop seamlessly
  const baseEvents = useMemo(() => {
    if (currentEvents.length === 0) return [];
    let expanded = [...currentEvents];
    while (expanded.length < 6) {
      expanded = [...expanded, ...currentEvents];
    }
    return expanded;
  }, [currentEvents]);

  // Quadruple events array for seamless infinite looping in both directions
  const marqueeEvents = useMemo(() => {
    if (baseEvents.length === 0) return [];
    return [...baseEvents, ...baseEvents, ...baseEvents, ...baseEvents];
  }, [baseEvents]);

  // Initialize or reset scroll position into the middle set
  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track || marqueeEvents.length === 0) return;

    const initPosition = () => {
      const singleSetWidth = track.scrollWidth / 4;
      if (singleSetWidth > 0) {
        container.scrollLeft = singleSetWidth;
        accumulatedScrollRef.current = singleSetWidth;
      }
    };

    initPosition();
    const t = setTimeout(initPosition, 80);
    return () => clearTimeout(t);
  }, [activeCategory, marqueeEvents]);

  // Continuous smooth auto-scroll loop
  useEffect(() => {
    const SPEED_PX_PER_SEC = 52;
    let animId: number;

    const step = (timestamp: number) => {
      if (!lastTimestampRef.current) {
        lastTimestampRef.current = timestamp;
      }
      const delta = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      const container = containerRef.current;
      const track = trackRef.current;

      if (container && track && !isInteractingRef.current && !isHovered) {
        const singleSetWidth = track.scrollWidth / 4;
        if (singleSetWidth > 0) {
          // Increment position smoothly
          accumulatedScrollRef.current += SPEED_PX_PER_SEC * Math.min(delta, 0.1);

          // Wrap seamlessly within middle sets
          if (accumulatedScrollRef.current >= singleSetWidth * 2) {
            accumulatedScrollRef.current -= singleSetWidth;
          } else if (accumulatedScrollRef.current < singleSetWidth) {
            accumulatedScrollRef.current += singleSetWidth;
          }

          container.scrollLeft = accumulatedScrollRef.current;
        }
      }

      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isHovered]);

  // Handle native scroll (manages touch swiping & boundary wrap)
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const singleSetWidth = track.scrollWidth / 4;
    if (singleSetWidth <= 0) return;

    const currentLeft = container.scrollLeft;

    // If user scrolled past either edge boundary, loop back imperceptibly
    if (currentLeft >= singleSetWidth * 2.5) {
      container.scrollLeft -= singleSetWidth;
      accumulatedScrollRef.current = container.scrollLeft;
    } else if (currentLeft <= singleSetWidth * 0.5) {
      container.scrollLeft += singleSetWidth;
      accumulatedScrollRef.current = container.scrollLeft;
    } else if (isInteractingRef.current) {
      accumulatedScrollRef.current = currentLeft;
    }
  }, []);

  // Schedule resuming auto-scroll after touch/drag ends
  const scheduleResume = useCallback((delay = 1000) => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      if (containerRef.current) {
        accumulatedScrollRef.current = containerRef.current.scrollLeft;
      }
      lastTimestampRef.current = performance.now();
      isInteractingRef.current = false;
      setIsDragging(false);
      // Give a tiny buffer before clearing moved flag so pending clicks don't fire
      setTimeout(() => {
        hasMovedRef.current = false;
      }, 60);
    }, delay);
  }, []);

  // Touch handlers for mobile/tablet
  const handleTouchStart = () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    isInteractingRef.current = true;
    hasMovedRef.current = false;
  };

  const handleTouchMove = () => {
    isInteractingRef.current = true;
    hasMovedRef.current = true;
  };

  const handleTouchEnd = () => {
    scheduleResume(1000);
  };

  // Mouse drag handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // left click only
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    isPointerDownRef.current = true;
    isInteractingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX;
    scrollLeftStartRef.current = containerRef.current?.scrollLeft || 0;
    setIsDragging(true);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isPointerDownRef.current || !containerRef.current) return;
      const dx = e.pageX - startXRef.current;
      if (Math.abs(dx) > 5) {
        hasMovedRef.current = true;
      }
      containerRef.current.scrollLeft = scrollLeftStartRef.current - dx;
    };

    const handleGlobalMouseUp = () => {
      if (isPointerDownRef.current) {
        isPointerDownRef.current = false;
        scheduleResume(1000);
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [scheduleResume]);

  // Intercept click on links if user was dragging
  const handleCardClickCapture = (e: React.MouseEvent) => {
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <section className="relative w-full overflow-hidden py-4 sm:py-8">
      <style>{`
        .hide-marquee-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hide-marquee-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Header Eyebrow & Title */}
      <div className="mx-auto max-w-5xl px-4 mb-6 sm:mb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brick-black/20 bg-brick-yellow/30 px-3.5 py-1 text-[11px] font-display font-bold uppercase tracking-[0.16em] text-brick-black shadow-sm mb-2.5">
          <Sparkles className="h-3 w-3 text-brick-black" />
          <span>FLAGSHIP COMPETITIONS</span>
        </div>
        <h2 className="font-display text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-[0.06em] text-[#003399]">
          Explore Converse 2K26 Events
        </h2>
        <p className="mt-1.5 font-body text-xs sm:text-sm text-brick-black/70 max-w-xl mx-auto">
          {activeCategory === "TECH"
            ? "7 High-stakes challenges across AI, Web, Cloud & Security. Drag or swipe to explore, tap any event to inspect full rules."
            : "Thrilling strategy, detective & auction challenges. Drag or swipe to explore, tap any event to inspect full rules."}
        </p>

        {/* Category Switcher Buttons (TECH / NON TECH) */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setActiveCategory("TECH")}
            className={cn(
              "relative rounded-[6px] border-[3px] border-black px-6 pb-2 pt-3.5 font-display text-xs sm:text-sm font-black uppercase tracking-[0.12em] transition-all duration-150 cursor-pointer select-none",
              activeCategory === "TECH"
                ? "translate-y-[2px] bg-brick-yellow text-brick-black shadow-[1.5px_1.5px_0_#000000]"
                : "bg-white text-brick-black/60 hover:text-brick-black hover:-translate-y-0.5 shadow-[3.5px_3.5px_0_#000000] active:translate-y-[2px] active:shadow-[1px_1px_0_#000000]"
            )}
          >
            <span className="absolute left-1/2 top-[3px] flex -translate-x-1/2 gap-1.5 pointer-events-none">
              <span className="h-1.5 w-1.5 rounded-full border border-black/30 bg-black/20" />
              <span className="h-1.5 w-1.5 rounded-full border border-black/30 bg-black/20" />
            </span>
            TECH
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("NON-TECH")}
            className={cn(
              "relative rounded-[6px] border-[3px] border-black px-6 pb-2 pt-3.5 font-display text-xs sm:text-sm font-black uppercase tracking-[0.12em] transition-all duration-150 cursor-pointer select-none",
              activeCategory === "NON-TECH"
                ? "translate-y-[2px] bg-[#38BDF8] text-brick-black shadow-[1.5px_1.5px_0_#000000]"
                : "bg-white text-brick-black/60 hover:text-brick-black hover:-translate-y-0.5 shadow-[3.5px_3.5px_0_#000000] active:translate-y-[2px] active:shadow-[1px_1px_0_#000000]"
            )}
          >
            <span className="absolute left-1/2 top-[3px] flex -translate-x-1/2 gap-1.5 pointer-events-none">
              <span className="h-1.5 w-1.5 rounded-full border border-black/30 bg-black/20" />
              <span className="h-1.5 w-1.5 rounded-full border border-black/30 bg-black/20" />
            </span>
            NON TECH
          </button>
        </div>
      </div>

      {/* Marquee Track Container with Full Touch & Mouse Drag Interactivity */}
      <div
        ref={containerRef}
        className={cn(
          "w-full overflow-x-auto overflow-y-hidden py-3 hide-marquee-scrollbar select-none",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
        onScroll={handleScroll}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          if (!isPointerDownRef.current) {
            scheduleResume(500);
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onDragStart={(e) => e.preventDefault()}
      >
        <div
          ref={trackRef}
          className="flex w-max will-change-transform"
          onClickCapture={handleCardClickCapture}
        >
          {marqueeEvents.map((ev, index) => {
            const slug = getEventSlug(ev);
            const teamInfo = parseEventTeamSize(ev.format || "");
            const Icon = (ev.iconName && ICON_MAP[ev.iconName]) || Terminal;
            const cleanCardTrack = (ev.track || "").replace(/ TRACK$/i, "").trim().toUpperCase();
            const isCardNonTech =
              cleanCardTrack === "NON-TECH" ||
              cleanCardTrack === "NON TECH" ||
              cleanCardTrack === "NONTECH" ||
              cleanCardTrack.includes("NON") ||
              cleanCardTrack === "AIDS";

            return (
              <div
                key={`${ev.id}-${index}`}
                className="px-2.5 sm:px-3.5 shrink-0"
              >
                <Link
                  to="/$eventId"
                  params={{ eventId: slug }}
                  className={cn(
                    "group relative flex flex-col justify-between rounded-[6px] border-[3.5px] border-black bg-white p-4 sm:p-5 select-none cursor-pointer overflow-hidden transition-all duration-150 no-underline text-inherit block",
                    "w-[275px] sm:w-[315px] md:w-[340px] min-h-[280px] sm:min-h-[295px]",
                    "shadow-[4px_4px_0_#0D0D0D] sm:shadow-[5px_5px_0_#0D0D0D] hover:-translate-y-1.5 hover:shadow-[7px_7px_0_#0D0D0D] active:translate-y-0 active:shadow-[2px_2px_0_#0D0D0D]"
                  )}
                >
                  {/* Lego Studs along Top Edge */}
                  <div
                    className="pointer-events-none absolute -top-3.5 left-0 right-0 z-20 flex items-center justify-center gap-3"
                    aria-hidden
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          "relative flex h-4.5 w-4.5 items-center justify-center rounded-full border-[2px] border-black shadow-[0_2px_0_#000000]",
                          isCardNonTech ? "bg-[#38BDF8]" : "bg-brick-yellow"
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full border border-black/40 bg-black/20" />
                      </span>
                    ))}
                  </div>

                  {/* Top Bar: Number + Track + Format */}
                  <div>
                    <div className="flex items-center justify-between gap-1.5 pt-1 mb-3">
                      <span className="font-mono text-xs font-bold text-brick-black/60">
                        {ev.number || `#0${(index % (currentEvents.length || 1)) + 1}`}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded-[3px] border border-black px-2 py-0.5 font-display text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.08em] shadow-[1px_1px_0_#0D0D0D]",
                            isCardNonTech ? "bg-[#38BDF8] text-brick-black" : "bg-brick-yellow text-brick-black"
                          )}
                        >
                          {isCardNonTech ? "NON-TECH TRACK" : "TECH TRACK"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-[3px] border border-black/20 bg-neutral-100 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase text-neutral-700">
                          <Users className="h-2.5 w-2.5" />
                          {teamInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Logo / Icon & Title */}
                    <div className="flex items-center gap-3 mb-2.5">
                      {ev.logoUrl ? (
                        <img
                          src={ev.logoUrl}
                          alt={ev.title}
                          className="h-11 w-11 sm:h-12 sm:w-12 shrink-0 rounded-lg border-2 border-black object-contain bg-white p-1 shadow-[2px_2px_0_#0D0D0D]"
                        />
                      ) : (
                        <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-[#FFD700] text-brick-black shadow-[2px_2px_0_#0D0D0D]">
                          <Icon className="h-6 w-6" />
                        </div>
                      )}

                      <h3 className="font-display text-base sm:text-lg font-black uppercase leading-snug tracking-tight text-brick-black line-clamp-2">
                        {ev.title}
                      </h3>
                    </div>

                    {/* Description snippet */}
                    <p className="font-body text-xs leading-relaxed text-neutral-600 line-clamp-2 mb-3">
                      {ev.desc || "Flagship technology challenge featuring hands-on tasks and cash rewards."}
                    </p>
                  </div>

                  {/* Bottom Meta */}
                  <div className="space-y-2.5 pt-2 border-t border-dashed border-neutral-200">
                    {/* Prize Ribbon */}
                    <div className="flex items-center gap-1.5 rounded-[4px] border border-brick-black/20 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                      <Award className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">{ev.prize || "Credits + Certificate"}</span>
                    </div>

                    {/* Time & Venue */}
                    <div className="flex items-center justify-between text-[10px] text-neutral-500 font-medium">
                      <span className="inline-flex items-center gap-1 truncate max-w-[55%]">
                        <Clock className="h-3 w-3 text-neutral-400 shrink-0" />
                        {ev.time || "10:00 AM"}
                      </span>
                      <span className="inline-flex items-center gap-1 truncate max-w-[42%] text-right">
                        <MapPin className="h-3 w-3 text-neutral-400 shrink-0" />
                        {ev.venue || "SCET Lab"}
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

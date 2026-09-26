import { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Download,
  Maximize2,
  Sparkles,
  Compass,
} from "lucide-react";
import { PosterZoomModal } from "@/components/brick/PosterZoomModal";
import { cn } from "@/lib/utils";

interface EventRoadmapSectionProps {
  variant?: "landing" | "dashboard";
  id?: string;
  className?: string;
}

export function EventRoadmapSection({
  variant = "landing",
  id = "roadmap-section",
  className,
}: EventRoadmapSectionProps) {
  const [showZoomModal, setShowZoomModal] = useState(false);
  const [activeDay, setActiveDay] = useState<1 | 2>(1);

  const day1Schedule = [
    { time: "10:00 AM - 11:00 AM", title: "Logo Hunt", venue: "Lab - 1, 2 & 4", color: "#FFD700" },
    { time: "11:00 AM - 12:00 PM", title: "IT Quiz", venue: "Lab - 1, 2, 3 & 4", color: "#0055BF" },
    { time: "12:00 PM - 12:45 PM", title: "Cyber Quiz", venue: "Lab - 1 & 4", color: "#C91A09" },
    { time: "12:00 PM - 12:45 PM", title: "Bug Buzz", venue: "Lab - 2 & 3", color: "#E8B800" },
    { time: "1:30 PM - 2:15 PM", title: "PY-IT", venue: "Lab - 1, 2 & 4", color: "#00853E" },
    { time: "2:15 PM - 4:15 PM", title: "Codathon", venue: "Lab - 1, 2 & 4", color: "#0055BF" },
  ];

  const day2Schedule = [
    { time: "9:00 AM - 11:00 AM", title: "AWS Builder Challenge", venue: "Lab - 1 & 4", color: "#FF9900" },
  ];

  return (
    <section id={id} className={cn("relative w-full overflow-hidden scroll-mt-20", className)}>
      <div className="mx-auto max-w-5xl px-3 sm:px-6 py-6 sm:py-10">
        {/* Section Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-brick-black/25 bg-brick-yellow/30 px-3.5 py-1 text-[11px] font-display font-bold uppercase tracking-[0.16em] text-brick-black shadow-sm mb-2.5">
            <Compass className="h-3.5 w-3.5 text-brick-black" />
            <span>OFFICIAL TIMELINE & VENUE ROADMAP</span>
          </div>
          <h2 className="font-display text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-[0.04em] text-[#003399]">
            Championship Event Roadmap
          </h2>
          <p className="mt-2 font-body text-xs sm:text-sm text-brick-black/70 max-w-xl mx-auto leading-relaxed">
            Follow the winding master route across 18th & 19th September. Check event timings, architecture lab venues, and tap to view in high resolution.
          </p>
        </div>

        {/* Spacious 2-Column Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          {/* Left Column: Interactive Day Navigator & Highlights */}
          <div className="lg:col-span-6 flex flex-col justify-between">
            <div className="rounded-[8px] border-[3px] border-brick-black bg-white p-5 sm:p-6 shadow-[5px_5px_0_#0D0D0D] flex-1 flex flex-col justify-between">
              <div>
                {/* Header with Day Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pb-4 border-b border-brick-black/15">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-[5px] border-[2px] border-brick-black bg-brick-yellow font-display text-xs font-black text-brick-black">
                      02
                    </span>
                    <div>
                      <h3 className="font-display text-sm sm:text-base font-black uppercase tracking-tight text-brick-black">
                        Day-by-Day Schedule
                      </h3>
                      <p className="font-body text-[11px] text-brick-black/60">
                        September 18th & 19th, 2026
                      </p>
                    </div>
                  </div>

                  {/* Day Tabs */}
                  <div className="flex gap-1.5 bg-brick-black/5 p-1 rounded-[6px] border border-brick-black/15">
                    <button
                      type="button"
                      onClick={() => setActiveDay(1)}
                      className={cn(
                        "px-3 py-1 rounded-[4px] font-display text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                        activeDay === 1
                          ? "bg-brick-yellow text-brick-black shadow-[1.5px_1.5px_0_#0D0D0D] border border-brick-black"
                          : "text-brick-black/65 hover:text-brick-black"
                      )}
                    >
                      Day 1 (18th)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDay(2)}
                      className={cn(
                        "px-3 py-1 rounded-[4px] font-display text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                        activeDay === 2
                          ? "bg-brick-blue text-brick-white shadow-[1.5px_1.5px_0_#0D0D0D] border border-brick-black"
                          : "text-brick-black/65 hover:text-brick-black"
                      )}
                    >
                      Day 2 (19th)
                    </button>
                  </div>
                </div>

                {/* Timeline Events List */}
                <div className="mt-4 space-y-2">
                  {(activeDay === 1 ? day1Schedule : day2Schedule).map((item, idx) => (
                    <div
                      key={idx}
                      className="group flex items-center justify-between gap-3 rounded-[6px] border-[1.5px] border-brick-black/15 bg-neutral-50/80 p-2.5 sm:p-3 transition-all hover:bg-white hover:border-brick-black hover:shadow-[2px_2px_0_#0D0D0D]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="h-3 w-3 rounded-full border border-brick-black shrink-0"
                          style={{
                            backgroundColor: item.color,
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
                          }}
                        />
                        <div className="min-w-0">
                          <h4 className="font-display text-xs sm:text-sm font-bold uppercase tracking-wide text-brick-black truncate">
                            {item.title}
                          </h4>
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] sm:text-[11px] text-brick-black/65">
                            <Clock className="h-3 w-3 text-brick-black/45" /> {item.time}
                          </span>
                        </div>
                      </div>

                      <span className="shrink-0 rounded-[4px] border border-brick-black/20 bg-white px-2 py-0.5 font-display text-[10px] font-semibold text-brick-black/80">
                        {item.venue}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Venue Anchor Note */}
                <div className="mt-3.5 rounded-[6px] border border-brick-black/15 bg-brick-yellow/15 p-2.5 sm:p-3 flex items-start gap-2.5 text-xs text-brick-black/80">
                  <MapPin className="h-4 w-4 text-brick-red shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold text-brick-black">All Labs in Architecture Department</strong>
                    <p className="text-[11px] text-brick-black/70 mt-0.5">
                      SCET Campus — Labs 1, 2, 3 & 4. Directional signs will guide you to each lab.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3.5 border-t border-brick-black/15 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowZoomModal(true)}
                  className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 rounded-[5px] border-[2.5px] border-brick-black bg-brick-yellow px-4 py-2 font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-brick-black shadow-[3px_3px_0_#0D0D0D] transition-transform hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#0D0D0D] active:translate-y-0 active:shadow-[1px_1px_0_#0D0D0D] cursor-pointer"
                >
                  <Maximize2 className="h-4 w-4 text-brick-black" />
                  <span>Inspect High-Res</span>
                </button>

                <a
                  href="/event-roadmap.png"
                  download="converse-2k26-event-roadmap.png"
                  className="inline-flex items-center justify-center gap-2 rounded-[5px] border-[2.5px] border-brick-black bg-white px-4 py-2 font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-brick-black shadow-[3px_3px_0_#0D0D0D] transition-transform hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#0D0D0D] active:translate-y-0 active:shadow-[1px_1px_0_#0D0D0D] cursor-pointer"
                  title="Download roadmap image"
                >
                  <Download className="h-4 w-4 text-brick-black" />
                  <span>Download</span>
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Tactile LEGO-Framed Poster Showcase */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="relative group rounded-[8px] border-[3.5px] border-brick-black bg-white p-3 sm:p-4 shadow-[6px_6px_0_#0D0D0D] transition-all hover:shadow-[8px_8px_0_#0D0D0D] flex flex-col justify-between">
              {/* LEGO Studs Accent Bar along Top */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 py-1.5 mb-2 bg-[#001d5c] rounded-[4px] border border-brick-black">
                {["#FFD700", "#0055BF", "#C91A09", "#FFD700", "#0055BF", "#C91A09"].map((color, i) => (
                  <span
                    key={i}
                    className="h-2.5 w-2.5 rounded-full border border-black"
                    style={{
                      backgroundColor: color,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
                    }}
                  />
                ))}
              </div>

              {/* Poster Image Container */}
              <div
                onClick={() => setShowZoomModal(true)}
                className="relative overflow-hidden rounded-[6px] border-[2px] border-brick-black bg-[#001438] cursor-pointer"
              >
                <img
                  src="/event-roadmap.png"
                  alt="CONVERSE 2K26 Official Event Roadmap"
                  className="w-full h-auto max-h-[440px] sm:max-h-[480px] object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                />

                {/* Floating "Tap to Zoom" badge */}
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-black/40 bg-black/75 px-3 py-1.5 text-[11px] font-display font-bold uppercase tracking-wider text-white backdrop-blur-md shadow-lg transition-transform group-hover:scale-105">
                  <Maximize2 className="h-3.5 w-3.5 text-brick-yellow" />
                  <span>Click to Zoom</span>
                </div>
              </div>

              {/* Caption Footer */}
              <div className="mt-3 px-1 flex items-center justify-between text-[11px] font-display uppercase tracking-wider text-brick-black/60">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-brick-yellow" /> Official 2026 Circuit Roadmap
                </span>
                <span className="font-bold text-brick-blue">7 Battles · 4 Labs</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Interactive Pinch & Pan Zoom Modal */}
      {showZoomModal && (
        <PosterZoomModal
          posterUrl="/event-roadmap.png"
          title="CONVERSE 2K26 — Championship Event Roadmap"
          onClose={() => setShowZoomModal(false)}
        />
      )}
    </section>
  );
}

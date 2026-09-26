import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { type FestEvent } from "@/lib/fest-state";
import {
  Clock,
  MapPin,
  Award,
  Users,
  User,
  CheckCircle2,
  ArrowRight,
  Trash2,
  ChevronDown,
  QrCode,
  Lock,
  Sparkles,
} from "lucide-react";
import { parseEventTeamSize, useEventSlotCounts } from "@/lib/firebase-registrations";
import { getEventSlug } from "@/lib/event-slugs";
import { cn } from "@/lib/utils";

/**
 * Standardized High-Contrast Track Badge
 */
export function TrackBadge({ track, dark = false }: { track: string; dark?: boolean }) {
  const cleanTrack = (track || "TECH").replace(/ TRACK$/i, "").trim().toUpperCase();
  const isTech = cleanTrack === "TECH" || cleanTrack === "IT";
  const isNonTech = cleanTrack === "NON-TECH" || cleanTrack === "NON TECH" || cleanTrack === "NONTECH" || cleanTrack.includes("NON") || cleanTrack === "AIDS";
  const displayTrack = isTech ? "TECH" : isNonTech ? "NON-TECH" : cleanTrack;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] border-[2px] border-black px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.14em]",
        dark
          ? "bg-brick-yellow text-black"
          : isTech
            ? "bg-brick-yellow text-black"
            : isNonTech
              ? "bg-[#38BDF8] text-black"
              : "bg-[#FB923C] text-black",
      )}
      style={{
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 1px 1.5px 0 #000000",
      }}
    >
      {displayTrack} TRACK
    </span>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  Framer Motion Variants: Scroll-Reveal (child of stagger)  */
/* ─────────────────────────────────────────────────────────── */

/** Child variant — used by each EventCard inside a staggered grid parent */
export const cardRevealVariant = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 20,
    },
  },
};

/** Parent grid variant — wraps the card grid to stagger children */
export const gridStaggerVariant = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

/**
 * Interactive LEGO Event Card — Fixed-Size Blur Overlay Reveal
 *
 * ═══════════════════════════════════════════════════════════════
 * ANIMATION BEHAVIOR (matching reference photo 3):
 * ═══════════════════════════════════════════════════════════════
 *
 * DEFAULT STATE:
 *   Clean white card with badges, title, 1-line teaser, prize,
 *   and footer ("TAP FOR DETAILS ▾" / "SNAP IN →").
 *
 * HOVER / TAP STATE (card size stays EXACTLY the same):
 *   1. The existing default content gets blurred in-place
 *      (filter: blur(6px) + scale(1.05) for a soft frosted look).
 *   2. A royal blue (#003399) semi-transparent overlay fades in
 *      ON TOP of the blurred content.
 *   3. Full event details (time, venue, description, CTA) appear
 *      inside the overlay as an absolute-positioned layer.
 *   4. NO layout shift, NO size change, NO extra space opened.
 *
 * SCROLL REVEAL:
 *   Uses `variants` from parent stagger grid (cardRevealVariant)
 *   for cascading upward slide + fade-in on viewport intersection.
 */
export function EventCard({
  event,
  registered = false,
  onRegister,
  onUnregister,
  mode = "default",
  className,
  style,
  onClick,
}: {
  event: FestEvent;
  registered?: boolean;
  onRegister?: () => void;
  onUnregister?: () => void;
  mode?: "default" | "dashboard" | "profile";
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const navigate = useNavigate();
  const teamInfo = parseEventTeamSize(event.format || "");
  const targetSlug = getEventSlug(event);
  const { isEventSlotsFull } = useEventSlotCounts();
  const isSlotsFull = isEventSlotsFull(event);
  const isRegClosed = Boolean(event.registrationOpen === false || isSlotsFull);
  const cleanTrack = (event.track || "").replace(/ TRACK$/i, "").trim().toUpperCase();
  const isEventNonTech = cleanTrack === "NON-TECH" || cleanTrack === "NON TECH" || cleanTrack === "NONTECH" || cleanTrack.includes("NON") || cleanTrack === "AIDS";

  return (
    <motion.div
      /* ── Scroll-Reveal via parent stagger ── */
      variants={cardRevealVariant}
      id={`event-card-${event.id}`}
      data-event-slug={targetSlug}
      className={cn(
        "relative flex flex-col justify-between rounded-[6px] border-[3.5px] sm:border-[4px] border-black p-4 sm:p-5 select-none cursor-pointer overflow-hidden bg-white min-h-[260px] sm:min-h-[280px]",
        "shadow-[4px_4px_0_#000000] sm:shadow-[5px_5px_0_#000000] hover:shadow-[6px_6px_0_#000000] active:translate-y-[2px] active:shadow-[2px_2px_0_#000000] transition-all",
        className,
      )}
      style={{ ...style, willChange: "transform, opacity" } as any}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
        } else {
          navigate({ to: "/events/$eventId", params: { eventId: targetSlug } });
        }
      }}
    >
      {/* ─── Lego Stud Details along the Top Edge ─── */}
      <div
        className="pointer-events-none absolute -top-3.5 left-0 right-0 z-30 flex items-center justify-center gap-3.5"
        aria-hidden
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="relative flex h-5 w-5 items-center justify-center rounded-full border-[2.5px] border-black bg-brick-yellow"
            style={{
              boxShadow:
                "inset 0 2px 0 rgba(255,255,255,0.7), inset 0 -2px 0 rgba(0,0,0,0.25), 0 3px 0 #000000",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full border border-black/45 bg-black/25"
              style={{
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
              }}
            />
          </span>
        ))}
      </div>

      {/* ─── Yellow-Black Hazard Accent ─── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[4px] z-[1]" aria-hidden>
        <span
          className="absolute right-1 top-1 h-3 w-24 rounded-[2px] border-[2px] border-black shadow-[1px_1px_0_rgba(0,0,0,0.3)]"
          style={{
            background: "repeating-linear-gradient(45deg, #FFD700 0 8px, #000000 8px 16px)",
          }}
        />
      </div>

      {/* ─── Blurred Logo Background ─── */}
      {event.logoUrl && (
        <div
          className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[4px]"
          aria-hidden
        >
          <img
            src={event.logoUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
            style={{
              opacity: 0.35,
              filter: "blur(4px)",
              transform: "scale(1.1)",
            }}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* DEFAULT CONTENT — always rendered, blurs when expanded   */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div
        className="relative z-[2] flex flex-col flex-1 justify-between transition-all duration-300"
      >
        {/* Top Badges Row (Number, Track, Format) */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-black tracking-wider text-black/60">
            {event.number}
          </span>
          <TrackBadge track={event.track} />
          <span className="inline-flex items-center gap-1 font-display text-[10px] font-bold uppercase tracking-[0.14em] text-black/70">
            {teamInfo.isStrictlySolo ? (
              <User className="h-3.5 w-3.5" />
            ) : (
              <Users className="h-3.5 w-3.5" />
            )}
            {teamInfo.badgeLabel}
          </span>
        </div>

        {/* Bold Event Title */}
        <h3 className="mt-2.5 font-display text-xl font-extrabold uppercase tracking-[0.03em] text-black">
          {event.title}
        </h3>

        {/* 1-Line Teaser Description */}
        <p className="mt-1.5 line-clamp-1 font-body text-xs text-black/75">
          {event.desc}
        </p>

        {/* College Credits Badge */}
        <div className="mt-3 inline-flex items-center gap-1.5 self-start rounded-[4px] border-[2px] border-black bg-brick-yellow/30 px-2.5 py-1 text-xs font-bold text-black shadow-[1.5px_1.5px_0_#000000]">
          <Award className="h-3.5 w-3.5 text-black shrink-0" />
          <span className="font-display font-bold uppercase tracking-[0.06em]">
            {event.prize}
          </span>
        </div>

        {/* Bottom Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-black/15 pt-3">
          {mode === "profile" ? (
            (() => {
              const cleanTrack = (event.track || "").replace(/ TRACK$/i, "").trim().toUpperCase();
              const isNonTech = cleanTrack === "NON-TECH" || cleanTrack === "NON TECH" || cleanTrack === "NONTECH" || cleanTrack.includes("NON");
              if (isNonTech) {
                return (
                  <>
                    <span className="inline-flex items-center gap-1.5 font-display text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em] text-purple-800 bg-purple-100/90 px-2.5 py-1 rounded-[4px] border border-purple-400 shadow-sm animate-pulse">
                      <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                      VIEW EVENT INFO
                    </span>
                    <span className="font-display text-xs font-black uppercase tracking-[0.08em] text-emerald-700 font-extrabold">
                      REGISTERED ✓
                    </span>
                  </>
                );
              }
              return (
                <>
                  <span className="inline-flex items-center gap-1.5 font-display text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em] text-brick-blue bg-brick-blue/10 px-2.5 py-1 rounded-[4px] border border-brick-blue/30 shadow-sm animate-pulse">
                    <QrCode className="h-3.5 w-3.5 text-brick-blue" />
                    TAP FOR QR PASS
                  </span>
                  <span className="font-display text-xs font-black uppercase tracking-[0.08em] text-black/70">
                    TICKET READY ✓
                  </span>
                </>
              );
            })()
          ) : (
            <>
              <Link
                to="/events/$eventId"
                params={{ eventId: targetSlug }}
                className="inline-flex items-center gap-1 font-display text-[10px] font-bold uppercase tracking-[0.14em] text-brick-blue animate-pulse hover:underline cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                TAP FOR DETAILS <ChevronDown className="h-3 w-3" />
              </Link>
              <Link
                to="/events/$eventId"
                params={{ eventId: targetSlug }}
                className={cn(
                  "font-display text-xs font-black uppercase tracking-[0.1em] transition-colors cursor-pointer",
                  isEventNonTech
                    ? isRegClosed
                      ? "text-red-600 flex items-center gap-1"
                      : "text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                    : registered
                    ? "text-emerald-700 font-extrabold"
                    : isRegClosed
                    ? "text-red-600 flex items-center gap-1"
                    : "text-black hover:text-brick-blue"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {isEventNonTech ? (
                  isRegClosed ? (
                    <>
                      <Lock className="h-3 w-3 inline-block" /> CLOSED
                    </>
                  ) : (
                    "REGISTER ↗"
                  )
                ) : registered ? (
                  "REGISTERED ✓"
                ) : isRegClosed ? (
                  <>
                    <Lock className="h-3 w-3 inline-block" /> CLOSED
                  </>
                ) : (
                  "SNAP IN →"
                )}
              </Link>
            </>
          )}
        </div>
      </div>


    </motion.div>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { FEST_EVENTS, type FestEvent } from "@/lib/fest-state";
import { useFirestoreEvents } from "@/lib/firebase-events";
import { parseEventTeamSize, useEventSlotCounts } from "@/lib/firebase-registrations";
import { findEventBySlugOrId, toEventSlug, getEventSlug } from "@/lib/event-slugs";
import { useSiteConfig, DEFAULT_SITE_CONFIG } from "@/lib/firebase-site-config";
import { openGoogleCalendar } from "@/lib/calendar-reminders";
import { cn } from "@/lib/utils";
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Award, 
  Phone, 
  CalendarPlus,
  ImageIcon,
  Maximize2,
  X,
  Lock,
  LogIn,
  ArrowRight,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/lib/firebase-auth";
import { auth } from "@/lib/firebase";
import { SiteFooter } from "@/components/brick/SiteFooter";
import { PosterZoomModal } from "@/components/brick/PosterZoomModal";
import { EventFloatingSocials } from "@/components/brick/EventFloatingSocials";
import { getFacultyRank } from "@/lib/firebase-site-config";

export const Route = createFileRoute("/$eventId")({
  component: PublicEventDetailPage,
  errorComponent: ({ error, reset }: { error: Error; reset: () => void }) => {
    console.error("Public event page error:", error);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#001d5c] text-white p-6 text-center">
        <h2 className="text-2xl font-bold font-display uppercase tracking-wider mb-2">Event Unavailable</h2>
        <p className="text-white/70 mb-6 text-sm max-w-md">There was an issue opening this event. Please head back to explore events.</p>
        <div className="flex gap-3">
          <button onClick={() => reset()} className="px-5 py-2 rounded-lg bg-[#FFD700] text-[#001d5c] font-bold text-sm uppercase cursor-pointer">Try Again</button>
          <a href="/" className="px-5 py-2 rounded-lg bg-white/10 text-white text-sm uppercase font-bold cursor-pointer">Back to Home</a>
        </div>
      </div>
    );
  },
});

// Helpers to detect bullet lines vs highlighted headings in rules
function isBulletRule(text: string): boolean {
  if (typeof text !== "string") return false;
  const trimmed = text.trim();
  return /^([•●\-\*\+]|\d+[\.\)])\s*/.test(trimmed);
}

function cleanRuleText(text: string): string {
  if (typeof text !== "string") return String(text || "");
  const trimmed = text.trim();
  return trimmed.replace(/^([•●\-\*\+]|\d+[\.\)])\s*/, "").trim();
}

function renderFormattedRuleText(text: string) {
  if (typeof text !== "string") return String(text || "");
  if (text.includes("**") || text.includes("<b>")) {
    const parts = text.split(/(\*\*.*?\*\*|<b>.*?<\/b>)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-bold text-white tracking-wide">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("<b>") && part.endsWith("</b>")) {
        return (
          <strong key={i} className="font-bold text-white tracking-wide">
            {part.slice(3, -4)}
          </strong>
        );
      }
      return part;
    });
  }

  const colonMatch = text.match(/^([A-Za-z0-9\s—–-]{2,25}:)\s*(.*)$/);
  if (colonMatch) {
    return (
      <>
        <strong className="font-bold text-white tracking-wide">{colonMatch[1]} </strong>
        {colonMatch[2]}
      </>
    );
  }

  return text;
}

function PublicEventDetailPage() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { events: fsEvents, loading: fsEventsLoading } = useFirestoreEvents();
  const { isEventSlotsFull } = useEventSlotCounts();
  const { config } = useSiteConfig();
  
  const [scrolled, setScrolled] = useState(false);
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 180);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Merge dynamic and fallback events safely
  const event = useMemo(() => {
    const combined: FestEvent[] = [...fsEvents];
    FEST_EVENTS.forEach((fe) => {
      if (!combined.some((e) => e.id === fe.id)) {
        combined.push(fe);
      }
    });

    const found = findEventBySlugOrId(combined, eventId);
    if (!found) return null;

    const staticBase = FEST_EVENTS.find((e) => e.id === found.id);
    return {
      ...(staticBase || {}),
      ...found,
    } as FestEvent;
  }, [eventId, fsEvents]);

  const canonicalSlug = useMemo(() => (event ? getEventSlug(event) : ""), [event]);

  // Canonical slug redirect: keep URL clean (e.g. /codathon)
  useEffect(() => {
    if (event && canonicalSlug && eventId !== canonicalSlug) {
      navigate({
        to: "/$eventId",
        params: { eventId: canonicalSlug },
        replace: true,
      });
    }
  }, [event, canonicalSlug, eventId, navigate]);

  const isSlotsFull = useMemo(() => {
    return isEventSlotsFull(event);
  }, [isEventSlotsFull, event]);

  const isRegClosed = useMemo(() => {
    if (!event) return false;
    return Boolean(event.registrationOpen === false || isSlotsFull);
  }, [event, isSlotsFull]);

  const coordinatorsList = useMemo(() => {
    if (!event) return [];
    if (event.coordinators && event.coordinators.length > 0) {
      return event.coordinators
        .filter(c => c && ((typeof c.name === "string" && c.name.trim() !== "") || (typeof c.phone === "string" && c.phone.trim() !== "")))
        .map(c => ({ name: String(c.name || "Coordinator"), phone: String(c.phone || "") }));
    }
    if (event.coordinatorName || event.coordinatorPhone) {
      const names = (event.coordinatorName || "").split(/[,;\n]/).map(s => s.trim());
      const phones = (event.coordinatorPhone || "").split(/[,;\n]/).map(s => s.trim());
      const maxLen = Math.max(names.length, phones.length);
      const list: Array<{ name: string; phone: string }> = [];
      for (let i = 0; i < maxLen; i++) {
        if (names[i] || phones[i]) {
          list.push({
            name: names[i] || "Coordinator",
            phone: phones[i] || "",
          });
        }
      }
      return list;
    }
    return [];
  }, [event]);

  const facultyCoordinatorsList = useMemo(() => {
    if (!event) return [];
    if (event.facultyCoordinators && event.facultyCoordinators.length > 0) {
      const valid = event.facultyCoordinators
        .filter(c => c && ((typeof c.name === "string" && c.name.trim() !== "") || (typeof c.phone === "string" && c.phone.trim() !== "")))
        .map(c => ({ name: String(c.name || "Faculty Coordinator"), phone: String(c.phone || "") }));
      return [...valid].sort((a, b) => {
        const rankA = getFacultyRank(a.name);
        const rankB = getFacultyRank(b.name);
        if (rankA !== 99 && rankB !== 99) return rankA - rankB;
        return 0;
      });
    }
    return [];
  }, [event]);

  const formattedDate = useMemo(() => {
    if (!event?.date) return "Apr 26, 2026";
    try {
      const d = new Date(event.date);
      if (isNaN(d.getTime())) return event.date;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return event.date;
    }
  }, [event?.date]);

  const computedTargetDate = useMemo(() => {
    if (event?.date && event?.startTime) {
      return `${event.date}T${event.startTime}:00`;
    }
    return "2026-04-26T09:00:00Z";
  }, [event?.date, event?.startTime]);

  const normalizedRules = useMemo(() => {
    if (!event?.rules) return [];
    if (Array.isArray(event.rules)) {
      return event.rules
        .map((r: any) => {
          if (typeof r === "string") return r.trim();
          if (r && typeof r === "object") {
            if (typeof r.text === "string") return r.text.trim();
            if (typeof r.rule === "string") return r.rule.trim();
          }
          return "";
        })
        .filter(Boolean);
    }
    if (typeof event.rules === "string") {
      return (event.rules as string).split("\n").map((r: string) => r.trim()).filter(Boolean);
    }
    return [];
  }, [event?.rules]);

  const teamSize = useMemo(() => parseEventTeamSize(event?.format || ""), [event?.format]);

  const isEventNonTech = useMemo(() => {
    if (!event) return false;
    const cleanTrack = (event.track || "").replace(/ TRACK$/i, "").trim().toUpperCase();
    return cleanTrack === "NON-TECH" || cleanTrack === "NON TECH" || cleanTrack === "NONTECH" || cleanTrack.includes("NON");
  }, [event]);

  // If event not found
  if (!event) {
    if (fsEventsLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#001d5c] text-white">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#FFD700] border-t-transparent" />
            <p className="font-display text-sm font-bold uppercase tracking-wider text-white/70">
              Loading event details…
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#001d5c] text-white p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4 font-display uppercase tracking-wider">Event Not Found</h2>
          <p className="text-white/60 text-sm mb-6 max-w-sm">The event you are looking for does not exist or has been moved.</p>
          <button 
            onClick={() => navigate({ to: "/" })}
            className="px-6 py-2.5 bg-[#FFD700] text-[#001d5c] font-display font-bold uppercase rounded-lg cursor-pointer hover:bg-[#ffdf33] transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const initials = (event.title || "EV").substring(0, 2).toUpperCase();

  // If user is already logged in, navigate directly to registered app event page.
  // If non-tech event, open Google Form link directly in a new tab.
  // If guest, direct strictly to login page.
  const handleRegisterClick = () => {
    if (isRegClosed) return;
    if (isEventNonTech) {
      if (event.googleFormUrl && event.googleFormUrl.trim()) {
        const targetUrl = event.googleFormUrl.trim().startsWith("http")
          ? event.googleFormUrl.trim()
          : `https://${event.googleFormUrl.trim()}`;
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      } else {
        setToast("Registration link will be announced soon. Please check back later!");
        setTimeout(() => setToast(null), 3500);
      }
      return;
    }
    if (user || auth.currentUser) {
      navigate({
        to: "/events/$eventId",
        params: { eventId: canonicalSlug || event.id },
      });
    } else {
      window.location.href = "/?login=true";
    }
  };

  const handleAddToCalendar = () => {
    openGoogleCalendar(event, config?.reminderSettings || DEFAULT_SITE_CONFIG.reminderSettings);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#003399] to-[#001d5c] text-[#f4f7ff] font-body selection:bg-[#FFD700]/30 selection:text-white flex flex-col justify-between">
      
      {/* 1. Header Navigation Bar */}
      <header
        className={cn(
          "sticky top-0 z-40 w-full transition-all duration-200 border-b",
          scrolled
            ? "bg-[#001d5c]/95 backdrop-blur-md border-white/10 shadow-lg py-3"
            : "bg-[#001d5c] border-transparent py-4"
        )}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <button 
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="flex items-center gap-2 rounded-xl bg-white/5 px-3.5 py-2 text-xs font-display font-bold uppercase tracking-wider text-white border border-white/10 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          
          <span className="font-display font-black text-xs sm:text-sm uppercase tracking-wider text-white/90 truncate max-w-[140px] sm:max-w-xs md:max-w-md">
            {event.title}
          </span>

          {user ? (
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 rounded-lg bg-brick-yellow px-3.5 py-1.5 text-xs font-display font-bold uppercase tracking-wider text-brick-black hover:bg-[#ffdf33] active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              <span>Dashboard</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                window.location.href = "/?login=true";
              }}
              className="flex items-center gap-1.5 rounded-lg bg-brick-yellow px-3.5 py-1.5 text-xs font-display font-bold uppercase tracking-wider text-brick-black hover:bg-[#ffdf33] active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Login</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. Main 2-Column Content Grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-12 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* ════ LEFT COLUMN: Logo & Poster Photo (Optimized Spacing so entire poster is visible without cutting) ════ */}
          <div className="lg:col-span-5 flex flex-col gap-3.5 sm:gap-4 lg:sticky lg:top-16">
            
            {/* Event Logo Card (Compact, elegant, high-impact) */}
            <div className="relative group overflow-hidden rounded-2xl border-2 border-white/10 bg-gradient-to-b from-[#061a45] to-[#041233] p-3.5 sm:p-4 shadow-xl transition-all hover:border-[#FFD700]/40 flex flex-col items-center text-center">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,215,0,0.12)_0%,_transparent_70%)] pointer-events-none" />
              
              <div className="relative z-10 flex flex-col items-center w-full">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-display font-bold uppercase tracking-[0.14em] text-[#FFD700] border border-white/10 mb-2 sm:mb-2.5 shadow-sm">
                  Official Event Logo
                </span>
                
                <div className="relative mb-2 sm:mb-2.5 flex items-center justify-center">
                  <div className="absolute inset-0 scale-125 rounded-2xl bg-[radial-gradient(circle_at_center,_#FFD700_0%,_transparent_70%)] opacity-20 blur-lg pointer-events-none" />
                  {event.logoUrl ? (
                    <img
                      src={event.logoUrl}
                      alt={event.title}
                      className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 rounded-xl object-contain p-2 bg-white/5 border-2 border-white/15 drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-105 relative z-10"
                    />
                  ) : (
                    <div className="flex h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 items-center justify-center rounded-xl bg-[#001d5c] border-2 border-dashed border-[#FFD700]/40 shadow-xl relative z-10">
                      <span className="font-display text-3xl sm:text-4xl font-black text-[#FFD700] tracking-wider">{initials}</span>
                    </div>
                  )}
                </div>

                <h2 className="font-display text-sm sm:text-base font-extrabold uppercase tracking-wide text-white drop-shadow-sm truncate max-w-full">
                  {event.title}
                </h2>
                <p className="text-[10px] sm:text-[11px] font-semibold text-[#a9b8e0] mt-0.5 tracking-wider uppercase">
                  {event.track} Track · {event.format || teamSize.label}
                </p>
              </div>
            </div>

            {/* Poster Showcase Card (Complete uncropped view with slim header) */}
            <div className="relative group overflow-hidden rounded-2xl border-2 border-white/10 bg-[#061a45] shadow-xl transition-all hover:border-[#FFD700]/40 flex flex-col">
              <div className="px-3.5 py-1.5 sm:py-2 border-b border-white/10 flex items-center justify-between bg-black/30">
                <span className="text-[10px] font-display font-bold uppercase tracking-[0.14em] text-[#FFD700] flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-[#FFD700]" /> Official Event Poster
                </span>
                <span className="text-[9px] font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1">
                  <Maximize2 className="h-2.5 w-2.5" /> Tap to expand
                </span>
              </div>

              {event.posterUrl ? (
                <div 
                  className="relative cursor-pointer group flex items-center justify-center p-2.5 bg-black/40"
                  onClick={() => setShowPosterModal(true)}
                  title="Click to view full poster"
                >
                  <img
                    src={event.posterUrl}
                    alt={`${event.title} Poster`}
                    className="w-full h-auto max-h-[340px] sm:max-h-[380px] lg:max-h-[410px] object-contain rounded-lg transition-transform duration-300 group-hover:scale-[1.01]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3 rounded-lg pointer-events-none">
                    <span className="rounded-full bg-[#001d5c]/95 px-3 py-1 text-[11px] font-display font-bold uppercase text-[#FFD700] border border-[#FFD700]/30 shadow-lg flex items-center gap-1.5">
                      <Maximize2 className="h-3 w-3" /> View Full Poster
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full aspect-[4/3] max-h-[260px] flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#061a45] to-[#041233]">
                  <div className="h-14 w-14 rounded-xl border-2 border-dashed border-[#FFD700]/40 flex items-center justify-center text-[#FFD700]/60 mb-2.5 bg-white/5">
                    <ImageIcon className="h-7 w-7" />
                  </div>
                  <p className="font-display text-xs font-bold uppercase tracking-wider text-white">Official Event Poster</p>
                  <p className="text-[11px] text-[#7d8dbd] mt-0.5 max-w-xs">Upload challenge poster in admin panel.</p>
                </div>
              )}
            </div>
          </div>

          {/* ════ RIGHT COLUMN: Event Info, Registration CTA, & Deep Details ════ */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Header: Track & Title */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#061a45] px-3.5 py-1.5 border border-white/10 mb-3">
                <span className="h-2 w-2 rounded-full bg-[#FFD700]" />
                <span className="font-display text-xs font-bold uppercase tracking-[0.14em] text-[#a9b8e0]">
                  {event.track} TRACK · {event.format || teamSize.label}
                </span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold uppercase leading-tight tracking-tight text-white drop-shadow-md">
                {event.title}
              </h1>
            </div>

            {/* Registration Action Card */}
            <div className="rounded-2xl border-2 border-[#FFD700]/30 bg-gradient-to-r from-[#061a45] to-[#092257] p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-display font-bold uppercase tracking-wider text-[#a9b8e0]">Registration Status</span>
                  <p className="text-base font-bold text-white">
                    {isRegClosed
                      ? "Registration Closed"
                      : isEventNonTech
                      ? "External Registration (Google Form)"
                      : "Registration Open"}
                  </p>
                </div>
                {isRegClosed ? (
                  <span className="rounded-full px-3 py-1 text-xs font-bold border bg-rose-500/20 text-rose-300 border-rose-500/40 flex items-center gap-1.5 shadow-sm">
                    <Lock className="h-3 w-3 text-rose-400" /> Closed
                  </span>
                ) : isEventNonTech ? (
                  <span className="rounded-full px-3 py-1 text-xs font-bold border bg-blue-500/20 text-blue-300 border-blue-500/40 flex items-center gap-1.5">
                    <ExternalLink className="h-3 w-3 text-blue-300" /> Google Form
                  </span>
                ) : (
                  <span className="rounded-full px-3 py-1 text-xs font-bold border bg-emerald-500/15 text-emerald-300 border-emerald-500/30 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Open
                  </span>
                )}
              </div>

              {/* Action Buttons: Calendar Button on Left, Register Button on Right */}
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  {/* Calendar Button (Left) */}
                  <button
                    type="button"
                    onClick={handleAddToCalendar}
                    className="h-13 w-13 shrink-0 flex items-center justify-center rounded-xl bg-[#003399] border border-white/20 text-white hover:bg-[#002980] hover:border-[#FFD700]/50 active:scale-95 transition-all cursor-pointer shadow-md"
                    title="Add to Google Calendar"
                    aria-label="Add to Calendar"
                  >
                    <CalendarPlus className="h-5 w-5 text-[#FFD700]" />
                  </button>

                  {/* Register Button (Redirects to in-app event page if logged in, else login page) */}
                  <button
                    type="button"
                    disabled={isRegClosed}
                    aria-disabled={isRegClosed}
                    onClick={isRegClosed ? undefined : handleRegisterClick}
                    className={cn(
                      "flex-1 h-13 rounded-xl font-display text-sm sm:text-base font-black uppercase tracking-[0.12em] transition-all flex items-center justify-center gap-2 select-none shadow-lg",
                      isRegClosed
                        ? "bg-gradient-to-r from-rose-950/70 via-red-950/70 to-rose-950/70 border-2 border-rose-500/50 text-rose-200 cursor-not-allowed shadow-none opacity-90 pointer-events-none"
                        : "bg-[#FFD700] text-[#001d5c] hover:bg-[#ffdf33] active:scale-[0.98] hover:shadow-[#FFD700]/25 cursor-pointer"
                    )}
                  >
                    {isRegClosed ? (
                      <>
                        <Lock className="h-4 w-4 text-rose-400" />
                        Registrations Closed
                      </>
                    ) : isEventNonTech ? (
                      <>
                        <ExternalLink className="h-4.5 w-4.5 text-[#001d5c] stroke-[2.5]" />
                        Register via Google Form
                      </>
                    ) : user ? (
                      teamSize.requiresTeam ? (
                        <>
                          <ArrowRight className="h-4 w-4" />
                          Register Team
                        </>
                      ) : (
                        <>
                          <ArrowRight className="h-4 w-4" />
                          Register Now
                        </>
                      )
                    ) : (
                      "Register Now"
                    )}
                  </button>
                </div>

                {/* Non-Tech Event Notice */}
                {isEventNonTech && !isRegClosed && (
                  <div className="rounded-xl border border-blue-400/30 bg-blue-950/40 p-3.5 flex items-start gap-3 backdrop-blur-sm animate-in fade-in">
                    <ExternalLink className="h-4 w-4 text-blue-300 shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-100/90 leading-relaxed font-body">
                      This is an independent non-technical challenge. Clicking <strong>Register via Google Form</strong> opens the organizer's external form directly in a new tab. No entry QR pass is needed.
                    </div>
                  </div>
                )}

                {/* Beautiful Closed Registration Notice Box when registrations are turned off */}
                {isRegClosed && (
                  <div className="relative overflow-hidden rounded-xl border border-rose-500/35 bg-gradient-to-br from-rose-950/50 via-[#061a45] to-red-950/40 p-4 shadow-xl backdrop-blur-md animate-in fade-in duration-300">
                    <div className="absolute top-0 right-0 w-36 h-36 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="relative z-10 flex items-start gap-3">
                      <div className="h-9 w-9 shrink-0 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 shadow-inner mt-0.5">
                        <Lock className="h-4 w-4 text-rose-400" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-xs font-black uppercase tracking-[0.14em] text-rose-300">
                            Registrations Concluded
                          </span>
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300/70">
                            COMVERSE 2026
                          </span>
                        </div>
                        <p className="font-body text-xs sm:text-sm text-rose-100/90 leading-relaxed">
                          {event.registrationClosedMessage?.trim() ||
                            "Registrations for this event are now officially closed as the entry window has ended or capacity has been reached. Thank you for the incredible enthusiasm!"}
                        </p>
                        <p className="font-body text-[11px] text-[#a9b8e0] pt-1">
                          Have queries? Connect with the student or faculty coordinators listed below.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Countdown Timer */}
            <div className="rounded-xl bg-[#061a45] p-4 sm:p-5 border border-white/5 shadow-sm flex flex-col items-center sm:items-start gap-3">
              <span className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-[#7d8dbd]">
                Event Starts In
              </span>
              <CountdownTiles targetDate={computedTargetDate} />
            </div>

            {/* Quick Fact Chips */}
            <div className="flex flex-wrap gap-2.5">
              <FactChip icon={Calendar} label={formattedDate} />
              <FactChip icon={Clock} label={event.time || "TBA"} />
              <FactChip icon={MapPin} label={event.venue || "SCET Campus"} />
              <FactChip icon={Users} label={event.format || "Standard"} />
              <FactChip icon={Award} label={event.prize || event.reward || "Certificate"} />
            </div>

            {/* About the Event */}
            {(event.fullDesc || event.desc) && (
              <section className="bg-[#061a45] rounded-xl p-5 sm:p-6 border border-white/5 shadow-sm">
                <h3 className="font-display text-xs font-bold uppercase tracking-[0.15em] text-[#FFD700] mb-3">
                  About the Event
                </h3>
                <p className="font-body text-sm leading-relaxed text-[#c3cfea] whitespace-pre-wrap">
                  {event.fullDesc || event.desc}
                </p>
              </section>
            )}

            {/* Multi-Round Structure & Rules */}
            {normalizedRules.length > 0 && (
              <section className="bg-[#061a45] rounded-xl p-5 sm:p-6 border border-white/5 shadow-sm space-y-4">
                <h3 className="font-display text-xs font-bold uppercase tracking-[0.15em] text-[#FFD700]">
                  Format & Rules
                </h3>
                <ul className="space-y-3">
                  {normalizedRules.map((rule, idx) => {
                    const isBullet = isBulletRule(rule);
                    const cleanText = cleanRuleText(rule);
                    return (
                      <li key={idx} className="flex items-start gap-3 text-sm text-[#d4def6] leading-relaxed">
                        <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#003399] text-[10px] font-bold text-[#FFD700]">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          {renderFormattedRuleText(cleanText)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Faculty Coordinators */}
            {facultyCoordinatorsList.length > 0 && (
              <section className="bg-[#061a45] rounded-xl p-5 sm:p-6 border border-white/5 shadow-sm space-y-4">
                <h3 className="font-display text-xs font-bold uppercase tracking-[0.15em] text-[#FFD700]">
                  Faculty Coordinators
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {facultyCoordinatorsList.map((coord, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg bg-[#003399]/40 border border-white/10 p-3 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-display text-xs font-bold uppercase tracking-wider text-white truncate">
                          {coord.name}
                        </div>
                        <div className="text-[11px] text-[#a9b8e0] font-mono">
                          {coord.phone || "Contact Desk"}
                        </div>
                      </div>
                      {coord.phone && (
                        <a
                          href={`tel:${coord.phone.replace(/[^0-9+]/g, "")}`}
                          className="h-8 w-8 rounded-lg bg-[#FFD700] text-[#001d5c] flex items-center justify-center hover:bg-[#ffdf33] transition-colors shrink-0"
                          title={`Call ${coord.name}`}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Event Coordinators */}
            {coordinatorsList.length > 0 && (
              <section className="bg-[#061a45] rounded-xl p-5 sm:p-6 border border-white/5 shadow-sm space-y-4">
                <h3 className="font-display text-xs font-bold uppercase tracking-[0.15em] text-[#FFD700]">
                  Event Coordinators
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {coordinatorsList.map((coord, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg bg-[#003399]/40 border border-white/10 p-3 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-display text-xs font-bold uppercase tracking-wider text-white truncate">
                          {coord.name}
                        </div>
                        <div className="text-[11px] text-[#a9b8e0] font-mono">
                          {coord.phone || "Contact Desk"}
                        </div>
                      </div>
                      {coord.phone && (
                        <a
                          href={`tel:${coord.phone.replace(/[^0-9+]/g, "")}`}
                          className="h-8 w-8 rounded-lg bg-[#FFD700] text-[#001d5c] flex items-center justify-center hover:bg-[#ffdf33] transition-colors shrink-0"
                          title={`Call ${coord.name}`}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Fullscreen Interactive Poster Zoom Modal */}
      {showPosterModal && event.posterUrl && (
        <PosterZoomModal
          posterUrl={event.posterUrl}
          title={event.title}
          onClose={() => setShowPosterModal(false)}
        />
      )}

      {/* Floating WhatsApp and Instagram Links for this Event */}
      <EventFloatingSocials
        whatsappUrl={event.whatsappGroupUrl}
        instagramUrl={event.instagramUrl}
        eventTitle={event.title}
      />

      {/* Toast Notification Banner */}
      {toast && (
        <div
          className="fixed left-1/2 top-5 z-[70] -translate-x-1/2"
          style={{ animation: "toast-drop 420ms cubic-bezier(0.22,1.4,0.36,1) both" }}
        >
          <div className="flex items-center gap-2.5 rounded-xl border border-white/20 bg-[#001d5c]/95 px-5 py-3 font-display text-xs font-bold uppercase tracking-[0.1em] text-white shadow-2xl backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-[#FFD700] animate-pulse" />
            <span>{toast}</span>
          </div>
        </div>
      )}

      {/* Universal Footer */}
      <SiteFooter />
    </div>
  );
}

// ─── Subcomponents ───

function FactChip({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-[#061a45] px-3 py-1.5 border border-white/10">
      <Icon className="h-3.5 w-3.5 text-[#FFD700]" />
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.05em] text-[#a9b8e0]">
        {label}
      </span>
    </div>
  );
}

function CountdownTiles({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const target = new Date(targetDate).getTime();
    
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now) / 1000;
      
      setTimeLeft({
        d: Math.floor(diff / 86400),
        h: Math.floor((diff % 86400) / 3600),
        m: Math.floor((diff % 3600) / 60),
        s: Math.floor(diff % 60),
      });
    };
    
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const units = [
    { label: "DAYS", value: timeLeft.d },
    { label: "HRS", value: timeLeft.h },
    { label: "MIN", value: timeLeft.m },
    { label: "SEC", value: timeLeft.s },
  ];

  return (
    <div className="flex gap-2">
      {units.map((u) => (
        <div key={u.label} className="flex flex-col items-center w-14">
          <div className="flex h-14 w-full items-center justify-center rounded-[8px] bg-[#061a45] border border-white/10 shadow-sm">
            <span className="font-mono text-xl font-bold text-[#FFD700] tabular-nums tracking-tighter">
              {String(u.value).padStart(2, "0")}
            </span>
          </div>
          <span className="mt-1.5 font-display text-[9px] font-bold uppercase tracking-wider text-[#7d8dbd]">
            {u.label}
          </span>
        </div>
      ))}
    </div>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { FEST_EVENTS, useFestState, type FestEvent } from "@/lib/fest-state";
import { useFirestoreEvents } from "@/lib/firebase-events";
import { 
  registerForEvent, 
  useMyRegistrations, 
  parseEventTeamSize, 
  getTeamRoster,
  useEventSlotCounts,
  isUserRegisteredForEvent,
  doesRegistrationMatchEvent,
} from "@/lib/firebase-registrations";
import { findEventBySlugOrId, toEventSlug, getEventSlug } from "@/lib/event-slugs";
import { TeamRegistrationModal } from "@/components/brick/TeamRegistrationModal";
import { RegistrationCalendarModal } from "@/components/brick/RegistrationCalendarModal";
import { PosterZoomModal } from "@/components/brick/PosterZoomModal";
import { EventFloatingSocials } from "@/components/brick/EventFloatingSocials";
import { useSiteConfig, getFacultyRank, DEFAULT_SITE_CONFIG } from "@/lib/firebase-site-config";
import { openGoogleCalendar } from "@/lib/calendar-reminders";
import { useAuth } from "@/lib/firebase-auth";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Award, 
  Check, 
  Phone, 
  CalendarPlus,
  ImageIcon,
  Maximize2,
  X,
  QrCode,
  Crown,
  User,
  Lock,
  Sparkles,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { SiteFooter } from "@/components/brick/SiteFooter";

export const Route = createFileRoute("/events_/$eventId")({
  component: EventDetailPage,
  errorComponent: ({ error, reset }: { error: Error; reset: () => void }) => {
    console.error("Event page error:", error);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#001d5c] text-white p-6 text-center">
        <h2 className="text-2xl font-bold font-display uppercase tracking-wider mb-2">Event Details Unavailable</h2>
        <p className="text-white/70 mb-6 text-sm max-w-md">There was an issue opening this event. Please try again or head back to the events page.</p>
        <div className="flex gap-3">
          <button onClick={() => reset()} className="px-5 py-2 rounded-lg bg-[#FFD700] text-[#001d5c] font-bold text-sm uppercase cursor-pointer">Try Again</button>
          <a href="/events" className="px-5 py-2 rounded-lg bg-white/10 text-white text-sm uppercase font-bold cursor-pointer">Browse Events</a>
        </div>
      </div>
    );
  },
});

// Helpers to detect bullet lines vs highlighted headings in rules
function isBulletRule(text: any): boolean {
  if (typeof text !== "string") return false;
  const trimmed = text.trim();
  return /^([•●\-\*\+]|\d+[\.\)])\s*/.test(trimmed);
}

function cleanRuleText(text: any): string {
  if (typeof text !== "string") return String(text || "").trim();
  const trimmed = text.trim();
  return trimmed.replace(/^([•●\-\*\+]|\d+[\.\)])\s*/, "").trim();
}

function renderFormattedRuleText(text: any) {
  if (typeof text !== "string") return String(text || "");

  // Support **bold text** and <b>bold text</b>
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

  // Auto-bold leading key phrases ending with a colon (e.g. "Duration: 30 minutes", "First 20 minutes:")
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

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const { events: fsEvents, loading: fsEventsLoading } = useFirestoreEvents();
  const { user } = useAuth();
  const { isRegistered, registerEvent } = useFestState(user?.uid);
  const { registrations, loading: regLoading } = useMyRegistrations(user?.uid, user?.email);
  const { isEventSlotsFull } = useEventSlotCounts();
  const { config } = useSiteConfig();
  
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showCalendarSuccessModal, setShowCalendarSuccessModal] = useState(false);

  // Scroll listener for top bar
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 180);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Merge dynamic and hardcoded events safely
  const event = useMemo(() => {
    const combined: FestEvent[] = [...fsEvents];
    FEST_EVENTS.forEach((fe) => {
      if (!combined.some((e) => e.id === fe.id)) {
        combined.push(fe);
      }
    });

    const found = findEventBySlugOrId(combined, eventId);
    if (!found) return null;

    // Merge static fields if dynamic event is missing some UI fields (e.g. iconName, tagType)
    const staticBase = FEST_EVENTS.find((e) => e.id === found.id);
    return {
      ...(staticBase || {}),
      ...found,
    } as FestEvent;
  }, [eventId, fsEvents]);

  // Canonical slug redirect: ensure the URL path strictly matches the event's slug
  useEffect(() => {
    if (event) {
      const canonicalSlug = getEventSlug(event);
      if (canonicalSlug && eventId !== canonicalSlug) {
        navigate({
          to: "/events/$eventId",
          params: { eventId: canonicalSlug },
          replace: true,
        });
      }
    }
  }, [event, eventId, navigate]);

  const myReg = useMemo(() => {
    if (!event) return undefined;
    return registrations.find((r) => doesRegistrationMatchEvent(r, event));
  }, [registrations, event]);

  const registered = useMemo(() => {
    if (!event) return false;
    return Boolean(myReg) || isUserRegisteredForEvent(event, registrations);
  }, [event, myReg, registrations]);

  const isSlotsFull = useMemo(() => {
    return isEventSlotsFull(event);
  }, [isEventSlotsFull, event]);

  const isRegClosed = useMemo(() => {
    if (!event) return false;
    return Boolean(event.registrationOpen === false || isSlotsFull);
  }, [event, isSlotsFull]);

  const teamRoster = useMemo(() => {
    return getTeamRoster(myReg, user);
  }, [myReg, user]);

  const coordinatorsList = useMemo(() => {
    if (!event) return [];
    if (event.coordinators && event.coordinators.length > 0) {
      return event.coordinators.filter(c => c && ((c.name && typeof c.name === "string" && c.name.trim() !== "") || (c.phone && typeof c.phone === "string" && c.phone.trim() !== "")));
    }
    if (event.coordinatorName || event.coordinatorPhone) {
      const names = (event.coordinatorName || "").split(/[,;\n]/).map(s => s.trim());
      const phones = (event.coordinatorPhone || "").split(/[,;\n]/).map(s => s.trim());
      const maxLen = Math.max(names.length, phones.length);
      const list: Array<{ name: string; phone: string }> = [];
      for (let i = 0; i < maxLen; i++) {
        if (names[i] || phones[i]) {
          list.push({
            name: names[i] || "",
            phone: phones[i] || "",
          });
        }
      }
      return list;
    }
    return [];
  }, [event]);

  const sortedFacultyCoordinators = useMemo(() => {
    if (!event?.facultyCoordinators || !Array.isArray(event.facultyCoordinators)) return [];
    return [...event.facultyCoordinators]
      .filter(c => c && c.name)
      .sort((a, b) => {
        const rankA = getFacultyRank(a?.name || "");
        const rankB = getFacultyRank(b?.name || "");
        if (rankA !== 99 && rankB !== 99) {
          return rankA - rankB;
        }
        return 0;
      });
  }, [event?.facultyCoordinators]);

  const facultyCoordinatorsList = useMemo(() => {
    if (!event) return [];
    if (event.facultyCoordinators && event.facultyCoordinators.length > 0) {
      const valid = event.facultyCoordinators.filter(c => c && ((c.name && typeof c.name === "string" && c.name.trim() !== "") || (c.phone && typeof c.phone === "string" && c.phone.trim() !== "")));
      return [...valid].sort((a, b) => {
        const rankA = getFacultyRank(a?.name || "");
        const rankB = getFacultyRank(b?.name || "");
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
      // Validate the date is real
      if (isNaN(d.getTime())) return event.date;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return event.date;
    }
  }, [event?.date]);

  const computedTargetDate = useMemo(() => {
    if (event?.date && event?.startTime) {
      // Constructs a local ISO-like string e.g., "2026-03-15T10:00:00" which the countdown handles
      return `${event.date}T${event.startTime}:00`;
    }
    return "2026-04-26T09:00:00Z";
  }, [event?.date, event?.startTime]);

  const normalizedRules = useMemo(() => {
    if (!event?.rules) return [];
    if (Array.isArray(event.rules)) {
      return event.rules
        .map((r: any) =>
          typeof r === "string"
            ? r.trim()
            : typeof r?.text === "string"
            ? r.text.trim()
            : typeof r?.rule === "string"
            ? r.rule.trim()
            : String(r || "").trim()
        )
        .filter(Boolean);
    }
    if (typeof event.rules === "string") {
      return (event.rules as string).split("\n").map((r: string) => r.trim()).filter(Boolean);
    }
    return [];
  }, [event?.rules]);

  const teamSize = useMemo(() => parseEventTeamSize(event?.format || ""), [event?.format]);

  const isEventNonTech = useMemo(() => {
    if (myReg?.isNonTech) return true;
    if (!event) return false;
    const cleanTrack = (event.track || "").replace(/ TRACK$/i, "").trim().toUpperCase();
    return cleanTrack === "NON-TECH" || cleanTrack === "NON TECH" || cleanTrack === "NONTECH" || cleanTrack.includes("NON");
  }, [event, myReg?.isNonTech]);

  // If event not found yet
  if (!event) {
    if (fsEventsLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#001d5c] text-white p-4">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-[#FFD700]" />
            <p className="font-display text-xs font-bold uppercase tracking-wider text-white/70">
              Loading Event Details...
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#001d5c] text-white p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">Event not found</h2>
          <button 
            onClick={() => window.history.back()}
            className="px-6 py-2 bg-white/10 rounded-full cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const isSolo = (event.format || "").toLowerCase().includes("individual");
  const initials = (event.title || "EV").substring(0, 2).toUpperCase();

  // Handle Register
  const handleRegister = async () => {
    if (isRegistering) return;

    if (isRegClosed) {
      setToast(event.registrationClosedMessage?.trim() || "Registration is closed for this event!");
      setTimeout(() => setToast(null), 4000);
      return;
    }

    // Direct external Google Form for Non-Tech events (no gate pass, no profile pass, no login required)
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

    // Get effective user with fallback to active auth.currentUser
    const effectiveUser = user || (auth.currentUser ? {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email || "",
      name: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "Participant",
      branch: "",
      phone: "",
      enrollmentNumber: "",
      college: "BVM Engineering College",
      createdAt: new Date().toISOString(),
    } : null);

    if (!effectiveUser) {
      setToast("Please log in first to register!");
      setTimeout(() => setToast(null), 3000);
      return;
    }

    if (registered) {
      navigate({ to: "/profile" });
      return;
    }

    // If event requires or supports a team, open Team Registration Modal
    if (teamSize.requiresTeam) {
      setShowTeamModal(true);
      return;
    }

    setIsRegistering(true);

    // Direct solo registration for individual events
    try {
      await registerForEvent(effectiveUser.uid, event.id, {
        name: effectiveUser.name,
        email: effectiveUser.email || "",
        phone: effectiveUser.phone || "",
        dept: effectiveUser.branch || "",
        enrollmentNumber: (effectiveUser as any).enrollmentNumber || "",
        eventTitle: event.title,
        track: event.track,
        isNonTech: isEventNonTech,
        ...(event.maxSlots !== undefined ? { maxSlots: event.maxSlots } : {}),
      });
      registerEvent(event.id);
      
      // Auto-open calendar with 1-hr & daily reminder alerts if configured
      if (config?.reminderSettings?.autoOpenCalendarOnRegister !== false) {
        openGoogleCalendar(event, config?.reminderSettings || DEFAULT_SITE_CONFIG.reminderSettings);
      }
      // Show calendar reminder confirmation modal with 1-tap Google Calendar & .ics sync
      setShowCalendarSuccessModal(true);
      if (isEventNonTech) {
        setToast(`Registered for ${event.title}! No gate pass needed for fun events — see you there! 🎉`);
      } else {
        setToast(`Registered for ${event.title}! Gate pass generated.`);
      }
      setTimeout(() => {
        setToast(null);
      }, 4000);
    } catch (err: any) {
      setToast(`Registration failed: ${err.message || "Unknown error"}`);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsRegistering(false);
    }
  };

  // Add to Google Calendar with configured reminders
  const handleAddToCalendar = () => {
    openGoogleCalendar(event, config?.reminderSettings || DEFAULT_SITE_CONFIG.reminderSettings);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#003399] to-[#001d5c] text-[#f4f7ff] font-body selection:bg-[#FFD700]/30 selection:text-white flex flex-col justify-between">
      
      {/* 1. Header Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#001d5c]/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => window.history.back()}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider text-white hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <span className="font-display font-bold text-xs sm:text-sm uppercase tracking-wide truncate max-w-[140px] sm:max-w-xs md:max-w-md text-white/90">
            {event.title}
          </span>
          <div className="w-16" />
        </div>
      </header>

      {/* 2. Main 2-Column Content Grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-12">
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
                  {event.track} Track · {event.format}
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

          {/* ════ RIGHT COLUMN: Details & Registration ════ */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Header: Track & Title */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#061a45] px-3.5 py-1.5 border border-white/10 mb-3">
                <span className="h-2 w-2 rounded-full bg-[#FFD700]" />
                <span className="font-display text-xs font-bold uppercase tracking-[0.14em] text-[#a9b8e0]">
                  {event.track} TRACK · {event.format}
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
                      : registered
                      ? "You are Registered! ✓"
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
                ) : registered ? (
                  <span className="rounded-full px-3 py-1 text-xs font-bold border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                    Confirmed ✓
                  </span>
                ) : (
                  <span className="rounded-full px-3 py-1 text-xs font-bold border bg-emerald-500/15 text-emerald-300 border-emerald-500/30 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Open
                  </span>
                )}
              </div>

              {/* Team Registration Info (when registered) */}
              {registered && teamRoster?.isTeam && (
                <div className="rounded-xl bg-black/25 border border-white/10 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-[#FFD700] uppercase text-[10px] tracking-wider flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> Team: {teamRoster.teamName}
                    </span>
                    <span className="text-[10px] text-[#a9b8e0] font-medium">
                      {teamRoster.isCurrentUserLeader ? "★ Team Leader" : "Team Member"} ({teamRoster.totalMembers} members)
                    </span>
                  </div>
                  <div className="text-[11px] text-white/90 flex flex-wrap items-center gap-1.5 pt-0.5">
                    {teamRoster.leader && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-amber-300 font-semibold">
                        <Crown className="h-3 w-3 text-amber-400" /> {teamRoster.leader.name} {teamRoster.leader.isCurrentUser && "(You)"}
                      </span>
                    )}
                    {(teamRoster.members || []).map((tm, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white/10 border border-white/10 px-2 py-0.5 text-white/90">
                        <User className="h-3 w-3 text-white/50" />
                        {tm.name} {tm.isCurrentUser && <span className="text-[#FFD700] font-bold">(You)</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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

                  {/* Register Button (Right Side of Calendar Button) */}
                  <button
                    type="button"
                    disabled={isRegClosed || (!isEventNonTech && registered) || isRegistering}
                    aria-disabled={isRegClosed || (!isEventNonTech && registered) || isRegistering}
                    onClick={isRegClosed || (!isEventNonTech && registered) || isRegistering ? undefined : handleRegister}
                    className={cn(
                      "flex-1 h-13 rounded-xl font-display text-sm sm:text-base font-black uppercase tracking-[0.12em] transition-all flex items-center justify-center gap-2 select-none shadow-lg",
                      isRegClosed
                        ? "bg-gradient-to-r from-rose-950/70 via-red-950/70 to-rose-950/70 border-2 border-rose-500/50 text-rose-200 cursor-not-allowed shadow-none opacity-90 pointer-events-none"
                        : (!isEventNonTech && registered)
                        ? "bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-300 cursor-not-allowed shadow-none opacity-90 pointer-events-none"
                        : isRegistering
                        ? "bg-[#FFD700]/70 text-[#001d5c] cursor-wait opacity-80"
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
                    ) : registered ? (
                      <>
                        <Check className="h-5 w-5 text-emerald-400 stroke-[3]" />
                        Already Registered
                      </>
                    ) : isRegistering ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-[#001d5c]" />
                        Registering...
                      </>
                    ) : teamSize.requiresTeam ? (
                      "Register Team"
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
                {isRegClosed && !registered && (
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

                {registered && !isEventNonTech && (
                  <button
                    type="button"
                    onClick={() => setShowPassModal(true)}
                    className="w-full h-12 rounded-xl bg-[#003399] border-2 border-[#FFD700]/70 font-display text-xs sm:text-sm font-black uppercase tracking-[0.1em] text-white hover:bg-[#002980] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                    title="View official entry pass & QR code"
                  >
                    <QrCode className="h-4 w-4 text-[#FFD700]" />
                    <span>View Official Entry Pass & QR Code</span>
                  </button>
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

            {/* Rules & Guidelines */}
            {normalizedRules.length > 0 && (
              <section className="bg-[#061a45] rounded-xl p-5 sm:p-6 border border-white/5 shadow-sm">
                <h3 className="font-display text-xs font-bold uppercase tracking-[0.15em] text-[#FFD700] mb-4">
                  Rules & Guidelines
                </h3>
                <div className="space-y-2.5">
                  {normalizedRules.map((rule: string, idx: number) => {
                    const isBullet = isBulletRule(rule);

                    if (!isBullet) {
                      // Section Heading (e.g. "Before You Start", "For 1st Round (Quiz)", "Time Split", "Round 2nd CTF (Capture the Flag)")
                      return (
                        <div key={idx} className={cn("pt-4 pb-1", idx === 0 && "pt-0")}>
                          <h4 className="font-display text-sm sm:text-base font-bold text-[#38BDF8] tracking-wide flex items-center gap-2">
                            <span className="h-2 w-2 rounded-sm bg-[#38BDF8] shadow-[0_0_8px_#38BDF8]" />
                            {renderFormattedRuleText(rule.trim())}
                          </h4>
                        </div>
                      );
                    }

                    // Bullet point: Keep gold checkmark tick symbol and strip leading bullet character
                    return (
                      <div key={idx} className="flex items-start gap-3 pl-1 sm:pl-2">
                        <span className="flex mt-0.5 h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[4px] border border-[#FFD700]/70 bg-[#061a45] text-[#FFD700] shadow-[0_0_6px_rgba(255,215,0,0.15)]">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </span>
                        <span className="font-body text-sm leading-relaxed text-[#f4f7ff]">
                          {renderFormattedRuleText(cleanRuleText(rule))}
                        </span>
                      </div>
                    );
                  })}
                </div>
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



      {/* Official QR Pass Modal */}
      {showPassModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowPassModal(false)}
        >
          <div 
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border-4 border-[#061a45] bg-white p-6 shadow-2xl text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowPassModal(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 grid place-items-center transition-colors cursor-pointer"
              title="Close Pass"
            >
              <X className="h-4 w-4 text-slate-600" />
            </button>

            {/* Header */}
            <div className="text-center">
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full font-bold text-[10px] px-3 py-0.5 border mb-2",
                isEventNonTech
                  ? "bg-purple-50 text-purple-800 border-purple-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              )}>
                {isEventNonTech ? (
                  <>
                    <Sparkles className="h-3 w-3 text-purple-600" />
                    FUN EVENT REGISTRATION CONFIRMED
                  </>
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    OFFICIAL ENTRY PASS
                  </>
                )}
              </span>
              <h3 className="font-display text-2xl font-black uppercase text-[#001d5c]">
                {event.title}
              </h3>
              <p className={cn(
                "text-xs font-bold uppercase tracking-wider",
                isEventNonTech ? "text-purple-700 font-extrabold" : "text-slate-500"
              )}>
                {isEventNonTech ? "NON-TECH FUN EVENT · NO PASS NEEDED" : `${event.track} Track · ${event.format}`}
              </p>
            </div>

            {isEventNonTech ? (
              /* Non-Tech Joyful Confirmation Box (NO QR CODE) */
              <div className="my-5 flex flex-col items-center text-center rounded-xl bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-200/80 p-5 shadow-inner">
                <div className="h-12 w-12 rounded-2xl bg-[#FFE817] border-[2px] border-black flex items-center justify-center shadow-[3px_3px_0_#000] mb-2 text-2xl">
                  🎈
                </div>
                <h4 className="font-display text-base font-black uppercase tracking-wide text-slate-900">
                  You're Officially Registered!
                </h4>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed max-w-sm">
                  This is a fun event, so <strong>no gate pass or QR code is required</strong>. Your spot is officially secured on the roster. Just head over to the venue and have an awesome time!
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Spot Secured on Roster ✓
                </span>
              </div>
            ) : (
              /* Tech Official QR Code Container */
              <div className="my-5 flex flex-col items-center justify-center rounded-xl bg-slate-50 border-2 border-slate-200 p-5 shadow-inner">
                {myReg ? (
                  <>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <QRCodeSVG
                        value={myReg.qrToken || myReg.entryCode || myReg.id || "CONVERSE-PASS"}
                        size={185}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                    <div className="mt-3 text-center">
                      <p className="font-display text-[10px] font-bold uppercase tracking-wider text-neutral-400">Verification Code</p>
                      <p className="font-mono text-2xl font-black tracking-[0.25em] text-[#001d5c]">
                        {myReg.entryCode}
                      </p>
                    </div>
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold" style={{ borderColor: myReg.checkedIn ? 'rgb(34 197 94 / 0.4)' : 'rgb(5 150 105 / 0.3)', backgroundColor: myReg.checkedIn ? 'rgb(34 197 94 / 0.1)' : 'rgb(236 253 245)', color: myReg.checkedIn ? 'rgb(22 163 74)' : 'rgb(21 128 61)' }}>
                      <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: myReg.checkedIn ? 'rgb(34 197 94)' : 'rgb(16 185 129)' }} />
                      {myReg.checkedIn ? "Checked In ✓" : "Active Gate Token"}
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="h-[185px] w-[185px] rounded-xl border border-slate-200 bg-white animate-pulse flex items-center justify-center">
                      <QrCode className="h-10 w-10 text-slate-200" />
                    </div>
                    <p className="font-display text-[10px] font-bold uppercase tracking-wider text-neutral-400 animate-pulse">
                      Loading your gate pass…
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Event & Pass Metadata */}
            <div className="space-y-2 rounded-xl bg-slate-50 p-3.5 text-xs border border-slate-200">
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">Pass Holder</span>
                <span className="font-bold text-slate-800">{user?.name || myReg?.userName || "Participant"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">Venue & Time</span>
                <span className="font-medium text-slate-700">{event.venue || "SCET"} · {event.time || "10:00 AM"}</span>
              </div>
              {teamRoster?.isTeam && teamRoster.teamName && (
                <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Team Name</span>
                  <span className="font-bold text-[#003399]">{teamRoster.teamName}</span>
                </div>
              )}

              {/* Team Members Roster: Clear Leader & All Members */}
              {teamRoster?.isTeam && (
                <div className="pt-1 border-t border-slate-200/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-display font-bold text-slate-600 uppercase text-[10px] tracking-wider flex items-center gap-1">
                      <Users className="h-3 w-3 text-slate-500" /> Team Members ({teamRoster.totalMembers})
                    </span>
                    <span className="text-[10px] font-bold text-[#003399]">
                      {teamRoster.isCurrentUserLeader ? "★ You are Leader" : "Team Entry"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {/* Team Leader */}
                    {teamRoster.leader && (
                      <div className="flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Crown className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          <span className="font-bold text-slate-900 truncate">
                            {teamRoster.leader.name} {teamRoster.leader.isCurrentUser && <span className="text-amber-700 font-semibold text-[11px]">(You)</span>}
                          </span>
                        </div>
                        <span className="shrink-0 text-[9px] font-display font-black uppercase tracking-wider bg-amber-500/20 text-amber-900 border border-amber-500/40 rounded px-1.5 py-0.5">
                          Leader
                        </span>
                      </div>
                    )}

                    {/* Teammates */}
                    {(teamRoster.members || []).map((tm, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-800 truncate">
                            {tm.name} {tm.isCurrentUser && <span className="text-[#003399] font-bold text-[11px]">(You)</span>}
                          </span>
                        </div>
                        <span className="shrink-0 text-[9px] font-display font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                          Member
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowPassModal(false)}
              className="mt-4 w-full h-11 rounded-xl bg-[#001d5c] font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-[#002980] transition-colors cursor-pointer"
            >
              Close Pass
            </button>
          </div>
        </div>
      )}

      {/* Team Registration Modal */}
      {showTeamModal && (user || auth.currentUser) && (
        <TeamRegistrationModal
          isOpen={showTeamModal}
          onClose={() => setShowTeamModal(false)}
          event={event}
          currentUser={user || {
            uid: auth.currentUser!.uid,
            email: auth.currentUser!.email || "",
            name: auth.currentUser!.displayName || auth.currentUser!.email?.split("@")[0] || "Participant",
            branch: "",
            phone: "",
            college: "BVM Engineering College",
            createdAt: new Date().toISOString(),
          }}
          onSuccess={(regData) => {
            registerEvent(event.id);
            // Auto-open calendar with 1-hr & daily reminder alerts if configured
            if (config?.reminderSettings?.autoOpenCalendarOnRegister !== false) {
              openGoogleCalendar(event, config?.reminderSettings || DEFAULT_SITE_CONFIG.reminderSettings);
            }
            // Show calendar reminder confirmation modal with 1-tap Google Calendar & .ics sync
            setShowCalendarSuccessModal(true);
            setToast(`Registered team for ${event.title}! Reminder sync ready.`);
            setTimeout(() => setToast(null), 4000);
          }}
        />
      )}

      {/* Post-Registration Calendar & Reminder Modal */}
      {showCalendarSuccessModal && (
        <RegistrationCalendarModal
          isOpen={showCalendarSuccessModal}
          onClose={() => setShowCalendarSuccessModal(false)}
          event={event}
          settings={config?.reminderSettings || DEFAULT_SITE_CONFIG.reminderSettings}
          onViewPass={() => {
            setShowCalendarSuccessModal(false);
            setShowPassModal(true);
          }}
        />
      )}

      {/* Universal Footer (No bottom gap) */}
      <SiteFooter />

      {/* Floating WhatsApp and Instagram Links for this Event */}
      <EventFloatingSocials
        whatsappUrl={event.whatsappGroupUrl}
        instagramUrl={event.instagramUrl}
        eventTitle={event.title}
      />

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-[#FFD700] text-[#001d5c] px-4 py-2 rounded-lg font-display text-xs font-bold uppercase tracking-wider shadow-xl animate-in slide-in-from-top-4">
          {toast}
        </div>
      )}
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

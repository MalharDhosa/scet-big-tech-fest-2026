import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageTransitionLoader } from "@/components/brick/PageTransitionLoader";
import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/brick/BaseplateNav";
import { BrickCard } from "@/components/brick/BrickCard";
import { BrickButton } from "@/components/brick/BrickButton";
import { BrickInput } from "@/components/brick/BrickInput";
import { EventCard, gridStaggerVariant } from "@/components/brick/EventCard";
import { FEST_EVENTS, useFestState, type FestEvent } from "@/lib/fest-state";
import { useAuth } from "@/lib/firebase-auth";
import { useFirestoreEvents } from "@/lib/firebase-events";
import { registerForEvent, parseEventTeamSize, useMyRegistrations, isUserRegisteredForEvent } from "@/lib/firebase-registrations";
import { toEventSlug, getEventSlug } from "@/lib/event-slugs";
import { useSiteConfig, DEFAULT_SITE_CONFIG } from "@/lib/firebase-site-config";
import { openGoogleCalendar } from "@/lib/calendar-reminders";
import { EventFloatingSocials } from "@/components/brick/EventFloatingSocials";
import { cn } from "@/lib/utils";
import { X, Clock, MapPin, Award, ArrowRight, Calendar } from "lucide-react";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events — CONVERSE 2K26 | The Build Site" },
      {
        name: "description",
        content:
          "Browse and register for CONVERSE 2K26 events across Tech, Non-Tech, and Robotics tracks — solo challenges, team battles and build sprints.",
      },
      { property: "og:title", content: "The Build Site — CONVERSE 2K26 Events" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: EventsPage,
});

const FILTERS = ["All", "Tech Track", "Non-Tech Track", "Team Events", "Solo Events"] as const;
type Filter = (typeof FILTERS)[number];

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 60 }).map((_, i) => ({
        left: Math.random() * 100,
        dx: Math.random() * 300 - 150,
        dy: 300 + Math.random() * 400,
        delay: Math.random() * 200,
        color: ["#FFD700", "#C91A09", "#0055BF", "#003399", "#FFFFFF"][i % 5]!,
        size: 8 + Math.random() * 8,
      })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute top-1/2 rounded-full border-[2px] border-brick-black"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            background: b.color,
            // @ts-expect-error custom props
            "--dx": `${b.dx}px`,
            "--dy": `${b.dy}px`,
            animation: `stud-fall 1400ms ease-in ${b.delay}ms forwards`,
          }}
        />
      ))}
    </div>
  );
}

function EventsPage() {
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const { events: fsEvents } = useFirestoreEvents();
  const { user, loading: authLoading } = useAuth();
  const { totalCount, registerEvent } = useFestState(user?.uid, user?.email);
  const { registrations } = useMyRegistrations(user?.uid, user?.email);
  const [filter, setFilter] = useState<Filter>("All");
  const [modal, setModal] = useState<FestEvent | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  // Close modal on Escape key
  useEffect(() => {
    if (!modal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal]);

  // Dynamically merged list of all festival events
  const allEvents = useMemo(() => {
    const list = FEST_EVENTS.map((fe, idx) => {
      const dynamicEvent = fsEvents.find((e) => e.id === fe.id);
      const merged = { ...fe, ...(dynamicEvent || {}) };
      merged.number = merged.number || `#0${idx + 1}`;
      return merged as FestEvent;
    });

    // Append any extra events created in Firestore that are not in FEST_EVENTS
    fsEvents.forEach((fe) => {
      if (!list.some((e) => e.id === fe.id)) {
        list.push({
          ...fe,
          number: fe.number || `#0${list.length + 1}`,
        } as FestEvent);
      }
    });

    // Deduplicate strictly by ID and normalized title
    const seen = new Set<string>();
    return list.filter((e) => {
      const key = (e.id || e.title || "").toLowerCase().trim();
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [fsEvents]);

  const effectiveRegisteredCount = useMemo(() => {
    return allEvents.filter((e) => isUserRegisteredForEvent(e, registrations)).length;
  }, [allEvents, registrations]);

  const visible = useMemo(() => {
    return allEvents.filter((e) => {
      if (filter === "All") return true;
      if (filter === "Tech Track") {
        const cleanTrack = (e.track || "").replace(/ TRACK$/i, "").toUpperCase();
        return cleanTrack === "TECH" || cleanTrack === "IT";
      }
      if (filter === "Non-Tech Track") {
        const cleanTrack = (e.track || "").replace(/ TRACK$/i, "").trim().toUpperCase();
        return cleanTrack === "NON-TECH" || cleanTrack === "NON TECH" || cleanTrack === "NONTECH" || cleanTrack.includes("NON") || cleanTrack === "AIDS";
      }
      const teamInfo = parseEventTeamSize(e.format || "");
      if (filter === "Team Events") {
        // Team events includes Solo-Duo, Duo, and Squad/Teams where 2 or more can register
        return teamInfo.isTeam || teamInfo.max > 1;
      }
      if (filter === "Solo Events") {
        // Strictly solo events ONLY (NO duo, NO team events!)
        return teamInfo.isStrictlySolo && teamInfo.max === 1;
      }
      return true;
    });
  }, [filter, allEvents]);

  // Auth guard — redirect to login if not authenticated, or to onboarding if not onboarded
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate({ to: "/" });
      } else if (user.role === 'master') {
        navigate({ to: "/admin/master" });
      } else if (user.role === 'sub-admin') {
        navigate({ to: "/admin/subadmin" });
      } else if (user.role === 'admin') {
        navigate({ to: "/admin/scanner" });
      } else if (!user.onboarded) {
        navigate({ to: "/onboarding" });
      }
    }
  }, [user, authLoading, navigate]);

  // Auth guard — render loader while checking authentication or redirecting (AFTER all hooks)
  if (authLoading || !user || (user.role !== 'admin' && user.role !== 'sub-admin' && user.role !== 'master' && !user.onboarded)) {
    return <PageTransitionLoader />;
  }

  const eventsConfig = config?.events || DEFAULT_SITE_CONFIG.events;

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    if (!user) {
      setToast("Please log in first to register for events!");
      setTimeout(() => setToast(null), 3000);
      return;
    }
    try {
      // Write to Firestore (creates the QR token)
      await registerForEvent(user.uid, modal.id, {
        name: user.name,
        email: user.email || "",
        phone: user.phone || "",
        dept: user.branch || "",
        enrollmentNumber: user.enrollmentNumber || "",
      });
      // Write to localStorage (for offline UI state)
      registerEvent(modal.id);
      if (config?.reminderSettings?.autoOpenCalendarOnRegister !== false) {
        openGoogleCalendar(modal, config?.reminderSettings || DEFAULT_SITE_CONFIG.reminderSettings);
      }
      setCelebrate(true);
      setToast(`Registered for ${modal.title} — QR Pass generated!`);
      setModal(null);
      setTimeout(() => {
        setCelebrate(false);
        setToast(null);
      }, 2600);
    } catch (err: any) {
      console.error("Registration error:", err);
      setToast(`Registration failed: ${err.message || "Unknown error"}`);
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <AppShell>
      {/* ─── Page Header with brick accent ─── */}
      <div className="snap-in flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-[4px] border-[3px] border-brick-black bg-brick-red px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-[0.22em] text-brick-white brick-bevel-sm">
            <span className="inline-block h-2 w-2 rounded-full border-[2px] border-brick-white/40 bg-brick-yellow" />
            The Build Site
          </span>
          <h1 className="mt-3 text-2xl uppercase md:text-3xl">{eventsConfig.pageTitle}</h1>
          <p className="mt-1 font-body text-sm text-brick-black/60 max-w-sm">
            {eventsConfig.pageDesc}
          </p>
        </div>

        {/* ─── Clear & Intuitive Event Registration Tracker ─── */}
        <div className="flex flex-col gap-2 rounded-[6px] border-[2.5px] border-brick-black bg-brick-white px-4 py-3 shadow-[3.5px_3.5px_0_#0D0D0D]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-brick-blue" />
              <span className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-brick-black">
                Event Registrations
              </span>
            </div>
            <span
              className={cn(
                "rounded-[3px] border-[1.5px] border-brick-black px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.08em]",
                effectiveRegisteredCount > 0
                  ? "bg-brick-yellow text-brick-black"
                  : "bg-neutral-100 text-brick-black/60"
              )}
            >
              {effectiveRegisteredCount} of {allEvents.length} Joined
            </span>
          </div>

          {/* Event Slots with numbers and registered checkmarks */}
          <div className="flex items-center gap-1.5 pt-0.5">
            {allEvents.map((ev, idx) => {
              const registered = isUserRegisteredForEvent(ev, registrations);
              const targetSlug = getEventSlug(ev);
              return (
                <button
                  key={ev.id}
                  type="button"
                  title={`${ev.number || `#0${idx+1}`}: ${ev.title} ${registered ? "(Registered ✓)" : "(Click to inspect)"}`}
                  onClick={() => {
                    const el = document.getElementById(`event-card-${ev.id}`) || document.querySelector(`[data-event-slug="${targetSlug}"]`);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                      el.classList.add("rattle");
                      setTimeout(() => el.classList.remove("rattle"), 600);
                    }
                  }}
                  className={cn(
                    "group relative flex h-7 w-7 items-center justify-center rounded-[4px] border-[2px] border-brick-black font-display text-[10px] font-bold transition-all duration-150 hover:-translate-y-0.5 cursor-pointer",
                    registered
                      ? "bg-brick-yellow text-brick-black shadow-[1.5px_2px_0_#0D0D0D]"
                      : "bg-[#F3F4F6] text-brick-black/50 hover:bg-[#E5E7EB] hover:text-brick-black"
                  )}
                  style={{
                    boxShadow: registered
                      ? "inset 0 1.5px 0 rgba(255,255,255,0.7), 1.5px 2px 0 #0D0D0D"
                      : "inset 0 1px 0 rgba(255,255,255,0.9), 1px 1px 0 rgba(0,0,0,0.15)",
                  }}
                >
                  {registered ? (
                    <span className="font-extrabold text-brick-black">✓</span>
                  ) : (
                    <span>{idx + 1}</span>
                  )}

                  {/* Hover Tooltip showing Event Name & Click to Scroll */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-[4px] border-[2px] border-brick-black bg-brick-black px-2 py-1 font-display text-[9px] font-bold uppercase tracking-[0.06em] text-brick-white shadow-[2px_2px_0_rgba(0,0,0,0.4)] group-hover:block">
                    {ev.number || `#0${idx+1}`}: {ev.title} {registered ? "(Joined ✓)" : "(Click to inspect)"}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Contextual Status Subtitle */}
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-body text-brick-black/60">
              {effectiveRegisteredCount === 0
                ? "Click any event or 'REGISTER' below to join"
                : `${effectiveRegisteredCount} of ${allEvents.length} events claimed on your schedule ✓`}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Filter Bar: pill-shaped LEGO bricks ─── */}
      <div className="-mx-4 mt-6 mb-8 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:px-0">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "relative shrink-0 rounded-[6px] border-[3px] border-brick-black px-4 pb-2 pt-3.5 font-display text-xs font-bold uppercase tracking-[0.1em] shadow-[3px_3px_0_#0D0D0D] transition-transform duration-120",
              filter === f
                ? "translate-y-[2px] bg-brick-yellow text-brick-black shadow-[1px_1px_0_#0D0D0D]"
                : "brick-bevel-sm bg-brick-white text-brick-black hover:-translate-y-[1px] hover:shadow-[4px_4px_0_#0D0D0D] active:translate-y-[2px] active:shadow-[1px_1px_0_#0D0D0D]",
            )}
          >
            {/* Mini stud pair on top of each filter brick */}
            <span className="absolute left-1/2 top-[3px] flex -translate-x-1/2 gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full border border-brick-black/30 bg-brick-black/20" />
              <span className="h-1.5 w-1.5 rounded-full border border-brick-black/30 bg-brick-black/20" />
            </span>
            {f}
          </button>
        ))}
      </div>

      {/* ─── Standardized Event Grid — Scroll-Reveal Staggered ─── */}
      <motion.div
        className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
        variants={gridStaggerVariant}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        key={`${filter}-${visible.map((e) => e.id).join("-")}`}
      >
        {visible.map((e) => (
          <EventCard
            key={e.id}
            event={e}
            registered={isUserRegisteredForEvent(e, registrations)}
            onClick={() => navigate({ to: "/events/$eventId", params: { eventId: getEventSlug(e) } })}
          />
        ))}
      </motion.div>



      {celebrate && <Confetti />}

      {toast && (
        <div
          className="fixed left-1/2 top-5 z-[70]"
          style={{ animation: "toast-drop 420ms cubic-bezier(0.22,1.4,0.36,1) both" }}
        >
          <div className="flex items-center gap-2 rounded-[5px] border-[3px] border-brick-black bg-brick-yellow px-4 py-2 font-display text-xs font-bold uppercase tracking-[0.1em] text-brick-black shadow-[4px_4px_0_#0D0D0D] brick-bevel-sm">
            <span className="h-2 w-2 rounded-full border border-brick-black bg-green-500" />
            {toast}
          </div>
        </div>
      )}

      {/* Floating WhatsApp and Instagram Links for Festival Community (About Page Link) */}
      <EventFloatingSocials
        whatsappUrl={config.about?.whatsappUrl || "https://chat.whatsapp.com/EzV0MybDcYdG8kYBEG9D32"}
        instagramUrl={config.about?.instagramUrl || "https://instagram.com/converseitaids"}
        eventTitle="CONVERSE 2K26"
        promptText="Click to join the group!"
        tooltipText="Join Fest WhatsApp Group"
      />
    </AppShell>
  );
}


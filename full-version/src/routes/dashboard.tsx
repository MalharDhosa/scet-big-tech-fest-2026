import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageTransitionLoader } from "@/components/brick/PageTransitionLoader";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/brick/BaseplateNav";
import { InfoCard } from "@/components/brick/InfoCard";
import { BrickCard } from "@/components/brick/BrickCard";
import { BrickButton } from "@/components/brick/BrickButton";
import { EventCard, gridStaggerVariant, cardRevealVariant } from "@/components/brick/EventCard";
import { CountdownTimer } from "@/components/brick/CountdownTimer";
import { FEST_EVENTS, useFestState, type FestEvent } from "@/lib/fest-state";
import { useFirestoreEvents } from "@/lib/firebase-events";
import { toEventSlug, getEventSlug } from "@/lib/event-slugs";
import { useSiteConfig, DEFAULT_SITE_CONFIG } from "@/lib/firebase-site-config";
import { useAuth } from "@/lib/firebase-auth";
import { EventRoadmapSection } from "@/components/brick/EventRoadmapSection";
import {
  Calendar,
  Clock,
  Trophy,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Sparkles,
  Flame,
  Zap,
  Swords,
  Lightbulb,
  Handshake,
  Crosshair,
  Users,
  Award,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CONVERSE 2K26 | Master Builder Hub" },
      {
        name: "description",
        content:
          "Your CONVERSE 2K26 participant hub: track registered events, teams and participation.",
      },
      { property: "og:title", content: "Master Builder Hub — CONVERSE 2K26" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Dashboard,
});

/* ---------- explore cards (4 Pillars) ---------- */
const EXPLORE = [
  {
    icon: Swords,
    title: "Compete",
    desc: "High-stakes coding sprints, rapid quizzes, and algorithmic challenges against the sharpest minds.",
    accent: "var(--brick-yellow)",
    brickColor: "#FFD700",
  },
  {
    icon: Lightbulb,
    title: "Create",
    desc: "Architect resilient cloud systems, craft brand identities, and write elegant software from scratch.",
    accent: "var(--brick-blue)",
    brickColor: "#0055BF",
  },
  {
    icon: Handshake,
    title: "Collaborate",
    desc: "Form multi-disciplinary squads across AIDS, IT, CO, and engineering wings to ideate and win.",
    accent: "var(--brick-red)",
    brickColor: "#C91A09",
  },
  {
    icon: Trophy,
    title: "Conquer",
    desc: "Win prestigious trophies, earn up to 50 college credits, and gain recognition for your department.",
    accent: "var(--brick-yellow)",
    brickColor: "#FFD700",
  },
] as const;

/** Thin LEGO baseplate divider between sections */
function BaseplateDivider({ color = "#0055BF" }: { color?: string }) {
  return (
    <div className="my-10 flex items-center gap-3">
      <span
        className="h-[4px] flex-1 rounded-full"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${color}33 20%, ${color}33 80%, transparent 100%)`,
        }}
      />
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-3 w-3 rounded-full border-[2px] border-brick-black/30"
          style={{
            background: color,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.2)",
          }}
        />
      ))}
      <span
        className="h-[4px] flex-1 rounded-full"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${color}33 20%, ${color}33 80%, transparent 100%)`,
        }}
      />
    </div>
  );
}

/** Section label with stud accent */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-brick-black/55">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full border-[1.5px] border-brick-black"
        style={{
          background: "var(--brick-yellow)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
        }}
      />
      {children}
    </span>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { totalCount, isRegistered } = useFestState(user?.uid);
  const { config } = useSiteConfig();
  const dashboardConfig = config?.dashboard || DEFAULT_SITE_CONFIG.dashboard;
  const landingConfig = config?.landing || DEFAULT_SITE_CONFIG.landing;
  const [activeTrack, setActiveTrack] = useState<"TECH" | "NON-TECH">("TECH");

  const { events: fsEvents } = useFirestoreEvents();

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
      const key = (e.id || e.title).toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [fsEvents]);

  // First 3 events from event list for preview
  const previewEvents = useMemo(() => allEvents.slice(0, 3), [allEvents]);

  // Events filtered by active track for interactive preview
  const trackEvents = useMemo(() => {
    return allEvents.filter((e) => {
      const tr = (e.track || "").replace(/ TRACK$/i, "").trim().toUpperCase();
      if (activeTrack === "TECH") return tr === "TECH" || tr === "IT";
      return tr === "NON-TECH" || tr === "NON TECH" || tr === "NONTECH" || tr.includes("NON") || tr === "AIDS";
    });
  }, [allEvents, activeTrack]);

  // Auth/Onboarding Guard
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

  if (authLoading || !user || (user.role !== 'admin' && user.role !== 'sub-admin' && user.role !== 'master' && !user.onboarded)) return <PageTransitionLoader />;

  return (
    <AppShell>
      {/* ============================================================ */}
      {/* HERO SECTION — Fills initial viewport so only hero is seen   */}
      {/* ============================================================ */}
      <section className="snap-in-hero flex flex-col justify-center gap-6 pb-6 pt-2 md:min-h-[calc(100vh-5.5rem)] md:flex-row md:items-center md:gap-8 lg:gap-12">
        {/* LEFT — Main Hero Brand Centerpiece, CTAs, User Identity */}
        <div className="flex-1">

          {/* Crowned Hero Centerpiece: High-Res 3D LEGO "C" Main Logo + CONVERSE 2K26 */}
          <div className="mt-3.5 flex items-center gap-4 sm:gap-6">
            {/* 3D LEGO Logo Star Showcase */}
            <div className="group relative shrink-0">
              {/* Subtle ambient light aura */}
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-tr from-brick-yellow/45 via-brick-red/30 to-brick-blue/45 blur-md opacity-80 animate-pulse" />
              {/* Embossed tactile LEGO base box */}
              <div className="relative flex h-20 w-20 sm:h-28 sm:w-28 items-center justify-center rounded-xl border-[3.5px] border-brick-black bg-white p-2 shadow-[4px_4px_0_#0D0D0D] transition-all duration-300 group-hover:scale-105 group-hover:rotate-2 group-hover:shadow-[6px_6px_0_#0D0D0D]">
                {/* 3 Studs along top of logo pedestal */}
                <div className="pointer-events-none absolute -top-2 flex gap-1.5" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-3 rounded-full border border-brick-black bg-brick-yellow shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                    />
                  ))}
                </div>
                <img
                  src="/c-logo.png"
                  alt="CONVERSE 2K26 Main Logo"
                  className="h-full w-full object-contain filter drop-shadow-[0_6px_10px_rgba(0,0,0,0.32)] animate-float"
                />
              </div>
            </div>

            {/* Bold, Bright & Large CONVERSE 2K26 with 2K26 below CONVERSE */}
            <h1 className="font-display text-[clamp(2.2rem,6.5vw,4.6rem)] font-extrabold uppercase leading-[0.88] tracking-[0.02em]">
              <span
                className="block"
                style={{
                  color: "#FFD700",
                  WebkitTextStroke: "2.5px #0D0D0D",
                  textShadow: "3px 3px 0 #0D0D0D, 5px 5px 0 rgba(0,0,0,0.25)",
                  fontStyle: "italic",
                }}
              >
                CONVERSE
              </span>
              <span
                className="block"
                style={{
                  color: "#0055BF",
                  WebkitTextStroke: "2.5px #0D0D0D",
                  textShadow: "3px 3px 0 #0D0D0D, 5px 5px 0 rgba(0,0,0,0.25)",
                  fontStyle: "italic",
                }}
              >
                2K26
              </span>
            </h1>
          </div>

          {/* Tagline */}
          <h2 className="mt-3 font-display text-lg font-bold uppercase tracking-[0.03em] text-brick-black md:text-xl lg:text-[1.35rem]">
            {dashboardConfig.tagline}
          </h2>

          {/* Feature Chips */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 rounded-[5px] border-[3px] border-brick-black bg-brick-yellow px-3 py-1 font-display text-[10px] font-bold uppercase tracking-[0.1em] text-brick-black shadow-[3px_3px_0_#0D0D0D] brick-bevel-sm">
              <span className="h-2 w-2 rounded-full border-[1.5px] border-brick-black bg-brick-red" />
              {landingConfig.datePill}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-[4px] border-[2px] border-brick-black bg-brick-blue/20 px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-[0.1em] text-brick-blue brick-bevel-sm">
              <Zap className="h-3.5 w-3.5 text-brick-blue" /> 7 Challenges
            </span>
          </div>

          <p className="mt-2 max-w-lg font-body text-xs leading-relaxed text-brick-black/70 md:text-sm">
            {dashboardConfig.heroDesc}
          </p>

          {/* LEGO Builder Identity Pill with Minifig Avatar */}
          <div className="mt-3.5 inline-flex max-w-full flex-wrap items-center gap-2.5 sm:gap-3 rounded-[6px] border-[2px] border-brick-black bg-brick-white px-3 sm:px-3.5 py-1.5 shadow-[2px_2px_0_#0D0D0D] brick-bevel-sm">
            {/* Minifig Head Icon */}
            <div className="relative">
              <div className="grid h-6 w-5 place-items-center rounded-t-[4px] rounded-b-[2px] border-[1.5px] border-brick-black bg-brick-yellow text-[10px] font-bold text-brick-black">
                •ᴗ•
              </div>
              <span className="absolute -top-1 left-1/2 h-1.5 w-2 -translate-x-1/2 rounded-full border border-brick-black bg-brick-yellow" />
            </div>

            <div className="font-body text-xs text-brick-black/75">
              Builder: <strong className="font-semibold text-brick-black">{user.name}</strong>
            </div>

            <span
              className="rounded-[3px] border-[1.5px] border-brick-black/20 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-[0.1em]"
              style={{
                backgroundColor: user.branch === "IT" ? "var(--brick-yellow)" : "var(--brick-blue)",
                color: user.branch === "IT" ? "var(--brick-black)" : "var(--brick-white)",
              }}
            >
              {user.branch || "Participant"}
            </span>
          </div>

          {/* CTA buttons */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link to="/events">
              <BrickButton variant="yellow" size="lg">
                Explore Events <ArrowRight className="ml-1 inline h-4 w-4" />
              </BrickButton>
            </Link>
            <Link to="/profile">
              <BrickButton variant="blue">
                View Profile
              </BrickButton>
            </Link>
          </div>
        </div>

        {/* RIGHT — "Build your day" Box: Steady & Clean with Small Professional Live Timer */}
        <div className="relative w-full shrink-0 md:w-[390px] lg:w-[420px]">
          {/* 4 Raised LEGO Studs on top */}
          <div
            className="pointer-events-none absolute -top-3.5 left-0 z-20 flex w-full justify-center gap-3.5 px-4"
            aria-hidden
          >
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="relative flex h-5 w-5 items-center justify-center rounded-full border-[2.5px] border-brick-black transition-transform duration-200"
                style={{
                  background: "#FFD700",
                  boxShadow:
                    "inset 0 2px 0 rgba(255,255,255,0.7), inset 0 -2px 0 rgba(0,0,0,0.25), 0 3px 0 #0D0D0D",
                }}
              >
                {/* Inner embossed center pip [•] */}
                <span
                  className="h-1.5 w-1.5 rounded-full border border-brick-black/45 bg-brick-black/25"
                  style={{
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
                  }}
                />
              </span>
            ))}
          </div>

          <BrickCard
            surface="white"
            studs={0}
            className="snap-in relative px-6 pb-6 pt-7 shadow-[4.5px_4.5px_0_#0D0D0D]"
            style={{ animationDelay: "150ms" }}
          >

            {/* Small & Professional Live Event Countdown Timer */}
            <div className="mt-3">
              <CountdownTimer />
            </div>

            {/* Colorful LEGO track divider */}
            <div
              className="mt-3.5 h-1.5 w-full rounded-full border border-brick-black/20"
              style={{
                background:
                  "repeating-linear-gradient(90deg, #FFD700 0 14px, #0055BF 14px 28px, #C91A09 28px 42px)",
              }}
            />

            {/* Headline */}
            <h3 className="mt-3 font-display text-2xl font-bold uppercase tracking-[0.02em] text-brick-black md:text-3xl">
              {dashboardConfig.buildBoxTitle}
            </h3>
            <p className="mt-2 font-body text-xs text-brick-black/60 md:text-sm max-w-sm">
              {dashboardConfig.buildBoxDesc}
            </p>

            {/* Highlights Box */}
            <div className="mt-3.5 rounded-[5px] border-[2px] border-brick-black/15 bg-brick-black/[0.025] p-3 text-xs">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-brick-black shrink-0"
                    style={{ background: "#FFD700", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" }}
                  />
                  <span className="font-medium text-brick-black/85">
                    <strong>7 High-Octane Challenges</strong> across Tech & Non-Tech
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-brick-black shrink-0"
                    style={{ background: "#0055BF", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" }}
                  />
                  <span className="font-medium text-brick-black/85">
                    <strong>Squad & Solo builds</strong> with ₹50K+ bounty
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-brick-black shrink-0"
                    style={{ background: "#C91A09", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" }}
                  />
                  <span className="font-medium text-brick-black/85">
                    <strong>Instant Digital Pass</strong> for SCET delegates
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Track Switcher */}
            <div className="mt-3.5">
              <div className="flex items-center justify-between">
                <span className="font-display text-[10px] font-bold uppercase tracking-[0.16em] text-brick-black/55">
                  Track Preview
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTrack("TECH")}
                    className={`rounded-[4px] border-[1.5px] border-brick-black px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.08em] transition-all cursor-pointer ${
                      activeTrack === "TECH"
                        ? "bg-brick-yellow text-brick-black shadow-[1.5px_1.5px_0_#0D0D0D]"
                        : "bg-brick-black/5 text-brick-black/60 hover:bg-brick-black/10"
                    }`}
                  >
                    Tech Track ({allEvents.filter(e => (e.track || '').toUpperCase() === "TECH" || (e.track || '').toUpperCase() === "IT").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTrack("NON-TECH")}
                    className={`rounded-[4px] border-[1.5px] border-brick-black px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.08em] transition-all cursor-pointer ${
                      activeTrack === "NON-TECH"
                        ? "bg-brick-blue text-brick-white shadow-[1.5px_1.5px_0_#0D0D0D]"
                        : "bg-brick-black/5 text-brick-black/60 hover:bg-brick-black/10"
                    }`}
                  >
                    Non-Tech Track ({allEvents.filter(e => {
                      const tr = (e.track || '').replace(/ TRACK$/i, '').trim().toUpperCase();
                      return tr === "NON-TECH" || tr === "NON TECH" || tr === "NONTECH" || tr.includes("NON") || tr === "AIDS";
                    }).length})
                  </button>
                </div>
              </div>

              {/* Event mini chips for active track */}
              <div className="mt-2.5 flex flex-col gap-1.5">
                {trackEvents.slice(0, 2).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between rounded-[5px] border-[1.5px] border-brick-black/15 bg-brick-black/[0.03] px-2.5 py-1.5 text-xs transition-colors hover:bg-brick-black/[0.06]"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full border border-brick-black"
                        style={{
                          background:
                            activeTrack === "TECH" ? "var(--brick-yellow)" : "var(--brick-blue)",
                        }}
                      />
                      <span className="font-display font-bold uppercase text-brick-black">
                        {ev.title}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-brick-black/55">{ev.prize}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="mt-4 flex items-center justify-between border-t border-brick-black/10 pt-3 text-[11px] text-brick-black/60">
              <span className="flex items-center gap-1 font-display font-semibold uppercase tracking-[0.1em]">
                <Flame className="h-3.5 w-3.5 text-brick-red" /> Registrations Live
              </span>
              <div className="flex items-center gap-2.5">
                <a
                  href="#roadmap-section"
                  className="font-display font-bold uppercase tracking-[0.08em] text-brick-black/80 hover:text-brick-blue transition-colors"
                >
                  Roadmap ↓
                </a>
                <span className="text-brick-black/30">·</span>
                <Link
                  to="/events"
                  className="font-display font-bold uppercase tracking-[0.1em] text-brick-blue hover:underline"
                >
                  Snap In All 7 →
                </Link>
              </div>
            </div>
          </BrickCard>
        </div>
      </section>

      {/* ============================================================ */}
      {/* WHAT'S ON YOUR BUILD PLAN? (Explore the Fest 4 Pillars)      */}
      {/* ============================================================ */}
      {dashboardConfig.exploreEnabled !== false && (
        <>
          <BaseplateDivider color="#0055BF" />

          <section>
            <SectionLabel>Explore the Fest</SectionLabel>
            <h2 className="mt-1 text-xl uppercase md:text-2xl">{dashboardConfig.exploreTitle}</h2>

            <motion.div
              className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
              variants={gridStaggerVariant}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
            >
              {dashboardConfig.explorePillars.map((item, idx) => {
                const icons = [Crosshair, Sparkles, Users, Award];
                const Icon = icons[idx % icons.length] as React.ElementType;
                return (
                  <motion.div key={item.title} variants={cardRevealVariant}>
                    <InfoCard
                      accent={item.brickColor}
                      className="flex h-full flex-col px-5 pb-5 pt-6"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="grid h-11 w-11 place-items-center rounded-[6px] border-[2px] border-brick-black/10"
                          style={{ background: `color-mix(in srgb, ${item.accent} 12%, transparent)` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: item.accent }} />
                        </span>
                        <span className="flex gap-1.5">
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-brick-black/20"
                            style={{
                              background: item.brickColor,
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
                            }}
                          />
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-brick-black/20"
                            style={{
                              background: item.brickColor,
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
                            }}
                          />
                        </span>
                      </div>
                      <h3 className="mt-4 font-display text-base font-bold uppercase">{item.title}</h3>
                      <p className="mt-1.5 flex-1 font-body text-xs leading-relaxed text-brick-black/55">
                        {item.desc}
                      </p>
                      <hr className="my-4 border-brick-black/8" />
                      <Link
                        to="/events"
                        className="inline-flex items-center gap-1 font-display text-[11px] font-bold uppercase tracking-[0.12em] text-brick-black/70 transition-colors hover:text-brick-black"
                      >
                        Discover more <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </InfoCard>
                  </motion.div>
                );
              })}
            </motion.div>
          </section>
        </>
      )}

      {/* ============================================================ */}
      {/* FESTIVAL SCHEDULE & VENUE ROADMAP                            */}
      {/* ============================================================ */}
      <BaseplateDivider color="#FFD700" />

      <EventRoadmapSection variant="dashboard" id="roadmap-section" />

      {/* ============================================================ */}
      {/* SNAP INTO THESE CHALLENGES (Upcoming Builds 3 Real Events)   */}
      {/* ============================================================ */}
      <BaseplateDivider color="#C91A09" />

      <section className="pb-10">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <SectionLabel>Upcoming Builds</SectionLabel>
            <h2 className="mt-1 text-xl uppercase md:text-2xl">Snap Into These Challenges</h2>
          </div>
          <Link
            to="/events"
            className="inline-flex items-center gap-1 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-brick-blue transition-colors hover:underline"
          >
            Browse All {totalCount} Events <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* 3 Real Events Grid — Scroll-Reveal Staggered + Click navigates to /events */}
        <motion.div
          className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          variants={gridStaggerVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {previewEvents.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              registered={isRegistered(ev.id)}
              mode="dashboard"
              onClick={() => navigate({ to: "/events/$eventId", params: { eventId: getEventSlug(ev) } })}
            />
          ))}
        </motion.div>

        {/* Explore All Events Centered Button */}
        <div className="mt-8 flex justify-center">
          <Link to="/events">
            <BrickButton variant="yellow" size="lg">
              <Sparkles className="mr-1 inline h-4 w-4" /> Explore All {totalCount} Events <ArrowRight className="ml-1 inline h-4 w-4" />
            </BrickButton>
          </Link>
        </div>
      </section>
    </AppShell>
  );
}


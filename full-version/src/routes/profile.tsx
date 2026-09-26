import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageTransitionLoader } from "@/components/brick/PageTransitionLoader";
import { useState, useEffect, useMemo } from "react";
import { AppShell } from "@/components/brick/BaseplateNav";
import { BrickCard } from "@/components/brick/BrickCard";
import { BrickButton } from "@/components/brick/BrickButton";
import { BrickInput } from "@/components/brick/BrickInput";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { StudBadge } from "@/components/brick/Studs";
import { EventCard } from "@/components/brick/EventCard";
import { useFestState, FEST_EVENTS, type FestEvent } from "@/lib/fest-state";
import { useAuth, signOut } from "@/lib/firebase-auth";
import { useFirestoreEvents } from "@/lib/firebase-events";
import { useMyRegistrations, getTeamRoster, isUserRegisteredForEvent, doesRegistrationMatchEvent } from "@/lib/firebase-registrations";
import { toEventSlug, getEventSlug } from "@/lib/event-slugs";
import { useSiteConfig, DEFAULT_SITE_CONFIG } from "@/lib/firebase-site-config";
import { openGoogleCalendar } from "@/lib/calendar-reminders";
import { cn } from "@/lib/utils";
import {
  Calendar,
  User,
  Phone,
  Mail,
  ShieldCheck,
  ArrowRight,
  QrCode,
  Clock,
  MapPin,
  X,
  GraduationCap,
  Crown,
  Users,
  Sparkles,
  CheckCircle2,
  CalendarPlus,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — CONVERSE 2K26 | Builder ID" },
      {
        name: "description",
        content:
          "Your Builder ID and registered fest events for CONVERSE 2K26.",
      },
      { property: "og:title", content: "Builder ID — CONVERSE 2K26" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Profile,
});

/** LEGO minifig head shape */
function MinifigAvatar({ initial, dept }: { initial: string; dept: string }) {
  const bgColor = dept === "IT" ? "#FFD700" : "#0055BF";
  return (
    <div className="relative">
      <div
        className="grid h-16 w-14 place-items-center rounded-[6px] rounded-t-[16px] border-[3px] border-brick-black font-display text-2xl font-bold"
        style={{
          background: `linear-gradient(145deg, ${bgColor}CC, ${bgColor})`,
          boxShadow:
            "inset 0 3px 0 rgba(255,255,255,0.3), inset 0 -3px 0 rgba(0,0,0,0.2), 4px 4px 0 rgba(13,13,13,0.7)",
          color: dept === "IT" ? "#0D0D0D" : "#FFFFFF",
        }}
      >
        {initial}
      </div>
      <span
        className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border-[2px] border-brick-black"
        style={{
          background: bgColor,
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.2)",
        }}
      />
    </div>
  );
}

/** Baseplate divider */
function BaseplateDivider({ color = "#0055BF" }: { color?: string }) {
  return (
    <div className="my-10 flex items-center gap-3">
      <span
        className="h-[4px] flex-1 rounded-full"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${color}22 20%, ${color}22 80%, transparent 100%)`,
        }}
      />
      {[0, 1].map((i) => (
        <span
          key={i}
          className="h-3 w-3 rounded-full border-[2px] border-brick-black/20"
          style={{
            background: color,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.15)",
          }}
        />
      ))}
      <span
        className="h-[4px] flex-1 rounded-full"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${color}22 20%, ${color}22 80%, transparent 100%)`,
        }}
      />
    </div>
  );
}

/**
 * Phase 4: Empty State Gamification
 * Minimalist SVG blueprint representing an unbuilt LEGO instruction booklet
 * with the unplaced brick's connection dots correctly on the connecting side
 * fitting into the baseplate block below.
 */
function EmptyManifestGraphic() {
  return (
    <div className="relative mx-auto my-3 flex items-center justify-center">
      <svg
        width="210"
        height="135"
        viewBox="0 0 210 135"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
        aria-hidden
      >
        {/* ─── Instruction Booklet Blueprint Background Page ─── */}
        <polygon
          points="24,14 186,14 196,122 34,122"
          fill="#F8FAFC"
          stroke="#0D0D0D"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Blueprint Grid Dots on Paper Background */}
        <g opacity="0.18">
          {[45, 75, 105, 135, 165].map((gx) =>
            [32, 52, 72, 92, 112].map((gy) => (
              <circle key={`${gx}-${gy}`} cx={gx} cy={gy} r="1" fill="#0D0D0D" />
            ))
          )}
        </g>

        {/* Booklet Fold Line Spine (subtle dashed) */}
        <line
          x1="110"
          y1="14"
          x2="115"
          y2="122"
          stroke="#0D0D0D"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          opacity="0.3"
        />

        {/* Step 01 Badge on Top-Left of Booklet (Cleanly positioned, no overlap) */}
        <g transform="translate(32, 22)">
          <rect
            x="0"
            y="0"
            width="52"
            height="18"
            rx="3"
            fill="#FFD700"
            stroke="#0D0D0D"
            strokeWidth="2"
          />
          <text
            x="26"
            y="12.5"
            fill="#0D0D0D"
            fontSize="9"
            fontFamily="Chakra Petch"
            fontWeight="700"
            textAnchor="middle"
            letterSpacing="0.06em"
          >
            STEP 01
          </text>
        </g>

        {/* ─── Gray Baseplate Foundation Block at Bottom ─── */}
        <g id="baseplate-block">
          {/* Baseplate Front Edge (3D depth) */}
          <polygon
            points="36,112 174,112 174,119 36,119"
            fill="#9CA3AF"
            stroke="#0D0D0D"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Baseplate Right Edge (3D depth) */}
          <polygon
            points="174,112 186,95 186,102 174,119"
            fill="#6B7280"
            stroke="#0D0D0D"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Baseplate Top Face (Angled isometric plate) */}
          <polygon
            points="48,95 186,95 174,112 36,112"
            fill="#E5E7EB"
            stroke="#0D0D0D"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Sockets on the Baseplate */}
          {/* Left inactive socket */}
          <ellipse cx="64" cy="103.5" rx="7" ry="3.2" fill="#D1D5DB" stroke="#0D0D0D" strokeWidth="1.5" />
          {/* Right inactive socket */}
          <ellipse cx="146" cy="103.5" rx="7" ry="3.2" fill="#D1D5DB" stroke="#0D0D0D" strokeWidth="1.5" />

          {/* TARGET SOCKETS where the Brick fits into the Block (directly under the brick!) */}
          <ellipse
            cx="91"
            cy="103.5"
            rx="7"
            ry="3.2"
            fill="#FEF08A"
            stroke="#0D0D0D"
            strokeWidth="2"
            strokeDasharray="2.5 2"
          />
          <circle cx="91" cy="103.5" r="1.5" fill="#0D0D0D" />

          <ellipse
            cx="119"
            cy="103.5"
            rx="7"
            ry="3.2"
            fill="#FEF08A"
            stroke="#0D0D0D"
            strokeWidth="2"
            strokeDasharray="2.5 2"
          />
          <circle cx="119" cy="103.5" r="1.5" fill="#0D0D0D" />
        </g>

        {/* ─── Hovering Yellow 2-Stud LEGO Brick ─── */}
        <g className="animate-bounce" style={{ animationDuration: "2.4s" }}>
          {/* Dashed Snap Guide Lines directly from Brick into matching Block Sockets below */}
          <line
            x1="91"
            y1="64"
            x2="91"
            y2="100"
            stroke="#0D0D0D"
            strokeWidth="1.8"
            strokeDasharray="3 3"
          />
          <line
            x1="119"
            y1="64"
            x2="119"
            y2="100"
            stroke="#0D0D0D"
            strokeWidth="1.8"
            strokeDasharray="3 3"
          />

          {/* Downward Snap Action Arrow Indicator */}
          <g transform="translate(105, 68)">
            <line x1="0" y1="0" x2="0" y2="18" stroke="#0D0D0D" strokeWidth="2" strokeDasharray="3 2" />
            <polygon points="-4,15 4,15 0,21" fill="#0D0D0D" />
          </g>

          {/* ── Brick Pegs on BOTTOM of the Brick ── */}
          {/* Left Peg on Bottom (centered at x=91) */}
          <g id="bottom-peg-left">
            <ellipse cx="91" cy="67" rx="5.5" ry="2.4" fill="#FFE55C" stroke="#0D0D0D" strokeWidth="1.8" />
            <circle cx="91" cy="67" r="1.5" fill="#0D0D0D" />
            <rect x="85.5" y="58" width="11" height="9" fill="#D4AF37" />
            <line x1="85.5" y1="58" x2="85.5" y2="67" stroke="#0D0D0D" strokeWidth="1.8" />
            <line x1="96.5" y1="58" x2="96.5" y2="67" stroke="#0D0D0D" strokeWidth="1.8" />
          </g>

          {/* Right Peg on Bottom (centered at x=119) */}
          <g id="bottom-peg-right">
            <ellipse cx="119" cy="67" rx="5.5" ry="2.4" fill="#FFE55C" stroke="#0D0D0D" strokeWidth="1.8" />
            <circle cx="119" cy="67" r="1.5" fill="#0D0D0D" />
            <rect x="113.5" y="58" width="11" height="9" fill="#D4AF37" />
            <line x1="113.5" y1="58" x2="113.5" y2="67" stroke="#0D0D0D" strokeWidth="1.8" />
            <line x1="124.5" y1="58" x2="124.5" y2="67" stroke="#0D0D0D" strokeWidth="1.8" />
          </g>

          {/* ── Yellow Brick Body (Isometric 3D) ── */}
          {/* Brick Top Face */}
          <polygon
            points="88,41 138,41 126,52 76,52"
            fill="#FFD700"
            stroke="#0D0D0D"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Brick Front Face */}
          <polygon
            points="76,52 126,52 126,64 76,64"
            fill="#FFE55C"
            stroke="#0D0D0D"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Brick Right Face (3D depth shading) */}
          <polygon
            points="126,52 138,41 138,53 126,64"
            fill="#D4AF37"
            stroke="#0D0D0D"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}

function Profile() {
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const profileConfig = config?.profile || DEFAULT_SITE_CONFIG.profile;
  const { user, loading: authLoading } = useAuth();
  const { registrations, loading: regLoading } = useMyRegistrations(user?.uid, user?.email);
  const [selectedPassEvent, setSelectedPassEvent] = useState<FestEvent | null>(null);

  const selectedPassReg = useMemo(() => {
    if (!selectedPassEvent) return null;
    return registrations.find((r) => doesRegistrationMatchEvent(r, selectedPassEvent));
  }, [registrations, selectedPassEvent]);

  const teamRoster = useMemo(() => {
    return getTeamRoster(selectedPassReg, user);
  }, [selectedPassReg, user]);

  const {
    totalCount,
  } = useFestState(user?.uid, user?.email);

  const { events: fsEvents } = useFirestoreEvents();

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

  // Filter out non-tech external events (they do not have passes or QR codes)
  const isEventNonTech = (ev: FestEvent) => {
    const cleanTrack = (ev.track || "").replace(/ TRACK$/i, "").trim().toUpperCase();
    return cleanTrack === "NON-TECH" || cleanTrack === "NON TECH" || cleanTrack === "NONTECH" || cleanTrack.includes("NON");
  };

  // Official track events (Tech & Robotics) that have gate passes
  const officialEvents = useMemo(() => {
    return allEvents.filter((e) => !isEventNonTech(e));
  }, [allEvents]);

  // Sync official registrations from Firestore directly (no non-tech events in profile)
  const effectiveRegisteredEvents = useMemo(() => {
    return officialEvents.filter((e) => isUserRegisteredForEvent(e, registrations));
  }, [officialEvents, registrations]);

  const effectiveRegisteredCount = effectiveRegisteredEvents.length;
  const totalEventsCount = officialEvents.length || 1;
  const effectiveProgressPercent = Math.round((effectiveRegisteredCount / totalEventsCount) * 100);

  // Keep browser cache synchronized with active official passes or clean it up if empty
  useEffect(() => {
    if (!user?.uid || regLoading) return;
    const storageKey = `converse_2026_registered_events_${user.uid}`;
    try {
      if (effectiveRegisteredEvents.length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        const activeSlugs = effectiveRegisteredEvents.map((ev) => toEventSlug(ev.id));
        localStorage.setItem(storageKey, JSON.stringify(activeSlugs));
      }
    } catch {}
  }, [user?.uid, effectiveRegisteredEvents, regLoading]);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saved, setSaved] = useState(false);

  // Sync auth user to edit state
  useEffect(() => {
    if (user) {
      setEditName(user.name || "");
      setEditPhone(user.phone || "");
      setEditEmail(user.email || "");
    }
  }, [user]);

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

  if (authLoading || !user || (user.role !== 'admin' && user.role !== 'sub-admin' && user.role !== 'master' && !user.onboarded)) return <PageTransitionLoader />;

  const handleSave = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: editName,
        phone: editPhone,
        email: editEmail,
      });
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      console.error("Failed to update profile", err);
    }
  };

  return (
    <AppShell>
      {/* ─── Header ─── */}
      <section className="snap-in flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-[4px] border-[3px] border-brick-black bg-brick-blue-deep px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-[0.22em] text-brick-white brick-bevel-sm">
            <span className="inline-block h-2 w-2 rounded-full border-[2px] border-brick-white/40 bg-brick-yellow" />
            Builder ID
          </span>
          <h1 className="mt-3 text-2xl uppercase md:text-3xl">{profileConfig.pageTitle}</h1>
          <p className="mt-1 font-body text-sm text-brick-black/65 max-w-sm">
            {profileConfig.pageDesc}
          </p>
        </div>

        {/* Build progress — stud-based */}
        <BrickCard
          surface="white"
          studs={4}
          className="w-full shrink-0 px-5 py-4 md:w-auto md:min-w-[260px]"
        >
          <span className="font-display text-[10px] font-bold uppercase tracking-[0.16em] text-brick-black/50">
            Build Progress
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-display text-3xl font-bold">{effectiveRegisteredCount}</span>
            <span className="font-display text-xl font-bold text-brick-black/35">/ {totalEventsCount}</span>
          </div>
          <div className="mt-3 flex gap-1.5">
            {Array.from({ length: totalEventsCount }).map((_, i) => (
              <span
                key={i}
                className="h-3 w-3 rounded-full border-[2px] border-brick-black/20 transition-all duration-500"
                style={{
                  background: i < effectiveRegisteredCount ? "#FFD700" : "rgba(0,0,0,0.06)",
                  boxShadow:
                    i < effectiveRegisteredCount
                      ? "inset 0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.15)"
                      : "inset 0 1px 2px rgba(0,0,0,0.06)",
                  transform: i < effectiveRegisteredCount ? "scale(1)" : "scale(0.85)",
                }}
              />
            ))}
          </div>
          <p className="mt-2 font-body text-[10px] text-brick-black/45">
            {effectiveProgressPercent}% assembled
          </p>
        </BrickCard>
      </section>

      <BaseplateDivider color="#003399" />

      {/* ─── Two-Column Layout ─── */}
      <div className="grid gap-8 md:grid-cols-12">
        {/* LEFT — Builder Identity Card */}
        <div className="md:col-span-5">
          <BrickCard
            surface="white"
            studs={4}
            className="snap-in px-6 pb-6 pt-8"
          >
            <div className="flex items-start gap-4">
              <MinifigAvatar initial={user.name?.charAt(0) || "U"} dept={user.branch || "IT"} />
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="font-display text-lg font-bold uppercase">{user.name || "Participant"}</h2>
                  <ShieldCheck className="h-4 w-4 text-brick-blue" />
                </div>
                <p className="font-body text-xs text-brick-black/55">
                  Enrollment: {user.enrollmentNumber || "—"}
                </p>
                <span
                  className="mt-1.5 inline-flex items-center gap-1 rounded-[4px] border-[3px] border-brick-black px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.12em] brick-bevel-sm"
                  style={{
                    backgroundColor:
                      user.branch === "IT" ? "var(--brick-yellow)" : "var(--brick-blue)",
                    color:
                      user.branch === "IT" ? "var(--brick-black)" : "var(--brick-white)",
                  }}
                >
                  {user.branch || "Participant"}
                </span>
              </div>
            </div>

            <hr className="my-5 border-brick-black/10" />

            <div className="flex flex-col gap-3">
              {[
                { icon: User, label: "Builder Name", value: user.name },
                { icon: Phone, label: "Phone Number", value: user.phone || "—" },
                { icon: GraduationCap, label: "College", value: user.collegeName || "—" },
                { icon: ShieldCheck, label: "Enrollment", value: user.enrollmentNumber || "—" },
                { icon: MapPin, label: "Branch", value: user.branch || "—" },
                { icon: Calendar, label: "Year", value: user.year ? `${user.year}yr` : "—" },
                { icon: Clock, label: "Semester", value: user.semester ? `Sem ${user.semester}` : "—" },
                { icon: Mail, label: "Google Email", value: user.email || "—" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3 rounded-[6px] border-[2px] border-brick-black/8 bg-brick-black/[0.03] p-3">
                  <span className="grid h-9 w-9 place-items-center rounded-[4px] border-[2px] border-brick-black/12 bg-brick-white shrink-0">
                    <row.icon className="h-4 w-4 text-brick-black/50" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-brick-black/45">
                      {row.label}
                    </p>
                    <p className="truncate font-body text-sm font-medium">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Sign Out Button */}
            <div className="mt-6 border-t border-brick-black/10 pt-4">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await signOut();
                    window.location.href = "/";
                  } catch (err) {
                    console.error("Logout error:", err);
                    window.location.href = "/";
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-[5px] border-[2.5px] border-brick-red bg-brick-red/10 px-4 py-2.5 font-display text-xs font-bold uppercase tracking-[0.14em] text-brick-red transition-all hover:bg-brick-red hover:text-white active:translate-y-0.5 cursor-pointer"
              >
                Log Out of Converse
              </button>
            </div>
          </BrickCard>
        </div>

        {/* RIGHT — Assembly Manifest (Standardized Cards & Gamified Empty State) */}
        <div className="md:col-span-7">
          <div className="flex items-center gap-2">
            <StudBadge color="var(--brick-red)" className="px-1">
              <Calendar className="h-3.5 w-3.5 text-brick-white" />
            </StudBadge>
            <h2 className="font-display text-lg font-bold uppercase tracking-[0.04em]">
              Assembly Manifest
            </h2>
          </div>
          <p className="mt-0.5 font-body text-xs text-brick-black/50">
            Your registered builds for Converse 2k26.
          </p>

          {effectiveRegisteredEvents.length === 0 ? (
            /* Thematic Upgrade: 3D Embossed Studs [•] [•] [•] [•] on Blueprint Card */
            <BrickCard
              surface="white"
              studs={4}
              className="mt-5 flex flex-col items-center px-6 py-8 text-center"
            >
              <EmptyManifestGraphic />
              <p className="mt-4 font-display text-base font-bold uppercase tracking-[0.06em] text-brick-black">
                MANIFEST EMPTY // 0 BRICKS ASSEMBLED
              </p>
              <p className="mt-1.5 max-w-sm font-body text-xs leading-relaxed text-brick-black/60">
                Your assembly blueprint is blank. Select from {totalCount} cutting-edge events on the Build Site to claim your spot on the baseplate.
              </p>
              <Link to="/events" className="mt-5">
                <BrickButton variant="yellow" size="lg">
                  SNAP IN <ArrowRight className="ml-1 inline h-4 w-4" />
                </BrickButton>
              </Link>
            </BrickCard>
          ) : (
            /* Standardized EventCard instances in Profile */
            <div className="mt-5 flex flex-col gap-6">
              {effectiveRegisteredEvents.map((ev, index) => {
                return (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    registered
                    mode="profile"
                    onClick={() => setSelectedPassEvent(ev)}
                    style={{ animationDelay: `${index * 60}ms` }}
                  />
                );
              })}

              <Link
                to="/events"
                className="mt-2 inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-[0.12em] text-brick-blue hover:underline"
              >
                + Assemble More Bricks to Your Manifest <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ─── OFFICIAL QR CODE ENTRY PASS OR FUN EVENT INFO MODAL ─── */}
      {selectedPassEvent && (() => {
        const cleanTrack = (selectedPassEvent.track || "").replace(/ TRACK$/i, "").trim().toUpperCase();
        const isSelectedPassNonTech = cleanTrack === "NON-TECH" || cleanTrack === "NON TECH" || cleanTrack === "NONTECH" || cleanTrack.includes("NON") || Boolean(selectedPassReg?.isNonTech);

        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedPassEvent(null)}
          >
            <div 
              className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[8px] border-[4px] border-black bg-white p-6 shadow-[8px_8px_0_#0D0D0D] text-black"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Stud header decoration */}
              <div className="absolute top-0 left-0 right-0 h-3 bg-brick-yellow flex items-center justify-center gap-3 border-b-[2px] border-black">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className="h-2 w-2 rounded-full border border-black bg-brick-yellow shadow-inner" />
                ))}
              </div>

              {/* Close button */}
              <button
                type="button"
                onClick={() => setSelectedPassEvent(null)}
                className="absolute top-5 right-5 h-8 w-8 rounded-[4px] border-[2px] border-black bg-neutral-100 hover:bg-neutral-200 grid place-items-center transition-colors cursor-pointer"
                title="Close"
              >
                <X className="h-4 w-4 text-black" />
              </button>

              {/* Header / Event Title */}
              <div className="mt-2 text-center">
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-[3px] border-[1.5px] border-black px-2.5 py-0.5 font-display text-[10px] font-black uppercase tracking-[0.14em]",
                  isSelectedPassNonTech ? "bg-purple-100 text-purple-900 border-purple-400" : "bg-brick-blue/10 text-brick-blue"
                )}>
                  {isSelectedPassNonTech ? (
                    <>
                      <Sparkles className="h-3 w-3 text-purple-600" />
                      CONVERSE 2K26 · FUN EVENT CONFIRMED
                    </>
                  ) : (
                    "CONVERSE 2K26 · OFFICIAL GATE PASS"
                  )}
                </span>
                <h3 className="mt-2 font-display text-2xl font-black uppercase tracking-tight text-black">
                  {selectedPassEvent.title}
                </h3>
                <p className={cn(
                  "font-display text-[11px] font-bold uppercase tracking-wider",
                  isSelectedPassNonTech ? "text-purple-700 font-extrabold" : "text-black/60"
                )}>
                  {isSelectedPassNonTech ? "NON-TECH FUN EVENT · NO PASS REQUIRED" : `${selectedPassEvent.track} Track · ${selectedPassEvent.format}`}
                </p>
              </div>

              {isSelectedPassNonTech ? (
                /* ─── NON-TECH: Joyful confirmation & Event Info (NO QR CODE) ─── */
                <div className="my-4 flex flex-col items-center text-center rounded-[8px] border-[3px] border-black bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-5 shadow-[4px_4px_0_#0D0D0D]">
                  <div className="h-13 w-13 rounded-2xl bg-[#FFE817] border-[2.5px] border-black flex items-center justify-center shadow-[3px_3px_0_#000] mb-3 text-2xl">
                    🎈
                  </div>
                  <h4 className="font-display text-base font-black uppercase tracking-wide text-black">
                    You're Officially Registered!
                  </h4>
                  <p className="mt-2 text-xs text-black/80 leading-relaxed max-w-sm">
                    This is a fun event, so <strong>no gate pass or QR code is needed</strong>. Your spot is secured on the participant roster. Just head over to the venue and have an awesome time!
                  </p>
                  <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-600/40 bg-emerald-100 px-3 py-1 text-[11px] font-extrabold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Spot Secured on Roster ✓
                  </div>
                </div>
              ) : (
                /* ─── TECH: Official QR Code & Entry Token ─── */
                <div className="my-4 flex flex-col items-center justify-center rounded-[6px] border-[3px] border-black bg-[#FAF9F6] p-5 shadow-[4px_4px_0_#0D0D0D]">
                  {selectedPassReg ? (
                    <>
                      <div className="rounded-[4px] border-[2px] border-black/20 bg-white p-2 shadow-sm">
                        <QRCodeSVG
                          value={selectedPassReg.qrToken || selectedPassReg.entryCode || selectedPassReg.id || "CONVERSE-PASS"}
                          size={190}
                          level="H"
                          includeMargin={true}
                        />
                      </div>

                      {/* Monospace Entry Code */}
                      <div className="mt-3 text-center">
                        <p className="font-display text-[10px] font-black uppercase tracking-[0.16em] text-black/50">
                          Verification Code
                        </p>
                        <p className="font-mono text-2xl font-black tracking-[0.25em] text-brick-blue">
                          {selectedPassReg.entryCode}
                        </p>
                      </div>

                      {/* Status Badge */}
                      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        {selectedPassReg.checkedIn ? "Checked In ✓" : "Active Gate Token — Ready for Scanning"}
                      </span>
                    </>
                  ) : regLoading ? (
                    /* Loading skeleton while Firestore registration syncs */
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="h-[190px] w-[190px] rounded-[4px] border-[2px] border-black/10 bg-neutral-100 animate-pulse flex items-center justify-center">
                        <QrCode className="h-12 w-12 text-black/15" />
                      </div>
                      <p className="font-display text-xs font-bold uppercase tracking-wider text-black/40 animate-pulse">
                        Loading your gate pass…
                      </p>
                    </div>
                  ) : (
                    /* Registration not found in Firestore — should not happen for visible events */
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="h-[190px] w-[190px] rounded-[4px] border-[2px] border-dashed border-black/20 bg-neutral-50 flex items-center justify-center">
                        <QrCode className="h-12 w-12 text-black/20" />
                      </div>
                      <p className="font-display text-xs font-bold uppercase tracking-wider text-black/40">
                        Pass syncing — please reopen in a moment
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Event & Pass Metadata */}
              <div className="space-y-2 rounded-[6px] border-[2px] border-black/10 bg-neutral-50 p-3 text-xs">
                <div className="flex justify-between border-b border-black/5 pb-1.5">
                  <span className="font-display font-semibold text-black/50 uppercase text-[10px]">Pass Holder</span>
                  <span className="font-bold text-black">
                    {user?.name || "Participant"} {user?.enrollmentNumber ? `(${user.enrollmentNumber})` : ""}
                  </span>
                </div>
                <div className="flex justify-between border-b border-black/5 pb-1.5">
                  <span className="font-display font-semibold text-black/50 uppercase text-[10px]">Venue & Time</span>
                  <span className="font-medium text-black">{selectedPassEvent.venue || "SCET"} · {selectedPassEvent.time || "10:00 AM"}</span>
                </div>
                {teamRoster?.isTeam && teamRoster.teamName && (
                  <div className="flex justify-between border-b border-black/5 pb-1.5">
                    <span className="font-display font-semibold text-black/50 uppercase text-[10px]">Team Name</span>
                    <span className="font-bold text-brick-blue">{teamRoster.teamName}</span>
                  </div>
                )}

                {/* Team Members Roster: Clear Leader & All Members */}
                {teamRoster?.isTeam && (
                  <div className="pt-1 border-t border-black/5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-display font-bold text-black/60 uppercase text-[10px] tracking-wider flex items-center gap-1">
                        <Users className="h-3 w-3 text-black/50" /> Team Members ({teamRoster.totalMembers})
                      </span>
                      <span className="text-[10px] font-bold text-brick-blue">
                        {teamRoster.isCurrentUserLeader ? "★ You are Leader" : "Team Entry"}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {/* Team Leader */}
                      {teamRoster.leader && (
                        <div className="flex items-center justify-between rounded-[4px] bg-amber-50 border border-amber-300 px-2.5 py-1.5 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Crown className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            <span className="font-bold text-black truncate">
                              {teamRoster.leader.name} {teamRoster.leader.isCurrentUser && <span className="text-amber-800 font-bold text-[11px]">(You)</span>}
                            </span>
                          </div>
                          <span className="shrink-0 text-[9px] font-display font-black uppercase tracking-wider bg-amber-200 text-amber-900 border border-amber-400 rounded px-1.5 py-0.5">
                            Leader
                          </span>
                        </div>
                      )}

                      {/* Teammates */}
                      {(teamRoster.members || []).map((tm, i) => (
                        <div key={i} className="flex items-center justify-between rounded-[4px] bg-white border border-black/10 px-2.5 py-1.5 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <User className="h-3.5 w-3.5 text-black/40 shrink-0" />
                            <span className="font-medium text-black truncate">
                              {tm.name} {tm.isCurrentUser && <span className="text-brick-blue font-bold text-[11px]">(You)</span>}
                            </span>
                          </div>
                          <span className="shrink-0 text-[9px] font-display font-semibold uppercase tracking-wider bg-black/5 text-black/60 rounded px-1.5 py-0.5">
                            Member
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPassEvent(null)}
                  className="flex-1 rounded-[5px] border-[2.5px] border-black bg-neutral-100 hover:bg-neutral-200 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-black transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const evSlug = getEventSlug(selectedPassEvent);
                    setSelectedPassEvent(null);
                    navigate({ to: "/events/$eventId", params: { eventId: evSlug } });
                  }}
                  className="flex-1 rounded-[5px] border-[2.5px] border-black bg-brick-yellow hover:bg-[#FFE033] py-2.5 font-display text-xs font-black uppercase tracking-wider text-black transition-all shadow-[2px_2px_0_#0D0D0D] cursor-pointer"
                >
                  Event Details →
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </AppShell>
  );
}


import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BrickCard } from "@/components/brick/BrickCard";
import { BrickSnapLoader } from "@/components/brick/Studs";
import { useAuth, signInWithGoogle } from "@/lib/firebase-auth";
import { ArrowRight, ArrowLeft, Info, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteConfig, DEFAULT_SITE_CONFIG } from "@/lib/firebase-site-config";
import { BrickField } from "@/components/brick/BrickField";
import { LegoIntroAnimation } from "@/components/brick/LegoIntroAnimation";
import { SiteFooter } from "@/components/brick/SiteFooter";
import { EventMarquee } from "@/components/brick/EventMarquee";
import { EventRoadmapSection } from "@/components/brick/EventRoadmapSection";
import { PageTransitionLoader } from "@/components/brick/PageTransitionLoader";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { login?: boolean | undefined } => ({
    login: search.login === true || search.login === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "CONVERSE 2K26 | The Build Site" },
      {
        name: "description",
        content:
          "Welcome to CONVERSE 2K26. Beyond Intelligence / Responsible Use of AI. Join 500+ master builders for 02 days of action.",
      },
    ],
  }),
  component: LandingContainer,
});

function LandingContainer() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, loading: authLoading } = useAuth();

  const isLoginRequested = Boolean(
    search.login ||
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("login") === "true")
  );

  const [viewState, setViewState] = useState<"intro" | "home" | "login">(() => {
    if (isLoginRequested) return "login";
    if (typeof window !== "undefined" && sessionStorage.getItem("introPlayed")) return "home";
    return "intro";
  });

  // Authentication persistence guard:
  // If user is already authenticated (even after closing the tab), immediately redirect to their dashboard!
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === "master") {
        navigate({ to: "/admin/master", replace: true });
      } else if (user.role === "sub-admin") {
        navigate({ to: "/admin/subadmin", replace: true });
      } else if (user.role === "admin") {
        navigate({ to: "/admin/scanner", replace: true });
      } else if (!user.onboarded) {
        navigate({ to: "/onboarding", replace: true });
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (isLoginRequested) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("introPlayed", "true");
      }
      setViewState("login");
      return;
    }
    if (typeof window !== "undefined" && sessionStorage.getItem("introPlayed")) {
      setViewState("home");
    }
  }, [isLoginRequested]);

  const handleIntroComplete = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("introPlayed", "true");
    }
    setViewState("home");
  };

  // While checking authentication state, render loader to prevent flash of intro or landing page
  if (authLoading || user) {
    return <PageTransitionLoader />;
  }

  return (
    <>
      {viewState === "intro" && <VideoIntro onComplete={handleIntroComplete} />}
      {viewState === "home" && <HomePage onLoginClick={() => setViewState("login")} />}
      {viewState === "login" && <LoginView onBack={() => setViewState("home")} />}
    </>
  );
}

/** Fullscreen auto-play video intro — fades out when video ends */
function VideoIntro({ onComplete }: { onComplete: () => void }) {
  const desktopVideoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const [fading, setFading] = useState(false);
  const [showTapHint, setShowTapHint] = useState(false);
  const completedRef = useRef(false);

  const endIntro = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setFading(true);
    setTimeout(onComplete, 800);
  };

  useEffect(() => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const activeVideo = isMobile ? mobileVideoRef.current : desktopVideoRef.current;
    const inactiveVideo = isMobile ? desktopVideoRef.current : mobileVideoRef.current;

    if (inactiveVideo) {
      try {
        inactiveVideo.pause();
      } catch {}
    }

    if (!activeVideo) return;

    const attemptPlay = async () => {
      try {
        await activeVideo.play();
        setShowTapHint(false);
      } catch (err) {
        console.warn("Autoplay prevented:", err);
        setShowTapHint(true);
      }
    };

    if (activeVideo.readyState >= 3) {
      attemptPlay();
    } else {
      activeVideo.addEventListener("canplay", attemptPlay, { once: true });
    }

    // Failsafe timeout in case 'ended' event never fires (15s)
    const maxDurationTimeout = setTimeout(() => {
      endIntro();
    }, 15000);

    return () => {
      clearTimeout(maxDurationTimeout);
      activeVideo.removeEventListener("canplay", attemptPlay);
    };
  }, [onComplete]);

  const handleTap = () => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const activeVideo = isMobile ? mobileVideoRef.current : desktopVideoRef.current;
    if (activeVideo) {
      if (activeVideo.paused) {
        activeVideo.play().catch(() => {
          endIntro();
        });
        setShowTapHint(false);
      } else {
        endIntro();
      }
    } else {
      endIntro();
    }
  };

  return (
    <div
      onClick={handleTap}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#1b4b91] cursor-pointer transition-opacity duration-700",
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
      style={{
        width: "100vw",
        height: "100vh",
      }}
    >
      {/* Mobile Video: visible ONLY on mobile screens (< 768px). Uses object-contain so NO cutting from left/right */}
      <video
        ref={mobileVideoRef}
        src="/intro-video-mobile.mp4"
        autoPlay
        muted
        playsInline
        // @ts-ignore
        webkit-playsinline="true"
        preload="auto"
        onEnded={endIntro}
        onError={() => {
          setFading(true);
          setTimeout(onComplete, 300);
        }}
        className="block md:hidden absolute inset-0 h-full w-full object-contain"
        style={{
          width: "100vw",
          height: "100vh",
          objectFit: "contain",
        }}
      />

      {/* Desktop Video: visible ONLY on desktop (>= 768px). Unchanged behavior */}
      <video
        ref={desktopVideoRef}
        src="/intro-video.mp4"
        autoPlay
        muted
        playsInline
        // @ts-ignore
        webkit-playsinline="true"
        preload="auto"
        onEnded={endIntro}
        onError={() => {
          setFading(true);
          setTimeout(onComplete, 300);
        }}
        className="hidden md:block absolute inset-0 h-full w-full object-cover"
        style={{
          width: "100vw",
          height: "100vh",
          objectFit: "cover",
        }}
      />

      {showTapHint && !fading && (
        <div className="relative z-10 rounded-full border border-white/30 bg-black/60 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-md animate-pulse">
          Tap anywhere to play intro
        </div>
      )}

      {/* Skip button in bottom right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setFading(true);
          setTimeout(onComplete, 300);
        }}
        className="absolute bottom-6 right-6 z-20 rounded-full border border-white/20 bg-black/40 px-3.5 py-1.5 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-white/80 backdrop-blur-md hover:bg-black/60 transition-colors"
      >
        Skip ↗
      </button>
    </div>
  );
}

function HomePage({ onLoginClick }: { onLoginClick: () => void }) {
  const { config } = useSiteConfig();
  const landingConfig = config?.landing || DEFAULT_SITE_CONFIG.landing;
  return (
    <div className="relative min-h-screen bg-[#e7e7ea] overflow-x-hidden flex flex-col justify-between">
      <BrickField density={18} opacity={0.6} />

      {/* Top-Left Team Button */}
      <div className="fixed top-3 left-3 sm:top-6 sm:left-6 z-50">
        <Link
          to="/team"
          className="flex items-center gap-1.5 rounded-[4px] border-[2.5px] sm:border-[3px] border-brick-black bg-brick-red px-2.5 py-1.5 sm:px-3.5 sm:py-2 font-display text-xs sm:text-sm font-bold uppercase tracking-[0.1em] text-brick-white shadow-[2px_2px_0_#0D0D0D] sm:shadow-[3px_3px_0_#0D0D0D] transition-transform hover:-translate-y-1 hover:shadow-[5px_5px_0_#0D0D0D] active:translate-y-0 active:shadow-[1px_1px_0_#0D0D0D]"
        >
          <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> TEAM
        </Link>
      </div>

      {/* Top-Right Fixed Navigation */}
      <div className="fixed top-3 right-3 sm:top-6 sm:right-6 z-50 flex items-center gap-1.5 sm:gap-2.5">
        <Link
          to="/about"
          className="flex items-center gap-1.5 rounded-[4px] border-[2.5px] sm:border-[3px] border-brick-black bg-brick-blue px-2.5 py-1.5 sm:px-3.5 sm:py-2 font-display text-xs sm:text-sm font-bold uppercase tracking-[0.1em] text-brick-white shadow-[2px_2px_0_#0D0D0D] sm:shadow-[3px_3px_0_#0D0D0D] transition-transform hover:-translate-y-1 hover:shadow-[5px_5px_0_#0D0D0D] active:translate-y-0 active:shadow-[1px_1px_0_#0D0D0D]"
        >
          <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> ABOUT US
        </Link>
        <button
          onClick={onLoginClick}
          className="flex items-center gap-1.5 rounded-[4px] border-[2.5px] sm:border-[3px] border-brick-black bg-brick-yellow px-2.5 py-1.5 sm:px-3.5 sm:py-2 font-display text-xs sm:text-sm font-bold uppercase tracking-[0.1em] text-brick-black shadow-[2px_2px_0_#0D0D0D] sm:shadow-[3px_3px_0_#0D0D0D] transition-transform hover:-translate-y-1 hover:shadow-[5px_5px_0_#0D0D0D] active:translate-y-0 active:shadow-[1px_1px_0_#0D0D0D] cursor-pointer"
        >
          LOGIN <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-3 sm:px-4 pt-14 sm:pt-16 pb-20 sm:pb-24 flex-1 w-full">
        {/* Section 1: Event Details & Overview */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-16 sm:mb-24 flex flex-col items-center text-center px-2"
        >
          <img
            src="/c-logo.png"
            alt="Converse 2k26"
            className="mb-4 sm:mb-6 h-24 sm:h-32 w-auto object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)]"
          />
          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-[0.06em] sm:tracking-[0.12em] text-[#003399] drop-shadow-sm">
            Converse 2k26
          </h1>
          <p className="mt-3 sm:mt-5 max-w-2xl font-body text-base sm:text-xl text-brick-black/80">
            {landingConfig.tagline}
          </p>
          <div className="mt-4 inline-block rounded-[4px] border-[2px] border-brick-black bg-brick-black px-4 py-1.5 sm:px-5 sm:py-2 font-display text-xs sm:text-sm font-bold uppercase tracking-[0.1em] text-brick-yellow shadow-[4px_4px_0_rgba(0,0,0,0.3)] max-w-[90vw] text-center">
            {landingConfig.theme}
          </div>

          <div className="mt-10 sm:mt-16 grid w-full max-w-4xl grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-3">
            {[
              { title: "02 Days of Action", desc: "Non-stop building and battling", color: "blue" },
              { title: "500+ Builders", desc: "Master minds from across regions", color: "yellow" },
              { title: "Ethical Tech", desc: "AI for a responsible future", color: "red" },
            ].map((block, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1, type: "spring", stiffness: 200 }}
              >
                <BrickCard
                  surface={block.color as any}
                  studs={4}
                  className="p-5 sm:p-6 text-center shadow-[4px_4px_0_#0D0D0D] transition-transform hover:-translate-y-1.5 hover:shadow-[6px_6px_0_#0D0D0D]"
                >
                  <h3 className={cn("mt-2 font-display text-lg sm:text-xl font-bold uppercase", block.color === "yellow" ? "text-brick-black" : "text-brick-white")}>
                    {block.title}
                  </h3>
                  <p className={cn("mt-2 font-body text-xs sm:text-sm", block.color === "yellow" ? "text-brick-black/80" : "text-brick-white/80")}>
                    {block.desc}
                  </p>
                </BrickCard>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>

      {/* Section 2: Flagship Events Marquee (100% Full Viewport Width Edge-to-Edge) */}
      <div className="relative z-10 w-full overflow-hidden my-4 sm:my-8">
        <EventMarquee />
      </div>

      {/* Section 2.5: Official Championship Event Roadmap & Venue Guide */}
      <div className="relative z-10 w-full my-4 sm:my-10">
        <EventRoadmapSection variant="landing" id="roadmap-landing" />
      </div>

      {/* Section 3: Sponsors Showcase — animated cards (Controlled via Admin switch) */}
      {landingConfig.sponsorsEnabled !== false && (landingConfig.sponsors?.length || 0) > 0 && (
        <div className="relative z-10 mx-auto max-w-5xl px-3 sm:px-4 pb-16 sm:pb-24 w-full">
          <SponsorShowcase
            title={landingConfig.sponsorsTitle}
            sponsors={landingConfig.sponsors}
          />
        </div>
      )}

      <SiteFooter />
    </div>
  );
}

/** Animated sponsor grid with floating bricks, staggered entry, and hover effects */
function SponsorShowcase({
  title,
  sponsors,
}: {
  title: string;
  sponsors: { name: string; url: string; color: string; desc: string }[];
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const COLORS = ["#C91A09", "#E8B800", "#0055BF", "#1b1b1b"];

  // Floating background bricks
  const bricks = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        color: COLORS[i % COLORS.length]!,
        left: `${Math.random() * 90}%`,
        top: `${Math.random() * 85}%`,
        r: `${Math.random() * 20 - 10}deg`,
        dx: `${Math.random() * 24 - 12}px`,
        dy: `${Math.random() * 24 - 12}px`,
        dur: `${12 + Math.random() * 10}s`,
        delay: `${Math.random() * 4}s`,
      })),
    []
  );

  // IntersectionObserver for staggered card entry
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Array.from(grid.children).indexOf(entry.target as Element);
            setTimeout(() => entry.target.classList.add("in-view"), idx * 70);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    Array.from(grid.children).forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sponsors]);

  return (
    <section className="sponsors-section">
      {/* Floating brick decorations */}
      {bricks.map((b, i) => (
        <div
          key={i}
          className="float-brick"
          style={{
            background: b.color,
            left: b.left,
            top: b.top,
            ["--r" as string]: b.r,
            ["--dx" as string]: b.dx,
            ["--dy" as string]: b.dy,
            animationDuration: b.dur,
            animationDelay: b.delay,
          }}
        />
      ))}

      {/* Section heading */}
      <div className="sponsors-head font-display text-brick-black">
        <span className="s-line" />
        <h2>{title}</h2>
        <span className="s-line" />
      </div>

      {/* Sponsor cards */}
      <div className="sponsor-grid" ref={gridRef}>
        {sponsors.map((sp, i) => {
          const accent = sp.color || COLORS[i % COLORS.length]!;
          const hasUrl = sp.url && sp.url.trim();
          return (
            <a
              key={i}
              className="sponsor-card"
              style={{ ["--accent" as string]: accent }}
              href={hasUrl ? sp.url.trim() : undefined}
              target={hasUrl ? "_blank" : undefined}
              rel={hasUrl ? "noopener noreferrer" : undefined}
              aria-label={`Visit sponsor: ${sp.name}`}
              onClick={hasUrl ? undefined : (e) => e.preventDefault()}
            >
              {/* Colored accent bar at top */}
              <span className="sp-accent-bar" style={{ background: accent }} />
              <span className="sp-studs">
                <span />
                <span />
              </span>
              <span className="sp-name">{sp.name}</span>
              {sp.desc && <span className="sp-desc">{sp.desc}</span>}
              <span className="sp-visit">VISIT SPONSOR ↗</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function LoginView({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleGoogleLogin = async () => {
    if (status === "loading") return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const { signInWithGoogle } = await import("@/lib/firebase-auth");
      const { role, onboarded } = await signInWithGoogle();
      setStatus("success");
      setTimeout(() => {
        if (role === "master") navigate({ to: "/admin/master" });
        else if (role === "sub-admin") navigate({ to: "/admin/subadmin" });
        else if (!onboarded) navigate({ to: "/onboarding" });
        else navigate({ to: "/dashboard" });
      }, 700);
    } catch (err: any) {
      console.error("Google login error:", err);
      setStatus("error");
      if (err?.code === "auth/popup-closed-by-user") {
        setErrorMsg("Sign-in cancelled. Try again.");
      } else {
        setErrorMsg("Sign-in failed. Please try again.");
      }
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-[#e7e7ea] px-4 py-6"
    >
      <BrickField density={22} opacity={0.95} />

      <BrickCard
        surface="blue-deep"
        studs={4}
        studColor="#FFD700"
        className={`snap-in-hero relative z-10 w-full max-w-md px-6 pb-7 pt-9 sm:px-9 ${status === "error" ? "rattle" : ""}`}
      >
        {/* Back to Home Navigation */}
        <button
          onClick={onBack}
          className="absolute left-4 top-4 flex items-center gap-1 font-display text-[10px] font-bold uppercase tracking-[0.1em] text-brick-white/70 hover:text-brick-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-3 w-3" /> BACK TO HOME
        </button>

        <div className="mt-4 flex flex-col items-center gap-1.5">
          <img
            src="/c-logo.png"
            alt="Converse 2k26 Logo"
            className="mb-2 h-24 w-auto object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.55)] animate-float transition-transform duration-200 hover:scale-105"
          />
          <span className="rounded-[4px] border-[3px] border-brick-black bg-brick-yellow px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-[0.22em] text-brick-black">
            Tech Fest
          </span>
          <h1 className="mt-2 text-center font-display text-3xl font-bold uppercase tracking-[0.14em] text-brick-white sm:text-4xl">
            Converse 2k26
          </h1>
          <p className="text-center font-body text-sm text-brick-white/70">The Brick Gateway</p>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          {/* Google Sign-In Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={status === "loading" || status === "success"}
            className="flex w-full items-center justify-center gap-3 rounded-[6px] border-[3px] border-brick-black bg-white px-5 py-3.5 font-display text-sm font-bold text-[#0D0D0D] shadow-[3px_3px_0_#0D0D0D] transition-all hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#0D0D0D] active:translate-y-0 active:shadow-[1px_1px_0_#0D0D0D] disabled:opacity-60 disabled:hover:translate-y-0 cursor-pointer"
          >
            {status === "loading" ? (
              <>
                <BrickSnapLoader size={20} brickColor="#0D0D0D" />
                <span className="uppercase tracking-[0.1em]">Connecting…</span>
              </>
            ) : status === "success" ? (
              <>
                <BrickSnapLoader size={20} brickColor="#0D0D0D" />
                <span className="uppercase tracking-[0.1em]">Snapped In ✓</span>
              </>
            ) : (
              <>
                {/* Google "G" Icon */}
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span className="uppercase tracking-[0.1em]">Sign in with Google</span>
              </>
            )}
          </button>

          {status === "error" && errorMsg && (
            <p className="text-center font-body text-xs text-brick-yellow/90">{errorMsg}</p>
          )}
        </div>

        <p className="mt-7 text-center font-body text-[11px] uppercase tracking-[0.18em] text-brick-white/45">
          {status === "success" ? "Welcome aboard, Builder!" : "Sign in with your Google account"}
        </p>
      </BrickCard>
    </motion.div>
  );
}


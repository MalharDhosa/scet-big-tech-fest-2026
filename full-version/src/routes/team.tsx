import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/brick/BaseplateNav";
import { useAuth } from "@/lib/firebase-auth";
import { useSiteConfig, updateSiteConfig, DEFAULT_SITE_CONFIG, sortCategoryMembers, sortFacultyMembers, type SiteConfig, type TeamCategory, type TeamMember } from "@/lib/firebase-site-config";
import {
  Users,
  Sparkles,
  ArrowRight,
  X,
  Linkedin,
  Instagram,
  Github,
  Phone,
  Mail,
  Lightbulb,
  FileUp,
  FileDown,
  CheckCircle2,
  Save,
  Shield,
  ExternalLink,
  GraduationCap,
  Hash,
} from "lucide-react";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "The Builders — Team | CONVERSE 2K26" },
      {
        name: "description",
        content:
          "Meet the organizing team, faculty coordinators, and student committees behind CONVERSE 2K26. Building the fest brick by brick.",
      },
      { property: "og:title", content: "The Builders — Team | CONVERSE 2K26" },
      {
        property: "og:description",
        content: "The minds and hands behind SCET's flagship tech festival.",
      },
    ],
  }),
  component: TeamPage,
});

const COLOR_MAP: Record<
  TeamCategory["color"],
  {
    bg: string;
    text: string;
    border: string;
    darkBorder: string;
    subText: string;
    dotHex: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  red: {
    bg: "bg-[#C91A09]",
    text: "text-white",
    border: "border-black",
    darkBorder: "#8f1206",
    subText: "text-white/80",
    dotHex: "#C91A09",
    badgeBg: "bg-red-900/30",
    badgeText: "text-red-100",
  },
  yellow: {
    bg: "bg-[#E8B800]",
    text: "text-brick-black",
    border: "border-black",
    darkBorder: "#a98700",
    subText: "text-black/80",
    dotHex: "#E8B800",
    badgeBg: "bg-amber-900/20",
    badgeText: "text-amber-950",
  },
  blue: {
    bg: "bg-[#0055BF]",
    text: "text-white",
    border: "border-black",
    darkBorder: "#003b85",
    subText: "text-white/80",
    dotHex: "#0055BF",
    badgeBg: "bg-blue-900/30",
    badgeText: "text-blue-100",
  },
  black: {
    bg: "bg-[#18181b]",
    text: "text-white",
    border: "border-black",
    darkBorder: "#09090b",
    subText: "text-slate-300",
    dotHex: "#18181b",
    badgeBg: "bg-slate-800",
    badgeText: "text-slate-200",
  },
  purple: {
    bg: "bg-[#7c3aed]",
    text: "text-white",
    border: "border-black",
    darkBorder: "#5b21b6",
    subText: "text-purple-100/80",
    dotHex: "#7c3aed",
    badgeBg: "bg-purple-900/30",
    badgeText: "text-purple-100",
  },
  emerald: {
    bg: "bg-[#059669]",
    text: "text-white",
    border: "border-black",
    darkBorder: "#047857",
    subText: "text-emerald-100/80",
    dotHex: "#059669",
    badgeBg: "bg-emerald-900/30",
    badgeText: "text-emerald-100",
  },
  gray: {
    bg: "bg-[#475569]",
    text: "text-white",
    border: "border-black",
    darkBorder: "#334155",
    subText: "text-slate-200",
    dotHex: "#475569",
    badgeBg: "bg-slate-700",
    badgeText: "text-slate-200",
  },
};

function getInitials(name: string): string {
  if (!name) return "CV";
  // Strip common academic/salutation prefixes so real name initials appear (e.g. Dr. Mita Parikh -> MP)
  const cleaned = name.replace(/^(dr\.|prof\.|er\.|mr\.|ms\.|mrs\.|dr|prof)\s+/i, "").trim();
  const parts = (cleaned || name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1 && parts[0]) return parts[0].slice(0, 2).toUpperCase();
  if (parts.length > 1 && parts[0] && parts[parts.length - 1]) {
    const first = parts[0][0] || "";
    const last = parts[parts.length - 1]![0] || "";
    return (first + last).toUpperCase();
  }
  return "CV";
}

function getCategoryCountLabel(category: TeamCategory, count: number): string {
  const id = (category.id || "").toLowerCase();
  const name = (category.name || "").toLowerCase();
  if (id === "hod-faculty" || name.includes("faculty") || name.includes("leadership")) {
    return count === 1 ? "1 Faculty Mentor" : `${count} Faculty Mentors`;
  }
  if (id === "student-heads" || name.includes("student head") || name.includes("lead")) {
    return count === 1 ? "1 Student Head" : `${count} Student Heads`;
  }
  if (id.startsWith("event-") || name.includes("track") || name.includes("quiz") || name.includes("codathon") || name.includes("challenge") || name.includes("buzz")) {
    const hasFaculty = (category.members || []).some(m => {
      const r = (m.role || "").toLowerCase();
      return r.includes("faculty") || r.includes("prof") || r.includes("dr.");
    });
    if (hasFaculty) {
      return count === 1 ? "1 Event Member" : `${count} Faculty & Coordinators`;
    }
    return count === 1 ? "1 Coordinator / Volunteer" : `${count} Coordinators & Volunteers`;
  }
  return count === 1 ? "1 Committee Member" : `${count} Heads & Members`;
}

/**
 * Auto-adjust the section container max-width, grid columns, and decorative top studs
 * based on the number of members in the team so sections with fewer members look snug,
 * balanced, and naturally proportioned without massive empty gaps.
 */
function getCategoryAreaConfig(count: number) {
  if (count <= 1) {
    return {
      containerMax: "max-w-md mx-auto",
      gridCols: "grid-cols-1 justify-items-center gap-3",
      studCount: 3,
    };
  }
  if (count === 2) {
    return {
      containerMax: "max-w-xl sm:max-w-2xl mx-auto",
      gridCols: "grid-cols-2 gap-4 sm:gap-10",
      studCount: 4,
    };
  }
  if (count === 3) {
    return {
      containerMax: "max-w-2xl sm:max-w-3xl lg:max-w-4xl mx-auto",
      gridCols: "grid-cols-3 gap-2.5 sm:gap-6 md:gap-8",
      studCount: 6,
    };
  }
  if (count === 4) {
    return {
      containerMax: "max-w-4xl sm:max-w-5xl mx-auto",
      gridCols: "grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6",
      studCount: 8,
    };
  }
  if (count <= 6) {
    return {
      containerMax: "max-w-4xl sm:max-w-5xl mx-auto",
      gridCols: "grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6",
      studCount: 8,
    };
  }
  return {
    containerMax: "w-full",
    gridCols: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6",
    studCount: 8,
  };
}

const sectionContainerVariants = {
  hidden: {
    opacity: 0,
    y: 28,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.44,
      ease: [0.16, 1, 0.3, 1],
      when: "beforeChildren",
      staggerChildren: 0.05,
      delayChildren: 0.06,
    },
  },
};

const memberPopUpVariants = {
  hidden: {
    opacity: 0,
    scale: 0.84,
    y: 16,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.32,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

function TeamPage() {
  const { config, loading } = useSiteConfig();
  const teamConfig = config?.team || DEFAULT_SITE_CONFIG.team!;
  const categories = teamConfig.categories || [];

  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    categories[0]?.id || ""
  );
  const [selectedMember, setSelectedMember] = useState<{
    member: TeamMember;
    category: TeamCategory;
  } | null>(null);

  const [clickedPingId, setClickedPingId] = useState<string | null>(null);

  // Master admin sync and upload system
  const { user } = useAuth();
  const isMasterAdmin = user?.role === "master";
  const [adminSyncToast, setAdminSyncToast] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSyncOfficialRoster = async () => {
    setIsSyncing(true);
    try {
      const fullConfig: SiteConfig = {
        ...(config || DEFAULT_SITE_CONFIG),
        team: {
          ...(config?.team || DEFAULT_SITE_CONFIG.team!),
          categories: DEFAULT_SITE_CONFIG.team!.categories,
        },
      };
      await updateSiteConfig(fullConfig);
      setAdminSyncToast("Official 2K26 Roster successfully synced to Firestore! Reloading in 1s...");
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      alert("Failed to sync roster: " + (err.message || "Permission denied"));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUploadRosterJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text);
        const cats: TeamCategory[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.categories)
          ? parsed.categories
          : null;

        if (!cats || cats.length === 0) {
          alert("Invalid team JSON: Must contain an array of categories or { categories: [...] }");
          return;
        }

        setIsSyncing(true);
        const fullConfig: SiteConfig = {
          ...(config || DEFAULT_SITE_CONFIG),
          team: {
            ...(config?.team || DEFAULT_SITE_CONFIG.team!),
            categories: cats,
          },
        };
        await updateSiteConfig(fullConfig);
        setAdminSyncToast(`Imported and saved ${cats.length} categories to Firestore! Reloading...`);
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (err: any) {
        alert("Error importing JSON: " + (err.message || "Invalid JSON format"));
      } finally {
        setIsSyncing(false);
        if (e.target) e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const navScrollContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isUserScrollingToRef = useRef(false);

  // Keep activeCategoryId synced when categories finish loading
  useEffect(() => {
    if (!activeCategoryId && categories.length > 0 && categories[0]) {
      setActiveCategoryId(categories[0].id);
    }
  }, [categories, activeCategoryId]);

  // Robust Scrollspy: accurately detect which department section is in view as user scrolls
  useEffect(() => {
    if (typeof window === "undefined" || categories.length === 0) return;

    const handleScroll = () => {
      // Don't fight programmatic smooth scrolling triggered by a click
      if (isUserScrollingToRef.current) return;

      const scrollPosition = window.scrollY + 140; // 140px accounts for sticky header height & offset
      let currentId = categories[0]?.id || "";

      // If scrolled near bottom of page, activate last category
      const isNearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 80;

      if (isNearBottom && categories.length > 0 && categories[categories.length - 1]) {
        currentId = categories[categories.length - 1]!.id;
      } else {
        for (let i = 0; i < categories.length; i++) {
          const cat = categories[i];
          if (!cat) continue;
          const el = document.getElementById(`dept-${cat.id}`);
          if (el) {
            const top = el.offsetTop;
            if (scrollPosition >= top) {
              currentId = cat.id;
            } else {
              break;
            }
          }
        }
      }

      setActiveCategoryId((prev) => (prev !== currentId ? currentId : prev));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [categories]);

  // AUTO-SCROLL TOP BAR: smoothly scroll the horizontal category bar so the active section tab is always centered & visible
  useEffect(() => {
    if (!activeCategoryId) return;
    const activeBtn = tabRefs.current[activeCategoryId];
    const container = navScrollContainerRef.current;
    if (activeBtn && container) {
      const btnLeft = activeBtn.offsetLeft;
      const btnWidth = activeBtn.offsetWidth;
      const containerWidth = container.offsetWidth;
      const targetScrollLeft = btnLeft - containerWidth / 2 + btnWidth / 2;

      container.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: "smooth",
      });
    }
  }, [activeCategoryId]);

  const scrollToCategory = (id: string) => {
    setActiveCategoryId(id);
    isUserScrollingToRef.current = true;
    const target = document.getElementById(`dept-${id}`);
    if (target) {
      const headerOffset = 110;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });

      setTimeout(() => {
        isUserScrollingToRef.current = false;
      }, 700);
    }
  };

  const handleMemberClick = (member: TeamMember, category: TeamCategory) => {
    setClickedPingId(member.id);
    setTimeout(() => setClickedPingId(null), 600);
    setSelectedMember({ member, category });
  };

  const facultyCount = useMemo(() => {
    const facultyCat = categories.find(
      (c) => c.id === "hod-faculty" || c.name?.toLowerCase().includes("faculty") || c.name?.toLowerCase().includes("leadership")
    );
    return facultyCat?.members?.length || 0;
  }, [categories]);

  const studentBuildersCount = useMemo(() => {
    return categories
      .filter((c) => c.id !== "hod-faculty" && !c.name?.toLowerCase().includes("faculty") && !c.name?.toLowerCase().includes("leadership"))
      .reduce((acc, cat) => acc + (cat.members?.length || 0), 0);
  }, [categories]);

  const studentCommitteesCount = useMemo(() => {
    return categories.filter(
      (c) => c.id !== "hod-faculty" && !c.name?.toLowerCase().includes("faculty") && !c.name?.toLowerCase().includes("leadership")
    ).length;
  }, [categories]);

  if (loading && !config) {
    return (
      <AppShell>
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brick-black border-t-brick-yellow" />
            <p className="font-display text-sm font-bold uppercase tracking-wider text-slate-600">
              Assembling Crew Data...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Master Admin Live Control Ribbon */}
      {isMasterAdmin && (
        <div className="bg-slate-900 text-white border-b-2 border-slate-700 px-4 py-2.5 shadow-md">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono uppercase font-bold tracking-wider text-amber-400">Master Admin Mode</span>
              <span className="text-slate-400 hidden sm:inline">|</span>
              <span className="text-slate-300 hidden sm:inline">{categories.length} Committees & Tracks Loaded</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSyncOfficialRoster}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 font-bold text-white hover:bg-blue-500 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="Sync official 17 categories & 27 members directly to Firestore"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isSyncing ? "Syncing..." : "Sync Official 2K26 Roster"}
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUploadRosterJson}
                accept=".json"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 font-bold text-slate-200 hover:bg-slate-700 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="Upload and apply a team-roster JSON file"
              >
                <FileUp className="h-3.5 w-3.5" />
                Import JSON
              </button>

              <a
                href="/team-roster-2026.json"
                download="team-roster-2026.json"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 font-bold text-slate-200 hover:bg-slate-700 active:scale-95 transition-all shadow-xs"
                title="Download the official team roster JSON file"
              >
                <FileDown className="h-3.5 w-3.5" />
                Export JSON
              </a>

              <Link
                to="/admin/master"
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-bold text-amber-300 hover:bg-amber-500/20 transition-all shadow-xs"
              >
                Admin Editor <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {adminSyncToast && (
        <div className="bg-emerald-600 text-white font-bold text-xs text-center py-2 px-4 shadow-md animate-in fade-in">
          {adminSyncToast}
        </div>
      )}

      <div className="relative pb-12">
        {/* ================= HERO SECTION ================= */}
        <section className="relative mx-auto max-w-3xl px-3 pt-3 pb-6 text-center sm:pt-6 sm:pb-12">
          {/* Eyebrow badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-brick-black bg-brick-yellow px-3.5 py-1 font-display text-[10px] sm:text-xs font-black uppercase tracking-[0.16em] sm:tracking-[0.18em] text-brick-black shadow-[2px_2px_0_#0D0D0D] sm:shadow-[3px_3px_0_#0D0D0D]"
          >
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-brick-black" />
            <span>{teamConfig.heroEyebrow || "MEET THE CREW"}</span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-3 sm:mt-4 font-display text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight text-brick-black break-words"
          >
            {teamConfig.heroTitle || "The builders behind every event"}
          </motion.h1>

          {/* Subtitle description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-3 sm:mt-4 max-w-2xl font-body text-xs sm:text-base md:text-lg text-slate-700 leading-relaxed px-1"
          >
            {teamConfig.heroSubtitle ||
              "None of this happens by accident. Every workshop, every stage, every late night before an event — it's this team piecing it together, brick by brick."}
          </motion.p>

          {/* 4-Color Lego Brick Rule */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-5 sm:mt-6 flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <span className="h-1.5 sm:h-2 w-6 sm:w-8 rounded-full border-[1.5px] border-brick-black bg-[#C91A09] shadow-[1px_1px_0_#0D0D0D]" />
            <span className="h-1.5 sm:h-2 w-6 sm:w-8 rounded-full border-[1.5px] border-brick-black bg-[#E8B800] shadow-[1px_1px_0_#0D0D0D]" />
            <span className="h-1.5 sm:h-2 w-6 sm:w-8 rounded-full border-[1.5px] border-brick-black bg-[#0055BF] shadow-[1px_1px_0_#0D0D0D]" />
            <span className="h-1.5 sm:h-2 w-6 sm:w-8 rounded-full border-[1.5px] border-brick-black bg-[#1b1b1b] shadow-[1px_1px_0_#0D0D0D]" />
          </motion.div>

          {/* Meta counters - Separating Faculty Mentors from Student Builders */}
          <div className="mt-4 sm:mt-5 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5 text-[11px] sm:text-xs font-bold text-slate-700">
            {facultyCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white/90 px-2.5 py-1 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#C91A09]" />
                <span>{facultyCount} Faculty Mentors</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white/90 px-2.5 py-1 shadow-sm">
              <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-brick-blue" />
              <span>{studentBuildersCount} Student Builders</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white/90 px-2.5 py-1 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-brick-yellow" />
              <span>{studentCommitteesCount} Committees & Tracks</span>
            </span>
          </div>
        </section>

        {/* ================= STICKY CATEGORY SCROLLSPY BAR ================= */}
        <div className="sticky top-2 sm:top-4 z-30 mb-6 sm:mb-12">
          <div className="mx-auto max-w-4xl px-0 sm:px-2">
            {/* Outer container with overflow-hidden ensures absolutely zero scrollbar or corner bleeding */}
            <div className="rounded-2xl border-[3px] sm:border-[3.5px] border-brick-black bg-white/95 p-1 sm:p-1.5 shadow-[3px_3px_0_#0D0D0D] sm:shadow-[4px_4px_0_#0D0D0D] backdrop-blur-md overflow-hidden">
              <div
                ref={navScrollContainerRef}
                className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden scroll-smooth"
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {categories.map((cat) => {
                  const isActive = activeCategoryId === cat.id;
                  const styleMeta = COLOR_MAP[cat.color] || COLOR_MAP.blue;
                  return (
                    <button
                      key={cat.id}
                      ref={(el) => {
                        tabRefs.current[cat.id] = el;
                      }}
                      type="button"
                      onClick={() => scrollToCategory(cat.id)}
                      className={`group relative flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-display font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer touch-manipulation ${
                        isActive
                          ? "bg-brick-black text-white shadow-[2px_2px_0_rgba(0,0,0,0.3)] scale-[1.02]"
                          : "text-slate-700 hover:bg-slate-100 hover:text-black"
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0 transition-transform group-hover:scale-125"
                        style={{ backgroundColor: styleMeta.dotHex }}
                      />
                      <span className="whitespace-nowrap">{cat.name}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[9px] sm:text-[10px] font-mono ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {cat.members?.length || 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ================= DEPARTMENT BRICK SECTIONS ================= */}
        <div className="space-y-8 sm:space-y-16">
          {categories.map((category) => {
            const styleMeta = COLOR_MAP[category.color] || COLOR_MAP.blue;
            const rawMembers = category.members || [];
            const members = sortCategoryMembers(rawMembers, category.id, category.name);
            const count = members.length;
            const areaConfig = getCategoryAreaConfig(count);

            return (
              <motion.section
                key={category.id}
                id={`dept-${category.id}`}
                data-dept-id={category.id}
                variants={sectionContainerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.18, margin: "0px 0px -50px 0px" }}
                style={{
                  WebkitBackfaceVisibility: "hidden",
                  backfaceVisibility: "hidden",
                }}
                className={`scroll-mt-28 sm:scroll-mt-32 ${areaConfig.containerMax} transform-gpu`}
              >
                {/* Category Header Label */}
                <div className="mb-2.5 sm:mb-3 flex flex-wrap items-baseline justify-between gap-1.5 sm:gap-2 px-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full border border-black/40 shadow-sm shrink-0"
                      style={{ backgroundColor: styleMeta.dotHex }}
                    />
                    <h2 className="font-display text-sm sm:text-lg font-black uppercase tracking-[0.12em] sm:tracking-[0.14em] text-brick-black">
                      {category.name}
                    </h2>
                    <span className="rounded-full border border-slate-300 bg-white/90 px-2 py-0.5 text-[10px] sm:text-xs font-mono font-bold text-slate-700 shadow-sm">
                      {getCategoryCountLabel(category, members.length)}
                    </span>
                  </div>
                  {category.description && (
                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium italic w-full sm:w-auto mt-0.5 sm:mt-0">
                      {category.description}
                    </p>
                  )}
                </div>

                {/* The LEGO Brick Container */}
                <div
                  className={`relative rounded-2xl border-[3px] sm:border-[3.5px] border-brick-black p-3.5 sm:p-7 shadow-[4px_4px_0_#0D0D0D] sm:shadow-[6px_6px_0_#0D0D0D] ${styleMeta.bg}`}
                  style={{
                    boxShadow:
                      "inset 0 3px 0 rgba(255,255,255,0.25), inset 0 -4px 0 rgba(0,0,0,0.25), 4px 4px 0 #0D0D0D",
                    WebkitBackfaceVisibility: "hidden",
                    backfaceVisibility: "hidden",
                  }}
                >
                  {/* Decorative Stud Rail on top - Filled with matching brick color */}
                  <div className="absolute -top-3 left-3 right-3 sm:left-6 sm:right-6 flex items-center justify-around pointer-events-none z-10">
                    {[...Array(areaConfig.studCount)].map((_, i) => (
                      <span
                        key={i}
                        className={`h-3 w-5 sm:w-8 rounded-t-md border-t-[2.5px] border-x-[2.5px] border-brick-black shadow-[inset_0_1.5px_0_rgba(255,255,255,0.45)] shrink-0 ${
                          areaConfig.studCount >= 8 && i >= 6 ? "hidden sm:block" : ""
                        }`}
                        style={{
                          backgroundColor: styleMeta.dotHex,
                        }}
                      />
                    ))}
                  </div>

                  {/* Members Grid / Stud Track - Dynamically adjusted based on member count */}
                  <div className={`grid ${areaConfig.gridCols} pt-1 sm:pt-2`}>
                    {members.map((member, mIdx) => {
                      const isPinged = clickedPingId === member.id;
                      const hasPhoto = Boolean(member.photo && member.photo.trim());
                      // Balance odd members on mobile 2-column grid only when count > 3
                      const isLastOddOnMobile =
                        count > 3 &&
                        mIdx === members.length - 1 &&
                        members.length % 2 !== 0;

                      return (
                        <motion.button
                          key={member.id || mIdx}
                          type="button"
                          onClick={() => handleMemberClick(member, category)}
                          variants={memberPopUpVariants}
                          style={{
                            WebkitBackfaceVisibility: "hidden",
                            backfaceVisibility: "hidden",
                          }}
                          whileHover={{ y: -5, scale: 1.03 }}
                          whileTap={{ scale: 0.94 }}
                          className={`group relative flex flex-col items-center text-center p-1.5 sm:p-2 rounded-xl focus:outline-none cursor-pointer touch-manipulation select-none transform-gpu ${
                            isLastOddOnMobile
                              ? "col-span-2 sm:col-span-1 max-w-[200px] mx-auto w-full"
                              : ""
                          }`}
                        >
                          {/* Stud Wrapper */}
                          <div className="relative mb-2 sm:mb-2.5">
                            {/* Expanding click ripple animation */}
                            {isPinged && (
                              <span className="absolute -inset-2.5 rounded-full border-2 border-white animate-ping pointer-events-none" />
                            )}

                            {/* Tactile Circular Stud - Uniform white stud with 3D bevel and glossy plastic sheen */}
                            <div
                              className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full border-[2.5px] sm:border-[3px] border-black/70 bg-white overflow-hidden transition-shadow duration-200 group-hover:shadow-[0_12px_24px_rgba(0,0,0,0.35),0_0_12px_rgba(255,255,255,0.25)] shadow-[inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-3px_4px_rgba(0,0,0,0.25),0_4px_8px_rgba(0,0,0,0.2)]"
                            >
                              {/* Glossy Stud Reflection Highlight (physical Lego sheen) */}
                              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/40 pointer-events-none rounded-full z-10 opacity-70 group-hover:opacity-100 transition-opacity" />

                              {hasPhoto ? (
                                <img
                                  src={member.photo}
                                  alt={member.name}
                                  className="h-full w-full object-cover transition-all duration-300 group-hover:scale-105"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                    const fb = (e.target as HTMLElement)
                                      .nextElementSibling as HTMLElement;
                                    if (fb) fb.style.display = "flex";
                                  }}
                                />
                              ) : null}

                              {/* Initials Fallback - Crisp white stud background with black initials for all teams */}
                              <div
                                className={`h-full w-full items-center justify-center font-display text-base sm:text-xl font-black text-brick-black bg-white transition-transform duration-200 group-hover:scale-110 ${
                                  hasPhoto ? "hidden" : "flex"
                                }`}
                              >
                                {getInitials(member.name)}
                              </div>
                            </div>
                          </div>

                          {/* Member Name */}
                          <span
                            className={`font-display text-[12px] sm:text-sm font-bold leading-tight line-clamp-2 transition-transform duration-200 group-hover:scale-105 ${styleMeta.text}`}
                          >
                            {member.name}
                          </span>

                          {/* Role label */}
                          <span
                            className={`mt-0.5 text-[10px] sm:text-[11px] font-medium leading-snug line-clamp-2 transition-opacity duration-200 ${styleMeta.subText}`}
                          >
                            {member.role ||
                              (category.id === "hod-faculty" || category.name?.toLowerCase().includes("faculty")
                                ? "Faculty Mentor"
                                : "Builder")}
                          </span>

                          {/* Subtle hover prompt - hide on mobile */}
                          <span className="mt-1 hidden sm:inline-block opacity-0 group-hover:opacity-100 transition-all duration-200 text-[10px] font-bold uppercase tracking-wider underline underline-offset-2 text-white/90 group-hover:translate-y-0 translate-y-1">
                            View Profile
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </motion.section>
            );
          })}
        </div>

        {/* ================= CLOSING CALL TO ACTION ================= */}
        {teamConfig.ctaEnabled !== false && (
          <motion.section
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.18, margin: "0px 0px -40px 0px" }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            style={{
              WebkitBackfaceVisibility: "hidden",
              backfaceVisibility: "hidden",
            }}
            className="mt-12 sm:mt-24 transform-gpu"
          >
            <div className="mx-auto max-w-2xl rounded-2xl border-[3px] sm:border-[3.5px] border-brick-black bg-white p-5 sm:p-10 text-center shadow-[4px_4px_0_#0D0D0D] sm:shadow-[6px_6px_0_#0D0D0D]">
              <div className="mx-auto mb-3 sm:mb-4 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl border-2 border-brick-black bg-brick-yellow shadow-[2px_2px_0_#0D0D0D]">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-brick-black" />
              </div>

              <h3 className="font-display text-lg sm:text-2xl font-black uppercase text-brick-black">
                {teamConfig.ctaTitle || "Want to help build the next one?"}
              </h3>

              <p className="mx-auto mt-2 max-w-lg font-body text-xs sm:text-base text-slate-600 leading-relaxed">
                {teamConfig.ctaSubtitle ||
                  "We're always looking for hands who care about doing things properly. No experience required — just show up."}
              </p>

              <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3">
                <a
                  href={
                    teamConfig.ctaButtonLink ||
                    "https://chat.whatsapp.com/EzV0MybDcYdG8kYBEG9D32"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border-[2.5px] border-brick-black bg-brick-black px-6 py-3 font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-white shadow-[3px_3px_0_#0D0D0D] transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer touch-manipulation"
                >
                  <span>{teamConfig.ctaButtonText || "Join the crew →"}</span>
                  <ArrowRight className="h-4 w-4" />
                </a>

                <Link
                  to="/about"
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border-[2.5px] border-brick-black bg-slate-100 px-5 py-3 font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-brick-black hover:bg-slate-200 transition-colors shadow-[2px_2px_0_#0D0D0D] touch-manipulation"
                >
                  <span>About CONVERSE</span>
                </Link>
              </div>
            </div>
          </motion.section>
        )}

        {/* ================= PROFILE MODAL (CENTERED DIALOG) ================= */}
        <AnimatePresence>
          {selectedMember && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3.5 sm:p-5 backdrop-blur-sm overflow-y-auto"
              onClick={() => setSelectedMember(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 10 }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  WebkitBackfaceVisibility: "hidden",
                  backfaceVisibility: "hidden",
                }}
                className="relative w-full max-w-md my-auto rounded-2xl border-[3.5px] border-brick-black bg-white p-5 sm:p-7 shadow-[6px_6px_0_#0D0D0D] max-h-[85vh] overflow-y-auto transform-gpu"
              >
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setSelectedMember(null)}
                  className="absolute right-3.5 top-3.5 sm:right-4 sm:top-4 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border-2 border-brick-black bg-slate-100 text-slate-700 hover:bg-rose-100 hover:text-rose-600 transition-colors cursor-pointer"
                  aria-label="Close profile"
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>

                {/* Top Avatar & Info */}
                <div className="flex items-center gap-3.5 sm:gap-5 pb-4 sm:pb-5 border-b border-slate-200">
                  {/* Avatar */}
                  <div
                    className="relative h-16 w-16 sm:h-22 sm:w-22 shrink-0 rounded-full border-[3px] border-brick-black overflow-hidden shadow-[2px_2px_0_#0D0D0D] sm:shadow-[3px_3px_0_#0D0D0D]"
                    style={{
                      backgroundColor:
                        COLOR_MAP[selectedMember.category.color]?.dotHex || "#0055BF",
                    }}
                  >
                    {selectedMember.member.photo ? (
                      <img
                        src={selectedMember.member.photo}
                        alt={selectedMember.member.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                          const fb = (e.target as HTMLElement)
                            .nextElementSibling as HTMLElement;
                          if (fb) fb.style.display = "flex";
                        }}
                      />
                    ) : null}

                    {/* Fallback Initials */}
                    <div
                      className={`h-full w-full items-center justify-center font-display text-xl sm:text-2xl font-black ${
                        selectedMember.category.color === "yellow"
                          ? "text-brick-black bg-[#E8B800]"
                          : "text-white"
                      } ${
                        selectedMember.member.photo ? "hidden" : "flex"
                      }`}
                    >
                      {getInitials(selectedMember.member.name)}
                    </div>
                  </div>

                  {/* Name, Role & Category */}
                  <div className="min-w-0 flex-1 pr-7 sm:pr-8">
                    <h3 className="font-display text-lg sm:text-2xl font-black uppercase text-brick-black break-words line-clamp-2 leading-tight">
                      {selectedMember.member.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-block rounded-md border border-brick-black bg-brick-yellow px-2 py-0.5 text-[10px] sm:text-[11px] font-display font-bold uppercase tracking-wider text-brick-black shadow-[1.5px_1.5px_0_#0D0D0D]">
                        {selectedMember.member.role ||
                          (selectedMember.category.id === "hod-faculty" || selectedMember.category.name?.toLowerCase().includes("faculty")
                            ? "Faculty Mentor"
                            : "Builder")}
                      </span>
                      <span className="text-[11px] sm:text-xs font-semibold text-slate-500">
                        {selectedMember.category.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Academic Standing & Enrollment (Shown only when profile is clicked) */}
                {Boolean(
                  selectedMember.member.enrollment?.trim() ||
                  selectedMember.member.standing?.trim()
                ) && (
                  <div className="mt-3.5 mb-1 rounded-xl border-2 border-slate-200 bg-slate-50/90 p-2.5 sm:p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left shadow-sm">
                    {selectedMember.member.enrollment?.trim() && (
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white shadow-xs">
                          <Hash className="h-3.5 w-3.5 text-slate-700" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                            Enrollment No.
                          </span>
                          <span className="font-mono text-xs sm:text-sm font-bold text-slate-800 break-all select-all">
                            {selectedMember.member.enrollment.trim()}
                          </span>
                        </div>
                      </div>
                    )}
                    {selectedMember.member.standing?.trim() && (
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white shadow-xs">
                          <GraduationCap className="h-3.5 w-3.5 text-slate-700" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                            Academic Standing
                          </span>
                          <span className="font-display text-xs sm:text-sm font-bold text-slate-800 truncate block">
                            {selectedMember.member.standing.trim()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Direct Contact Details (Phone & Email) */}
                {Boolean(selectedMember.member.email?.trim() || selectedMember.member.phone?.trim()) && (
                  <div className="mt-2.5 space-y-1.5 text-left bg-slate-50/70 rounded-xl p-2.5 border border-slate-200">
                    {selectedMember.member.email?.trim() && (
                      <div className="flex items-center gap-2 text-xs text-slate-700 font-medium break-all">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 bg-white">
                          <Mail className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <a
                          href={`mailto:${selectedMember.member.email.trim()}`}
                          className="hover:underline hover:text-brick-blue select-all"
                        >
                          {selectedMember.member.email.trim()}
                        </a>
                      </div>
                    )}
                    {selectedMember.member.phone?.trim() && (
                      <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 bg-white">
                          <Phone className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <a
                          href={`tel:${selectedMember.member.phone.replace(/[^0-9+]/g, "")}`}
                          className="hover:underline hover:text-brick-blue font-mono"
                        >
                          {selectedMember.member.phone.trim()}
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Bio text */}
                <div className="py-3.5 sm:py-4">
                  <p className="font-body text-xs sm:text-base text-slate-700 leading-relaxed">
                    {selectedMember.member.bio ||
                      "Passionate member of the CONVERSE 2K26 organizing crew dedicated to bringing tech, competition, and creativity to life."}
                  </p>
                </div>

                {/* Fun Fact callout */}
                {selectedMember.member.fact && (
                  <div className="mb-4 sm:mb-5 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 sm:p-3.5 flex items-start gap-2 sm:gap-2.5">
                    <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="block font-display text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-900">
                        Fun Fact
                      </span>
                      <p className="mt-0.5 text-xs sm:text-sm text-amber-950">
                        {selectedMember.member.fact}
                      </p>
                    </div>
                  </div>
                )}

                {/* Social links - only displayed if the member has at least one contact link */}
                {Boolean(
                  selectedMember.member.linkedin?.trim() ||
                  selectedMember.member.instagram?.trim() ||
                  selectedMember.member.github?.trim() ||
                  selectedMember.member.phone?.trim() ||
                  selectedMember.member.email?.trim()
                ) && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
                    <span className="font-display text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                      Connect
                    </span>

                    <div className="flex items-center gap-2">
                      {selectedMember.member.linkedin?.trim() && (
                        <a
                          href={selectedMember.member.linkedin.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border-2 border-brick-black bg-[#0A66C2] text-white shadow-[2px_2px_0_#0D0D0D] transition-transform hover:-translate-y-0.5 touch-manipulation"
                          title="LinkedIn Profile"
                        >
                          <Linkedin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </a>
                      )}

                      {selectedMember.member.instagram?.trim() && (
                        <a
                          href={selectedMember.member.instagram.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border-2 border-brick-black bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-500 text-white shadow-[2px_2px_0_#0D0D0D] transition-transform hover:-translate-y-0.5 touch-manipulation"
                          title="Instagram"
                        >
                          <Instagram className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </a>
                      )}

                      {selectedMember.member.github?.trim() && (
                        <a
                          href={selectedMember.member.github.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border-2 border-brick-black bg-[#24292e] text-white shadow-[2px_2px_0_#0D0D0D] transition-transform hover:-translate-y-0.5 touch-manipulation"
                          title="GitHub Profile"
                        >
                          <Github className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </a>
                      )}

                      {selectedMember.member.phone?.trim() && (
                        <a
                          href={`tel:${selectedMember.member.phone.replace(/[^0-9+]/g, "")}`}
                          className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border-2 border-brick-black bg-emerald-600 text-white shadow-[2px_2px_0_#0D0D0D] transition-transform hover:-translate-y-0.5 touch-manipulation"
                          title={`Call ${selectedMember.member.phone}`}
                        >
                          <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </a>
                      )}

                      {selectedMember.member.email?.trim() && (
                        <a
                          href={`mailto:${selectedMember.member.email.trim()}`}
                          className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border-2 border-brick-black bg-slate-800 text-white shadow-[2px_2px_0_#0D0D0D] transition-transform hover:-translate-y-0.5 touch-manipulation"
                          title="Send Email"
                        >
                          <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

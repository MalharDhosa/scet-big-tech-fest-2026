import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, CalendarRange, User, Shield, LogOut, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrickField } from "./BrickField";
import { SiteFooter } from "./SiteFooter";
import { useAuth, signOut } from "@/lib/firebase-auth";

const TABS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/events", label: "Events", icon: CalendarRange },
  { to: "/team", label: "Team", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
];

const plateTexture =
  "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 22px), linear-gradient(180deg, #0055BF 0%, #003399 100%)";

/** Subtle repeating stud-grid dots on the page background */
const studGridBg =
  "radial-gradient(circle, rgba(0,0,0,0.04) 1.5px, transparent 1.5px)";

export function BaseplateNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  
  const showAdmin = user?.role === "master" || user?.role === "sub-admin" || user?.role === "admin";
  const adminTarget = user?.role === "master" ? "/admin/master" : user?.role === "sub-admin" ? "/admin/subadmin" : "/admin";
  const tabsToRender = showAdmin ? [...TABS, { to: adminTarget, label: "Admin", icon: Shield }] : TABS;

  const handleLogout = async () => {
    try {
      await signOut();
      window.location.href = "/";
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <>
      {/* Desktop top baseplate */}
      <header className="relative z-30 hidden px-4 pt-4 md:block">
        <nav
          className="brick-bevel mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-[6px] border-[3px] border-brick-black px-4 py-3"
          style={{ background: plateTexture }}
        >
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="group flex items-center gap-2.5 pr-3">
              <img
                src="/c-logo.png"
                alt="Converse 2k26 Logo"
                className="h-10 w-auto object-contain drop-shadow-[2px_2px_0_rgba(13,13,13,0.55)] transition-transform duration-200 group-hover:scale-110 group-hover:rotate-2"
              />
              <span className="font-display text-sm font-bold uppercase tracking-[0.18em] text-brick-white">
                Converse 2k26
              </span>
            </Link>

            <div className="flex items-center gap-2">
              {tabsToRender.map((t, i) => {
                const active = pathname.startsWith(t.to);
                return (
                  <Link
                    key={t.to}
                    to={t.to}
                    className="snap-in relative"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <span
                      className={cn(
                        "block rounded-[4px] border-[3px] border-brick-black px-4 py-1.5 font-display text-xs font-bold uppercase tracking-[0.12em] transition-transform duration-150 hover:-translate-y-[2px]",
                        active
                          ? "bg-brick-yellow text-brick-black"
                          : "bg-[#00296f] text-brick-white/85",
                      )}
                      style={{
                        boxShadow:
                          "inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -3px 0 rgba(0,0,0,0.28), 3px 3px 0 rgba(13,13,13,0.7)",
                      }}
                    >
                      {t.label}
                    </span>
                    {active && (
                      <span className="absolute -bottom-3 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-[3px] border-brick-black bg-brick-yellow" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side: Compact LEGO Red Logout Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="group flex items-center gap-1.5 rounded-[4px] border-[3px] border-brick-black bg-brick-red px-3.5 py-1.5 font-display text-xs font-bold uppercase tracking-[0.12em] text-brick-white transition-transform duration-150 hover:-translate-y-[2px] cursor-pointer"
              style={{
                boxShadow:
                  "inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -3px 0 rgba(0,0,0,0.35), 3px 3px 0 rgba(13,13,13,0.7)",
              }}
              title="Log out securely"
            >
              <LogOut className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
              <span>Logout</span>
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile bottom baseplate */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t-[3px] border-brick-black px-2 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] md:hidden"
        style={{ background: plateTexture }}
      >
        {tabsToRender.map((t) => {
          const active = pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link key={t.to} to={t.to} className="relative flex-1 px-1">
              {active && (
                <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2px] border-brick-black bg-brick-yellow" />
              )}
              <span
                className={cn(
                  "flex flex-col items-center gap-1 rounded-[4px] border-[3px] border-brick-black py-1.5",
                  active ? "bg-brick-yellow text-brick-black" : "bg-[#00296f] text-brick-white/85",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="font-display text-[10px] font-bold uppercase tracking-[0.1em]">
                  {t.label}
                </span>
              </span>
            </Link>
          );
        })}

        {/* Mobile Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          className="relative flex-1 px-1 cursor-pointer"
          title="Logout"
        >
          <span className="flex flex-col items-center gap-1 rounded-[4px] border-[3px] border-brick-black py-1.5 bg-[#8b1000] text-brick-white active:bg-brick-red transition-colors">
            <LogOut className="h-4 w-4" />
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.1em]">
              Logout
            </span>
          </span>
        </button>
      </nav>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen flex flex-col justify-between"
      style={{
        backgroundColor: "var(--bg-canvas)",
        backgroundImage: studGridBg,
        backgroundSize: "24px 24px",
      }}
    >
      {/* Floating ambient LEGO bricks — vibrant layer matching login page */}
      <BrickField density={18} opacity={0.68} />

      <div className="flex-1 flex flex-col">
        <BaseplateNav />
        <main className="relative mx-auto w-full max-w-6xl px-4 pt-3 md:pt-5 pb-16 md:pb-12 flex-1">
          {children}
        </main>
      </div>

      {/* Footer flush at bottom */}
      <div className="relative z-20">
        <SiteFooter />
      </div>
    </div>
  );
}


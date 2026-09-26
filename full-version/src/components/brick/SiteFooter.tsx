import { Instagram, Phone, Users } from "lucide-react";
import { useSiteConfig, DEFAULT_SITE_CONFIG, sortFacultyNames } from "@/lib/firebase-site-config";

export function SiteFooter() {
  const { config } = useSiteConfig();
  const footer = config?.footer || DEFAULT_SITE_CONFIG.footer;

  // Split designed by text to format developer names with underlines
  const rawDesignedByText = footer.designedByText || DEFAULT_SITE_CONFIG.footer.designedByText;
  const designedByText =
    !rawDesignedByText || rawDesignedByText.includes("Utsav") || rawDesignedByText.includes("Jay Ganjawala")
      ? "Designed & Developed by Malhar Balar and Harsh Gajera"
      : rawDesignedByText;
  const copyrightText = footer.copyrightText || DEFAULT_SITE_CONFIG.footer.copyrightText;

  return (
    <footer
      className="relative w-full overflow-hidden border-t border-white/10 text-white select-none"
      style={{
        backgroundColor: "#030611",
        backgroundImage: `
          radial-gradient(circle at 10% 20%, rgba(56, 189, 248, 0.08) 0%, transparent 45%),
          radial-gradient(circle at 50% 10%, rgba(192, 132, 252, 0.07) 0%, transparent 50%),
          radial-gradient(circle at 90% 30%, rgba(251, 146, 60, 0.08) 0%, transparent 45%),
          radial-gradient(circle at 50% 100%, rgba(0, 85, 191, 0.08) 0%, transparent 60%)
        `,
      }}
    >
      <div className="relative mx-auto w-full max-w-[1400px] px-6 sm:px-10 lg:px-16 pt-12 sm:pt-16 pb-[max(7.5rem,calc(5.5rem+env(safe-area-inset-bottom,0px)))] md:pb-10">
        
        {/* Main Grid: 4 Balanced Columns with Full Horizontal Coverage */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-8 xl:gap-12 items-start">
          
          {/* Column 1: CONVERSE 2K26 Brand & Social */}
          <div className="flex flex-col justify-between h-full space-y-5">
            <div>
              {/* Logo & Fest Title */}
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-brick-black bg-white p-1 shadow-[2px_2px_0_#0D0D0D]">
                  <img
                    src="/c-logo.png"
                    alt="CONVERSE 2K26"
                    className="h-full w-full object-contain filter drop-shadow-sm"
                  />
                </div>
                <div>
                  <span className="block font-display text-lg font-black uppercase tracking-[0.12em] text-white">
                    CONVERSE 2K26
                  </span>
                  <span className="block font-display text-[10px] font-bold uppercase tracking-[0.16em] text-brick-yellow">
                    SCET Annual Tech Fest
                  </span>
                </div>
              </div>

              {/* Department & Institute Affiliation */}
              <div className="mt-4 space-y-1 text-xs text-slate-300">
                <p className="font-semibold text-slate-200">
                  Department of Information Technology &amp; Artificial Intelligence and Data Science
                </p>
                <p className="text-slate-400">
                  Sarvajanik College of Engineering &amp; Technology
                </p>
                <p className="text-[11px] text-slate-500">
                  Surat, Gujarat, India
                </p>
              </div>
            </div>

            {/* Social & Team Links */}
            <div className="pt-2 space-y-2.5">
              <a
                href={footer.instagramUrl || "https://instagram.com/converseitaids"}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 hover:bg-gradient-to-r hover:from-pink-500/15 hover:via-purple-500/15 hover:to-amber-500/10 hover:border-pink-500/40 px-3.5 py-2.5 transition-all shadow-sm cursor-pointer w-full"
                aria-label="Follow us on Instagram"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-500 p-[1.5px] shadow-sm">
                  <div className="flex h-full w-full items-center justify-center rounded-[6.5px] bg-[#05070e]">
                    <Instagram className="h-4 w-4 text-pink-400 group-hover:scale-110 transition-transform" />
                  </div>
                </div>
                <div className="text-left min-w-0">
                  <span className="block font-display text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Follow Us
                  </span>
                  <span className="block font-body text-xs font-semibold text-slate-200 group-hover:text-pink-300 transition-colors truncate">
                    @converseitaids
                  </span>
                </div>
              </a>

            </div>
          </div>

          {/* Column 2: Head of Department */}
          <div>
            <div className="flex items-center gap-2 mb-3.5">
              <span className="h-2 w-2 rounded-full bg-[#38bdf8] shadow-[0_0_8px_#38bdf8]" />
              <h3 className="font-display text-xs sm:text-sm font-bold uppercase tracking-[0.14em] text-[#38bdf8]">
                {footer.hodTitle || "Head of Department"}
              </h3>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 backdrop-blur-sm shadow-sm hover:border-[#38bdf8]/30 transition-colors">
              <p className="font-display text-base sm:text-lg font-bold text-white tracking-wide">
                {footer.hodName || "Dr. Mita Parikh"}
              </p>
              <p className="mt-1.5 text-xs text-slate-300 font-medium">
                Head, Dept. of Information Technology and Data Science
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Sarvajanik College of Engineering &amp; Technology
              </p>
            </div>
          </div>

          {/* Column 3: Faculty Coordinators */}
          <div>
            <div className="flex items-center gap-2 mb-3.5">
              <span className="h-2 w-2 rounded-full bg-[#c084fc] shadow-[0_0_8px_#c084fc]" />
              <h3 className="font-display text-xs sm:text-sm font-bold uppercase tracking-[0.14em] text-[#c084fc]">
                {footer.facultyTitle || "Faculty Coordinators"}
              </h3>
            </div>
            <ul className="space-y-2.5">
              {sortFacultyNames(footer.facultyCoordinators || DEFAULT_SITE_CONFIG.footer.facultyCoordinators).map(
                (name, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-200 font-medium rounded-lg border border-white/5 bg-white/[0.02] px-3.5 py-2 hover:bg-white/[0.05] hover:text-white transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#c084fc] shrink-0" />
                    <span className="truncate">{name}</span>
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Column 4: Student Heads */}
          <div>
            <div className="flex items-center gap-2 mb-3.5">
              <span className="h-2 w-2 rounded-full bg-[#fb923c] shadow-[0_0_8px_#fb923c]" />
              <h3 className="font-display text-xs sm:text-sm font-bold uppercase tracking-[0.14em] text-[#fb923c]">
                {footer.studentHeadsTitle || "Student Heads"}
              </h3>
            </div>
            <ul className="space-y-2.5">
              {(footer.studentHeads || DEFAULT_SITE_CONFIG.footer.studentHeads).map(
                (sh, idx) => {
                  const cleanPhone = sh.phone ? sh.phone.replace(/[^0-9+]/g, "") : "";
                  const displayPhone = sh.phone ? sh.phone.replace(/[()]/g, "").trim() : "";
                  return (
                    <li
                      key={idx}
                      className="flex flex-col xl:flex-row xl:items-center justify-between gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] p-2.5 hover:bg-white/[0.05] transition-colors"
                    >
                      <span className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                        {sh.name}
                      </span>
                      {cleanPhone && (
                        <a
                          href={`tel:${cleanPhone}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white/5 hover:bg-[#fb923c]/20 border border-white/10 hover:border-[#fb923c]/50 px-2.5 py-0.5 text-[11px] font-mono text-[#fb923c] hover:text-[#ffedd5] transition-all shrink-0 cursor-pointer"
                          title={`Call ${sh.name}`}
                        >
                          <Phone className="h-2.5 w-2.5" />
                          <span>{displayPhone}</span>
                        </a>
                      )}
                    </li>
                  );
                }
              )}
            </ul>
          </div>

        </div>

        {/* Tactile LEGO Stud Divider */}
        <div className="my-8 sm:my-10 flex items-center gap-3">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-white/5" />
          <div className="flex items-center gap-1.5 px-2">
            <span className="h-2 w-2 rounded-full border border-black/60 bg-[#0055BF] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
            <span className="h-2 w-2 rounded-full border border-black/60 bg-[#FFD700] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
            <span className="h-2 w-2 rounded-full border border-black/60 bg-[#C91A09] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
          </div>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent via-white/15 to-white/5" />
        </div>

        {/* Bottom Credits & Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 text-xs text-slate-400 px-1">
          <p className="font-body tracking-wide text-center sm:text-left leading-relaxed">
            {copyrightText} · <span className="text-slate-500">SCET Tech Fest</span>
          </p>
          <p className="font-body tracking-wide text-center sm:text-right leading-relaxed">
            {designedByText.includes("Malhar Balar") && designedByText.includes("Harsh Gajera") ? (
              <>
                Designed &amp; Developed by{" "}
                <span className="underline underline-offset-4 font-semibold text-slate-100 hover:text-white transition-colors">
                  Malhar Balar
                </span>{" "}
                and{" "}
                <span className="underline underline-offset-4 font-semibold text-slate-100 hover:text-white transition-colors">
                  Harsh Gajera
                </span>
              </>
            ) : designedByText.includes(" & ") ? (
              <>
                {designedByText.split(" & ").map((part, idx) => (
                  <span key={idx}>
                    {idx > 0 && " & "}
                    <span className="underline underline-offset-4 font-semibold text-slate-100 hover:text-white transition-colors">
                      {part.replace(/^Designed & Developed by\s*/i, "")}
                    </span>
                  </span>
                ))}
              </>
            ) : (
              <span>{designedByText}</span>
            )}
          </p>
        </div>

      </div>
    </footer>
  );
}

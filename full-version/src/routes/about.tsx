import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useSiteConfig, DEFAULT_SITE_CONFIG } from "@/lib/firebase-site-config";
import { ArrowLeft, Instagram, MessageCircle, Users } from "lucide-react";
import { BrickField } from "@/components/brick/BrickField";
import { SiteFooter } from "@/components/brick/SiteFooter";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — CONVERSE 2K26" },
      { name: "description", content: "Learn more about the team behind CONVERSE 2K26." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { config: rawConfig, loading } = useSiteConfig();
  const aboutConfig = {
    ...DEFAULT_SITE_CONFIG.about,
    ...(rawConfig?.about || {}),
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#e7e7ea]">
        <div className="flex h-10 w-10 animate-spin items-center justify-center rounded-full border-4 border-brick-black border-t-brick-yellow"></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#e7e7ea] flex flex-col justify-between overflow-x-hidden">
      <BrickField density={12} opacity={0.4} />

      <div className="relative z-10 mx-auto max-w-3xl w-full px-4 py-8 flex-1">
        <div className="mb-8 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.1em] text-brick-black/60 hover:text-brick-black"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[4px] border-[3px] sm:border-[4px] border-brick-black bg-white p-5 sm:p-8 md:p-12 shadow-[5px_5px_0_#0D0D0D] sm:shadow-[8px_8px_0_#0D0D0D]"
        >
          <div className="mb-6 flex items-center justify-center">
            <img src="/c-logo.png" alt="Converse Logo" className="h-16 sm:h-20 w-auto object-contain" />
          </div>

          <h1 className="text-center font-display text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-[0.05em] text-brick-black">
            {aboutConfig.pageTitle}
          </h1>
          
          <div className="mx-auto mt-6 mb-8 h-1 w-16 bg-brick-yellow"></div>

          <p className="text-center font-display text-lg font-bold uppercase tracking-wide text-brick-blue mb-8">
            {aboutConfig.pageDesc}
          </p>

          <div className="space-y-6 font-body text-sm leading-relaxed text-brick-black/80 md:text-base">
            <p>{aboutConfig.paragraph1}</p>
            <p>{aboutConfig.paragraph2}</p>
          </div>

          <div className="mt-8 border-t-2 border-dashed border-brick-black/10 pt-6">
            <h3 className="mb-5 text-center font-display text-sm font-bold uppercase tracking-[0.1em] text-brick-black">
              Connect With Us
            </h3>
            
            <div className="flex justify-center gap-6">
              {aboutConfig.instagramUrl && (
                <a
                  href={aboutConfig.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-brick-black bg-[#E1306C] text-white shadow-[3px_3px_0_#0D0D0D] transition-transform hover:-translate-y-1 hover:shadow-[5px_5px_0_#0D0D0D]"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {aboutConfig.whatsappUrl && (
                <a
                  href={aboutConfig.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-brick-black bg-[#25D366] text-white shadow-[3px_3px_0_#0D0D0D] transition-transform hover:-translate-y-1 hover:shadow-[5px_5px_0_#0D0D0D]"
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <SiteFooter />
    </div>
  );
}

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { LegoPiece } from "./LegoPiece";

export function LegoIntroAnimation({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"build" | "reveal" | "fade">("build");

  useEffect(() => {
    // Sequence the animation phases
    const t1 = setTimeout(() => setPhase("reveal"), 1500); // Wait for bricks to drop
    const t2 = setTimeout(() => setPhase("fade"), 3500);   // Show logo, then fade out
    const t3 = setTimeout(() => onComplete(), 4200);       // Unmount
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === "fade" ? 0 : 1 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-brick-black overflow-hidden"
    >
      {/* Decorative Falling Bricks */}
      <motion.div
        initial={{ y: "-100vh", rotate: -15 }}
        animate={{ y: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.1 }}
        className="absolute top-1/4 left-1/4 opacity-50 blur-[2px]"
      >
        <LegoPiece color="yellow" cols={2} rows={2} unit={24} />
      </motion.div>
      <motion.div
        initial={{ y: "-100vh", rotate: 25 }}
        animate={{ y: 0, rotate: 10 }}
        transition={{ type: "spring", stiffness: 120, damping: 12, delay: 0.3 }}
        className="absolute top-1/3 right-1/4 opacity-50 blur-[1px]"
      >
        <LegoPiece color="blue" cols={4} rows={2} unit={20} />
      </motion.div>
      <motion.div
        initial={{ y: "-100vh", rotate: 45 }}
        animate={{ y: 0, rotate: 20 }}
        transition={{ type: "spring", stiffness: 90, damping: 14, delay: 0.5 }}
        className="absolute bottom-1/4 right-1/3 opacity-50 blur-[3px]"
      >
        <LegoPiece color="red" cols={3} rows={1} unit={28} />
      </motion.div>

      {/* Main Logo Reveal */}
      <div className="relative z-10 flex flex-col items-center">
        <motion.img
          src="/c-logo.png"
          alt="Converse 2k26"
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: phase !== "build" ? 1 : 0,
            opacity: phase !== "build" ? 1 : 0,
          }}
          transition={{ type: "spring", stiffness: 150, damping: 20 }}
          className="h-32 w-auto object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)]"
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: phase !== "build" ? 1 : 0,
            y: phase !== "build" ? 0 : 20,
          }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-6 flex flex-col items-center"
        >
          <span className="rounded-[4px] border-[3px] border-brick-white bg-brick-yellow px-3 py-1 font-display text-xs font-bold uppercase tracking-[0.2em] text-brick-black shadow-[3px_3px_0_#FFFFFF]">
            System Online
          </span>
          <h1 className="mt-3 text-center font-display text-4xl font-black uppercase tracking-[0.14em] text-brick-white drop-shadow-md">
            Converse 2k26
          </h1>
        </motion.div>
      </div>

      {/* Skip Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        onClick={onComplete}
        className="absolute bottom-10 font-display text-xs font-bold uppercase tracking-[0.15em] text-brick-white/50 hover:text-brick-white transition-colors cursor-pointer"
      >
        Press to Skip
      </motion.button>
    </motion.div>
  );
}

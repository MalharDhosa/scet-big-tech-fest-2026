/**
 * PageTransitionLoader
 * Shown instantly during client-side route transitions so the user never
 * sees a blank white page.  Uses CSS-only animations to keep it lightweight.
 */

export function PageTransitionLoader() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        backgroundColor: "var(--bg-canvas, #e7e7ea)",
        /* Fade in quickly so brief transitions barely flash */
        animation: "ptl-fade-in 120ms ease-out both",
      }}
    >
      {/* Three bouncing LEGO studs */}
      <div style={{ display: "flex", gap: "10px" }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2.5px solid var(--brick-black, #0d0d0d)",
              backgroundColor:
                i === 0
                  ? "var(--brick-yellow, #FFD700)"
                  : i === 1
                    ? "var(--brick-red, #C91A09)"
                    : "var(--brick-blue, #0055BF)",
              boxShadow:
                "inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.2)",
              animation: `ptl-bounce 600ms ${i * 120}ms cubic-bezier(0.22,1.4,0.36,1) infinite alternate`,
            }}
          />
        ))}
      </div>

      <span
        style={{
          fontFamily: "'Chakra Petch', system-ui, sans-serif",
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase" as const,
          color: "rgba(13,13,13,0.35)",
        }}
      >
        Loading…
      </span>

      {/* Inline keyframes — avoids requiring a separate CSS import */}
      <style>{`
        @keyframes ptl-fade-in {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes ptl-bounce {
          from { transform: translateY(0)  scale(1)   }
          to   { transform: translateY(-10px) scale(1.15) }
        }
      `}</style>
    </div>
  );
}

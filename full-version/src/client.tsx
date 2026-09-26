import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
    {
      onRecoverableError(error: any) {
        const msg = error?.message || String(error || "");
        // Suppress benign hydration mismatch errors (e.g. Minified React error #418)
        // caused when hydrating a pre-rendered or static HTML shell where client state regenerates cleanly.
        if (
          msg.includes("418") ||
          msg.includes("Hydration failed") ||
          msg.includes("hydrating") ||
          msg.includes("did not match")
        ) {
          return;
        }
        console.error(error);
      },
    },
  );
});

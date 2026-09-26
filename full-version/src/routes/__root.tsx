import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  const router = useRouter();

  useEffect(() => {
    router.navigate({ to: "/" });
  }, [router]);

  return null;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("Root boundary caught error:", error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#001d5c] text-white px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/30 text-2xl">
          ⚠️
        </div>
        <h1 className="font-display text-2xl font-black uppercase tracking-wide text-white">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-white/70 leading-relaxed">
          Something went wrong while loading this view. You can reload the page or return to the main stage.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              try {
                router.invalidate();
                reset();
              } catch {
                window.location.reload();
              }
            }}
            className="inline-flex items-center justify-center rounded-xl bg-[#FFD700] px-5 py-2.5 text-xs font-display font-bold uppercase tracking-wider text-[#001d5c] hover:bg-[#ffdf33] transition-colors cursor-pointer shadow-md"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-display font-bold uppercase tracking-wider text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "CONVERSE 2K26 | SCET Tech Fest" },
      {
        name: "description",
        content:
          "CONVERSE 2K26 — SCET Tech Fest. Where Technology Meets Creativity. Explore challenges and register for flagship events.",
      },
      { name: "author", content: "SCET Student Council" },
      { property: "og:title", content: "CONVERSE 2K26 | SCET Tech Fest" },
      {
        property: "og:description",
        content: "Where Technology Meets Creativity · Official SCET Tech Fest Portal",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossorigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Lexend:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico?v=20260910" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png?v=20260910" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png?v=20260910" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png?v=20260910" },
      { rel: "shortcut icon", href: "/favicon.ico?v=20260910" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var h = window.location.hostname.toLowerCase();
                var isLocal = h === "localhost" || h === "127.0.0.1" || h.startsWith("192.168.") || h.startsWith("10.") || h.startsWith("172.") || h.endsWith(".local") || h.includes(".internal");
                if (!isLocal && h !== "itaiconverse.in" && h !== "www.itaiconverse.in") {
                  if (!window.location.pathname.startsWith("/__/auth")) {
                    window.location.replace("https://itaiconverse.in" + window.location.pathname + window.location.search + window.location.hash);
                  }
                }
              })();
            `,
          }}
        />
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const h = window.location.hostname.toLowerCase();
      const isLocal = h === "localhost" || h === "127.0.0.1" || h.startsWith("192.168.") || h.startsWith("10.") || h.startsWith("172.") || h.endsWith(".local") || h.includes(".internal");
      if (!isLocal && h !== "itaiconverse.in" && h !== "www.itaiconverse.in") {
        if (!window.location.pathname.startsWith("/__/auth")) {
          window.location.replace("https://itaiconverse.in" + window.location.pathname + window.location.search + window.location.hash);
        }
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}

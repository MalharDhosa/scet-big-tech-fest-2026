import { createFileRoute, useNavigate, Outlet, useMatches } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth, signIn, signInWithGoogle } from "@/lib/firebase-auth";
import { Shield, ArrowRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Login — CONVERSE 2K26 | Blueprint Control Center" },
      {
        name: "description",
        content: "Admin and coordinator login portal for CONVERSE 2K26 event management.",
      },
    ],
  }),
  component: AdminLayout,
});

/**
 * Layout wrapper: renders child route (master/scanner) if matched,
 * otherwise renders the admin login gateway.
 */
function AdminLayout() {
  const matches = useMatches();
  // If a child route is matched (master, scanner, or subadmin portal), render it via Outlet
  const hasChildRoute = matches.some(
    (m) =>
      m.routeId === "/admin/master" ||
      m.routeId === "/admin/scanner" ||
      m.routeId === "/admin/subadmin",
  );
  if (hasChildRoute) return <Outlet />;
  return <AdminGateway />;
}

function AdminGateway() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-redirect if already authenticated with a role
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === "master") {
        navigate({ to: "/admin/master" });
      } else if (user.role === "sub-admin") {
        navigate({ to: "/admin/subadmin" });
      }
      // participants stay on this page (no admin access)
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const { role } = await signIn(email, password);
      if (role === "master") {
        navigate({ to: "/admin/master" });
      } else if (role === "sub-admin") {
        navigate({ to: "/admin/subadmin" });
      } else {
        setStatus("error");
        setErrorMsg("Access denied. Your account does not have admin privileges.");
      }
    } catch (err: any) {
      setStatus("error");
      const code = err?.code || "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setErrorMsg("Invalid credentials. Check your email and password.");
      } else if (code === "auth/too-many-requests") {
        setErrorMsg("Too many attempts. Please wait and try again.");
      } else {
        setErrorMsg(err.message || "Login failed. Please try again.");
      }
    }
  };

  const handleGoogleAdminLogin = async () => {
    if (status === "loading") return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const { role } = await signInWithGoogle();
      if (role === "master") {
        navigate({ to: "/admin/master" });
      } else if (role === "sub-admin") {
        navigate({ to: "/admin/subadmin" });
      } else {
        setStatus("error");
        setErrorMsg("Access denied. This Google account does not have admin privileges.");
      }
    } catch (err: any) {
      setStatus("error");
      if (err?.code === "auth/popup-closed-by-user") {
        setErrorMsg("Sign-in cancelled.");
      } else {
        setErrorMsg(err.message || "Login failed. Please try again.");
      }
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0D0D0D]">
        <Loader2 className="h-6 w-6 animate-spin text-[#FFD700]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0D0D0D] px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border-[3px] border-white/20 bg-white/5">
            <Shield className="h-7 w-7 text-[#FFD700]" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold uppercase tracking-[0.14em] text-white">
            Blueprint Control
          </h1>
          <p className="mt-1 font-body text-sm text-neutral-500">
            CONVERSE 2K26 · Admin Access
          </p>
        </div>

        {/* Google Admin Login */}
        <button
          onClick={handleGoogleAdminLogin}
          disabled={status === "loading"}
          className="mb-4 flex w-full items-center justify-center gap-3 rounded-lg border border-white/15 bg-white/5 px-4 py-3 font-display text-sm font-bold uppercase tracking-[0.1em] text-white transition-all hover:bg-white/10 disabled:opacity-50 cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Sign in with Google (Admin)
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10"></div>
          <span className="font-body text-[10px] uppercase tracking-[0.15em] text-neutral-600">or use email</span>
          <div className="h-px flex-1 bg-white/10"></div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
              Admin Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@converse2k26.in"
              required
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 font-mono text-sm text-white placeholder:text-neutral-600 focus:border-[#FFD700]/50 focus:outline-none focus:ring-1 focus:ring-[#FFD700]/30"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
              Access Code
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 font-mono text-sm text-white placeholder:text-neutral-600 focus:border-[#FFD700]/50 focus:outline-none focus:ring-1 focus:ring-[#FFD700]/30"
            />
          </label>

          {status === "error" && (
            <div className="rounded-lg border border-[#C91A09]/30 bg-[#C91A09]/10 px-4 py-2.5 font-body text-xs text-[#FF6B6B]">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-[#FFD700] px-4 py-3 font-display text-sm font-bold uppercase tracking-[0.1em] text-[#0D0D0D] transition-all hover:bg-[#FFE55C] disabled:opacity-50"
          >
            {status === "loading" ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Authenticating…</>
            ) : (
              <>Enter Blueprint Control <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/dashboard"
            className="font-body text-xs text-neutral-600 underline underline-offset-4 hover:text-neutral-400"
          >
            ← Back to site
          </a>
        </div>

        <p className="mt-8 text-center font-mono text-[10px] text-neutral-700">
          Authorized personnel only · CONVERSE 2K26
        </p>
      </div>
    </div>
  );
}


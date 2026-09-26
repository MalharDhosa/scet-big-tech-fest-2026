import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth, signOut, getFreshUserData } from "@/lib/firebase-auth";
import { validateQrToken, checkInParticipant, type Registration } from "@/lib/firebase-registrations";
import { useFirestoreEvents } from "@/lib/firebase-events";
import { FEST_EVENTS } from "@/lib/fest-state";
import { Shield, Camera, X, LogOut, Keyboard, ArrowLeft, AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";

export const Route = createFileRoute("/admin/scanner")({
  head: () => ({
    meta: [
      { title: "Gate Scanner — CONVERSE 2K26" },
      { name: "description", content: "QR code scanner for event check-in at CONVERSE 2K26 gates." },
    ],
  }),
  component: ScannerPage,
});

type ScanResult = {
  type: "success" | "already" | "invalid" | "wrong-event";
  registration?: Registration;
  message: string;
  detail?: string;
};

function ScannerPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { events: fsEvents } = useFirestoreEvents();

  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [processing, setProcessing] = useState(false);
  const scannerRef = useRef<any>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const scanGateRef = useRef(false);

  // Route guard
  useEffect(() => {
    if (!authLoading && (!user || (user.role !== "sub-admin" && user.role !== "master"))) {
      navigate({ to: "/admin" });
    }
  }, [user, authLoading, navigate]);

  // Fix viewport height on all devices (iOS Safari, Android Chrome, etc.)
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);
    return () => window.removeEventListener("resize", setVh);
  }, []);

  // Resolve the event name for the sub-admin's assigned event
  const assignedEvent = useMemo(() => {
    if (!user?.assignedEventId) return null;
    return fsEvents.find((e) => e.id === user.assignedEventId) || FEST_EVENTS.find((e) => e.id === user.assignedEventId) || null;
  }, [user?.assignedEventId, fsEvents]);

  // Helper: resolve event name from ID
  const getEventName = (eventId: string) => {
    const ev = fsEvents.find((e) => e.id === eventId) || FEST_EVENTS.find((e) => e.id === eventId);
    return ev ? ev.title : eventId;
  };

  const processToken = useCallback(async (token: string) => {
    if (processing || !user || scanGateRef.current) return;
    scanGateRef.current = true;
    setProcessing(true);
    try {
      // ─── STEP 1: Validate the token — find registration ───
      const reg = await validateQrToken(token.trim());
      if (!reg) {
        setScanResult({
          type: "invalid",
          message: "INVALID PASS",
          detail: "No matching registration found for this QR code or entry code. It may be fake or expired.",
        });
        triggerHaptic("error");
        setProcessing(false);
        return;
      }

      // ─── STEP 2: Check if already checked in ───
      if (reg.checkedIn) {
        const checkedInTime = reg.checkedInAt?.toDate?.()
          ? reg.checkedInAt.toDate().toLocaleString()
          : "Unknown time";
        const checkedInBy = reg.checkedInByName || "Unknown scanner";
        setScanResult({
          type: "already",
          registration: reg,
          message: "QR CODE ALREADY USED",
          detail: `This pass was already scanned at ${checkedInTime} by ${checkedInBy}. The QR code has been consumed and cannot be used again.`,
        });
        triggerHaptic("error");
        setProcessing(false);
        return;
      }

      // ─── STEP 3: If sub-admin, FRESH-READ scanner's current assignment from Firestore ───
      let scannerAssignedEventId: string | undefined = undefined;
      let scannerName = user.name;

      if (user.role === "sub-admin") {
        const freshData = await getFreshUserData(user.uid);
        if (!freshData || freshData.role !== "sub-admin") {
          setScanResult({
            type: "invalid",
            message: "ACCESS REVOKED",
            detail: "Your sub-admin access has been revoked. Please contact the master admin.",
          });
          triggerHaptic("error");
          setProcessing(false);
          return;
        }
        scannerAssignedEventId = freshData.assignedEventId;
        scannerName = freshData.name;

        // ─── STEP 4: Verify event assignment ───
        if (scannerAssignedEventId && reg.eventId !== scannerAssignedEventId) {
          setScanResult({
            type: "wrong-event",
            registration: reg,
            message: "WRONG EVENT",
            detail: `This pass is for "${getEventName(reg.eventId)}", but you are assigned to scan for "${getEventName(scannerAssignedEventId)}". You cannot check in participants for other events.`,
          });
          triggerHaptic("error");
          setProcessing(false);
          return;
        }
      }

      // ─── STEP 5: Perform the check-in with audit trail ───
      try {
        await checkInParticipant(reg.id, {
          uid: user.uid,
          name: scannerName,
          assignedEventId: scannerAssignedEventId,
        });
      } catch (err: any) {
        // Handle race conditions caught by the hardened checkInParticipant
        if (err.message === "ALREADY_CHECKED_IN") {
          setScanResult({
            type: "already",
            registration: reg,
            message: "QR CODE ALREADY USED",
            detail: "Another scanner just checked in this participant moments ago. The QR code has been consumed.",
          });
        } else if (err.message === "EVENT_MISMATCH") {
          setScanResult({
            type: "wrong-event",
            registration: reg,
            message: "WRONG EVENT",
            detail: "Server-side verification failed: event assignment mismatch.",
          });
        } else {
          throw err;
        }
        triggerHaptic("error");
        setProcessing(false);
        return;
      }

      // ─── STEP 6: SUCCESS ───
      setScanResult({
        type: "success",
        registration: reg,
        message: "ACCESS GRANTED",
        detail: `${reg.userName} has been checked in for "${getEventName(reg.eventId)}". This QR code is now consumed and will not work again.`,
      });
      triggerHaptic("success");
    } catch (err) {
      console.error("Scan error:", err);
      setScanResult({
        type: "invalid",
        message: "SCAN ERROR",
        detail: "An unexpected error occurred. Please try scanning again.",
      });
      triggerHaptic("error");
    }
    setProcessing(false);
  }, [processing, user]);

  // Initialize camera scanner
  const startScanner = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      // iOS Safari requires camera permission request within a direct user gesture.
      // Request permission FIRST so the browser prompt fires immediately.
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        // Release the test stream immediately — html5-qrcode will request its own
        testStream.getTracks().forEach((t) => t.stop());
      } catch (permErr: any) {
        console.error("Camera permission denied:", permErr);
        alert(
          "Camera access was denied. Please allow camera permissions in your browser settings and try again."
        );
        setManualMode(true);
        return;
      }

      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-scanner-region");
      scannerRef.current = scanner;
      scanGateRef.current = false;

      // Calculate qrbox dynamically — fill 90% of the container
      const containerWidth = videoRef.current.clientWidth || 300;
      const qrboxSize = Math.floor(containerWidth * 0.9);

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: { width: qrboxSize, height: qrboxSize },
          aspectRatio: 1,
          disableFlip: false,
        } as any,
        (decodedText) => {
          // Don't stop the camera — just gate further scans until result is dismissed
          if (scanGateRef.current) return;
          processToken(decodedText);
        },
        () => {} // ignore failures
      );
      setScanning(true);
    } catch (err: any) {
      console.error("Camera error:", err);
      alert(
        `Could not start camera: ${err?.message || "Unknown error"}. Switching to manual entry mode.`
      );
      setManualMode(true);
    }
  }, [processToken]);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().catch(() => {});
      } catch { /* ignore */ }
      scannerRef.current = null;
    }
    // Safety: also kill any lingering video tracks the browser may hold
    try {
      const videoEl = document.querySelector("#qr-scanner-region video") as HTMLVideoElement | null;
      if (videoEl?.srcObject) {
        (videoEl.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        videoEl.srcObject = null;
      }
    } catch { /* ignore */ }
    setScanning(false);
    scanGateRef.current = false;
  }, []);

  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  const triggerHaptic = (type: "success" | "error") => {
    if ("vibrate" in navigator) {
      navigator.vibrate(type === "success" ? [100, 50, 100] : [200, 100, 200, 100, 200]);
    }
  };

  const resetScan = () => {
    setScanResult(null);
    setManualToken("");
    scanGateRef.current = false;
  };

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center bg-[#0D0D0D] font-display text-sm uppercase tracking-widest text-neutral-500">Loading…</div>;
  }
  if (!user || (user.role !== "sub-admin" && user.role !== "master")) return null;

  // Determine which colors to use for the result type
  const resultColors = {
    success: { border: "border-green-500", bg: "bg-green-500/10", icon: "bg-green-500/20 text-green-400", iconChar: <CheckCircle2 className="h-10 w-10" /> },
    already: { border: "border-amber-500", bg: "bg-amber-500/10", icon: "bg-amber-500/20 text-amber-400", iconChar: <RefreshCw className="h-10 w-10" /> },
    invalid: { border: "border-[#C91A09]", bg: "bg-[#C91A09]/10", icon: "bg-[#C91A09]/20 text-[#C91A09]", iconChar: <XCircle className="h-10 w-10" /> },
    "wrong-event": { border: "border-orange-500", bg: "bg-orange-500/10", icon: "bg-orange-500/20 text-orange-400", iconChar: <AlertTriangle className="h-10 w-10" /> },
  };

  const handleLogout = async () => {
    stopScanner();
    try {
      await signOut();
      window.location.href = "/";
    } catch (err) {
      console.error("Logout error:", err);
      window.location.href = "/";
    }
  };

  return (
    <div className="flex flex-col bg-[#0D0D0D] text-white overflow-hidden" style={{ height: "100dvh", height: "calc(var(--vh, 1vh) * 100)", maxHeight: "-webkit-fill-available" } as any}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#FFD700]" />
          <span className="font-display text-xs font-bold uppercase tracking-[0.15em]">Gate Scanner</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { stopScanner(); navigate({ to: user.role === "master" ? "/admin/master" : "/admin/subadmin" }); }} className="flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider text-white hover:bg-white/20 transition-colors">
            <ArrowLeft className="h-3 w-3" /> Back
          </button>
          <span className="font-mono text-[10px] text-neutral-500 hidden sm:inline">{user.name}</span>
          <button onClick={handleLogout} className="text-neutral-500 hover:text-[#C91A09] transition-colors cursor-pointer" title="Log out"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      {/* Event Assignment Banner */}
      {user.role === "sub-admin" && (
        <div className="flex items-center justify-center gap-2 bg-[#FFD700]/10 border-b border-[#FFD700]/20 px-4 py-2">
          <Shield className="h-3.5 w-3.5 text-[#FFD700]" />
          <span className="font-display text-[11px] font-bold uppercase tracking-wider text-[#FFD700]">
            Scanning for: {assignedEvent ? assignedEvent.title : user.assignedEventId || "Unassigned"}
          </span>
        </div>
      )}
      {user.role === "master" && (
        <div className="flex items-center justify-center gap-2 bg-blue-500/10 border-b border-blue-500/20 px-4 py-2">
          <Shield className="h-3.5 w-3.5 text-blue-400" />
          <span className="font-display text-[11px] font-bold uppercase tracking-wider text-blue-400">
            Master Admin — Can scan all events
          </span>
        </div>
      )}

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Camera is always visible when not in manual mode */}
        {!manualMode && (
          <div className="relative flex flex-1 flex-col">
            {/* Camera fills ALL available space */}
            <div
              id="qr-scanner-region"
              ref={videoRef}
              className="flex-1 w-full min-h-0 overflow-hidden bg-black"
            />

            {/* ── Result Overlay — appears on top of camera feed ── */}
            {scanResult && (() => {
              const colors = resultColors[scanResult.type];
              return (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/85 backdrop-blur-sm">
                  <div className={`w-full mx-3 rounded-2xl border-[3px] p-6 text-center transition-all ${colors.border} ${colors.bg}`}>
                    {/* Status Icon */}
                    <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full ${colors.icon}`}>
                      {colors.iconChar}
                    </div>

                    <h2 className="font-display text-lg font-black uppercase tracking-wide">
                      {scanResult.message}
                    </h2>

                    {scanResult.detail && (
                      <p className="mt-2 font-body text-xs leading-relaxed text-neutral-400">
                        {scanResult.detail}
                      </p>
                    )}

                    {scanResult.registration && (
                      <div className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-left space-y-1.5">
                        <p className="font-display text-sm font-bold text-white">{scanResult.registration.userName}</p>
                        <p className="font-mono text-xs text-neutral-400">{scanResult.registration.userEmail}</p>
                        <p className="font-mono text-xs text-neutral-400">Event: {getEventName(scanResult.registration.eventId)}</p>
                        <p className="font-mono text-xs text-neutral-400">Dept: {scanResult.registration.userDept}</p>
                        
                        {/* Entry Code Display */}
                        <div className="mt-2 pt-2 border-t border-white/10 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Entry Code</p>
                          <p className="font-mono text-lg font-black tracking-[0.2em] text-[#FFD700]">{scanResult.registration.entryCode}</p>
                        </div>

                        {/* Team Members Display */}
                        {scanResult.registration.teammates && scanResult.registration.teammates.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/10">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                              Team: {scanResult.registration.teamName || `${scanResult.registration.userName}'s Team`}
                              <span className="ml-2 text-[#FFD700]">({1 + scanResult.registration.teammates.length} members)</span>
                            </p>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between rounded bg-white/5 px-2 py-1">
                                <span className="text-xs text-white font-semibold">• {scanResult.registration.userName}</span>
                                <span className="text-[9px] bg-[#FFD700]/20 text-[#FFD700] font-bold px-1.5 py-0.5 rounded uppercase">Leader</span>
                              </div>
                              {scanResult.registration.teammates.map((tm: any, i: number) => (
                                <div key={i} className="flex items-center justify-between px-2 py-1">
                                  <span className="text-xs text-neutral-300">• {tm.name}</span>
                                  <span className="text-[9px] text-neutral-500">{tm.email}</span>
                                </div>
                              ))}
                            </div>
                            {scanResult.type === "success" && (
                              <p className="mt-2 text-[10px] text-green-400 font-bold uppercase tracking-wider">
                                ✓ All {1 + scanResult.registration.teammates.length} team members checked in
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <button onClick={resetScan} className="mt-4 w-full rounded-lg bg-white/10 px-4 py-3 font-display text-sm font-bold uppercase tracking-wider text-white hover:bg-white/20 transition-colors">
                      ✓ Scan Next
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Buttons pinned at bottom */}
            <div className="flex-shrink-0 flex gap-2 p-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
              {!scanning ? (
                <button onClick={startScanner} className="flex-1 rounded-lg bg-[#0055BF] px-4 py-3 font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-[#003399]">
                  <Camera className="mr-1 inline h-3.5 w-3.5" /> Start Camera
                </button>
              ) : (
                <button onClick={stopScanner} className="flex-1 rounded-lg bg-[#C91A09] px-4 py-3 font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-[#A31407]">
                  <X className="mr-1 inline h-3.5 w-3.5" /> Stop
                </button>
              )}
              <button onClick={() => { stopScanner(); setManualMode(true); }} className="rounded-lg bg-white/10 px-4 py-3 font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-white/20">
                <Keyboard className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Manual Token Entry ── */}
        {manualMode && (
          <div className="w-full max-w-sm">
            <h2 className="mb-4 text-center font-display text-lg font-bold uppercase tracking-wider">Manual Token Entry</h2>
            <input
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste QR token or entry code..."
              className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 font-mono text-sm text-white placeholder:text-neutral-600"
              autoFocus
            />

            {/* Manual mode result */}
            {scanResult && (() => {
              const colors = resultColors[scanResult.type];
              return (
                <div className={`mt-4 w-full rounded-2xl border-[3px] p-6 text-center ${colors.border} ${colors.bg}`}>
                  <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full ${colors.icon}`}>
                    {colors.iconChar}
                  </div>
                  <h2 className="font-display text-lg font-black uppercase tracking-wide">{scanResult.message}</h2>
                  {scanResult.detail && <p className="mt-2 font-body text-xs leading-relaxed text-neutral-400">{scanResult.detail}</p>}
                  {scanResult.registration && (
                    <div className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-left">
                      <p className="font-display text-sm font-bold text-white">{scanResult.registration.userName}</p>
                      <p className="font-mono text-xs text-neutral-400">{scanResult.registration.userEmail}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="mt-3 flex gap-2">
              <button onClick={() => { setManualMode(false); resetScan(); }} className="flex-1 rounded-lg bg-white/10 px-4 py-3 font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-white/20">
                <Camera className="mr-1 inline h-3.5 w-3.5" /> Camera
              </button>
              <button
                onClick={() => { resetScan(); manualToken && processToken(manualToken); }}
                disabled={!manualToken || processing}
                className="flex-1 rounded-lg bg-[#0055BF] px-4 py-3 font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-[#003399] disabled:opacity-50"
              >
                {processing ? "Validating…" : "Validate"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

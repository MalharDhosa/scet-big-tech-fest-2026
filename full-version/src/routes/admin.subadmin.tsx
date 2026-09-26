import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth, signOut, getFreshUserData } from "@/lib/firebase-auth";
import { useFirestoreEvents } from "@/lib/firebase-events";
import { FEST_EVENTS, type FestEvent } from "@/lib/fest-state";
import {
  useAllRegistrations,
  doesRegistrationMatchEvent,
  checkInParticipant,
  type Registration,
} from "@/lib/firebase-registrations";
import {
  Shield,
  Download,
  LogOut,
  QrCode,
  Users,
  Search,
  CheckCircle2,
  Clock,
  Calendar,
  MapPin,
  X,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  FileSpreadsheet,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/subadmin")({
  head: () => ({
    meta: [
      { title: "Coordinator Portal — CONVERSE 2K26" },
      { name: "description", content: "Event coordinator portal and attendee check-in management." },
    ],
  }),
  component: SubAdminPortal,
  errorComponent: ({ error, reset }) => {
    console.error("SubAdmin Portal error:", error);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4 text-white font-sans">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Shield className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Coordinator Portal Encountered an Issue
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {error?.message || "An unexpected error occurred while loading your portal."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                reset();
                window.location.reload();
              }}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-700 transition-colors shadow-md cursor-pointer"
            >
              Reload Portal
            </button>
            <a
              href="/admin"
              className="rounded-lg border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Admin Gateway
            </a>
          </div>
        </div>
      </div>
    );
  },
});

function SubAdminPortal() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { events: fsEvents, loading: eventsLoading } = useFirestoreEvents();
  const { registrations, loading: regsLoading } = useAllRegistrations();

  // Fresh user state for immediate assignment updates
  const [assignedEventId, setAssignedEventId] = useState<string>("");
  const [freshLoading, setFreshLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Checked-In" | "Pending">("All");
  const [deptFilter, setDeptFilter] = useState("All");

  // Checking in state
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  // Route guard
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate({ to: "/admin" });
      } else if (user.role !== "sub-admin" && user.role !== "master") {
        navigate({ to: "/dashboard" });
      }
    }
  }, [user, authLoading, navigate]);

  // Fetch fresh user data to verify assignedEventId
  useEffect(() => {
    let isMounted = true;
    async function fetchFresh() {
      if (!user?.uid) return;
      try {
        const fresh = await getFreshUserData(user.uid);
        if (isMounted) {
          setAssignedEventId(fresh?.assignedEventId || user.assignedEventId || "");
          setFreshLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setAssignedEventId(user.assignedEventId || "");
          setFreshLoading(false);
        }
      }
    }
    fetchFresh();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Merge Firestore events and static FEST_EVENTS
  const allEvents = useMemo(() => {
    const list = FEST_EVENTS.map((fe) => {
      const fsEvent = fsEvents.find((e) => e.id === fe.id);
      if (!fsEvent) return fe;
      return { ...fe, ...(fsEvent as any) } as FestEvent;
    });

    fsEvents.forEach((fsEvent) => {
      if (!list.some((e) => e.id === fsEvent.id)) {
        list.push(fsEvent as FestEvent);
      }
    });

    return list;
  }, [fsEvents]);

  // Resolve the assigned event object
  const assignedEvent = useMemo(() => {
    if (!assignedEventId) return null;
    return allEvents.find((e) => e.id === assignedEventId) || null;
  }, [allEvents, assignedEventId]);

  // STRICT FILTERING: Only registrations that belong to this assigned event!
  const eventRegistrations = useMemo(() => {
    if (!assignedEventId) return [];

    return registrations.filter((r) => {
      if (assignedEvent) {
        return doesRegistrationMatchEvent(r, assignedEvent) || r.eventId === assignedEventId;
      }
      return r.eventId === assignedEventId;
    });
  }, [registrations, assignedEventId, assignedEvent]);

  // Department options from current event registrations
  const deptOptions = useMemo(() => {
    const depts = new Set<string>();
    eventRegistrations.forEach((r) => {
      if (r.userDept) depts.add(r.userDept);
    });
    return ["All", ...Array.from(depts).sort()];
  }, [eventRegistrations]);

  // Filtered registrations based on sub-admin query
  const filteredRegs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return eventRegistrations.filter((r) => {
      // 1. Status filter
      if (statusFilter === "Checked-In" && !r.checkedIn) return false;
      if (statusFilter === "Pending" && r.checkedIn) return false;

      // 2. Department filter
      if (deptFilter !== "All" && r.userDept !== deptFilter) return false;

      // 3. Search query
      if (q) {
        const name = (r.userName || "").toLowerCase();
        const email = (r.userEmail || "").toLowerCase();
        const leaderEmail = (r.leaderEmail || "").toLowerCase();
        const leaderName = (r.leaderName || "").toLowerCase();
        const phone = (r.userPhone || "").toLowerCase();
        const entryCode = (r.entryCode || "").toLowerCase();
        const teamName = (r.teamName || "").toLowerCase();
        const partnerName = (r.partnerName || "").toLowerCase();
        const memberEmails = (r.teamMemberEmails || []).map((e) => e.toLowerCase()).join(" ");
        const teammates = (r.teammates || [])
          .map((t: any) => `${t.name || ""} ${t.email || ""} ${t.phone || ""}`)
          .join(" ")
          .toLowerCase();

        const haystack = `${name} ${email} ${leaderEmail} ${leaderName} ${phone} ${entryCode} ${teamName} ${partnerName} ${memberEmails} ${teammates}`;
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [eventRegistrations, statusFilter, deptFilter, searchQuery]);

  // Stats calculation
  const totalCount = eventRegistrations.length;
  const checkedInCount = useMemo(() => eventRegistrations.filter((r) => r.checkedIn).length, [eventRegistrations]);
  const pendingCount = totalCount - checkedInCount;

  // Export CSV for this assigned event strictly
  const exportCsv = useCallback(async () => {
    if (filteredRegs.length === 0) {
      alert("No registrations to export.");
      return;
    }

    // Fetch users to backfill any missing enrollment numbers in old registrations
    let userEnrollments: Record<string, string> = {};
    try {
      const { getDocs, collection } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      const usersSnap = await getDocs(collection(db, "users"));
      usersSnap.forEach((doc) => {
        const data = doc.data();
        if (data.enrollmentNumber) {
          userEnrollments[doc.id] = data.enrollmentNumber;
        }
      });
    } catch (e) {
      console.warn("Could not fetch user enrollments for CSV backfill:", e);
    }

    const eventTitleDisplay = assignedEvent ? assignedEvent.title : (assignedEventId || "Assigned Event");
    const exportTimeStr = new Date().toLocaleString("en-IN", { dateStyle: "full", timeStyle: "medium" });

    const head = [
      "Sr No",
      "Participant / Leader Name",
      "Email",
      "Phone",
      "Department",
      "Enrollment No",
      "Event Name",
      "Team Name",
      "Teammates",
      "Entry Code",
      "Status",
      "Participant Signature",
    ];

    const dataRows = filteredRegs.map((r, idx) => {
      const teammatesStr = r.teammates && r.teammates.length > 0
        ? `Leader: ${r.leaderName || r.userName} (${r.leaderEmail || r.userEmail}); Members: ` +
          r.teammates.map((t: any) => `${t.name} (${t.email})`).join("; ")
        : (r.partnerName || "Solo");

      return [
        (idx + 1).toString(),
        r.userName || "",
        r.userEmail || "",
        r.userPhone || "",
        r.userDept || "",
        r.enrollmentNumber || userEnrollments[r.userId] || "",
        eventTitleDisplay,
        r.teamName || (r.teammates && r.teammates.length > 0 ? `${r.userName}'s Team` : "Solo"),
        teammatesStr,
        r.entryCode || "—",
        r.checkedIn ? "Checked In" : "Pending",
        "", // Participant signature blank for signing
      ];
    });

    // Verification & Sign-off Section at the bottom of the CSV
    const totalRegistrations = filteredRegs.length;
    const checkedInCount = filteredRegs.filter((r) => r.checkedIn).length;
    const pendingCount = totalRegistrations - checkedInCount;

    // Coordinators info
    const coord1 = assignedEvent?.coordinators?.[0] || { name: "", phone: "" };
    const coord2 = assignedEvent?.coordinators?.[1] || { name: "", phone: "" };
    const faculty1 = assignedEvent?.facultyCoordinators?.[0] || { name: "", phone: "" };

    const footerRows = [
      [],
      ["---", "---", "---", "---", "---", "---", "---", "---", "---", "---", "---", "---"],
      ["CONVERSE 2K26 — EVENT ATTENDANCE & VERIFICATION SIGN-OFF SHEET"],
      ["Event Name:", eventTitleDisplay, "", "Total Registrations:", totalRegistrations.toString()],
      ["Generated On:", exportTimeStr, "", "Checked In Count:", checkedInCount.toString(), "", "Pending Count:", pendingCount.toString()],
      [],
      ["OFFICIAL VERIFICATION & APPROVAL SIGNATURES"],
      ["Role", "Designated Person Name", "Contact Number", "Physical Signature", "Date & Official Stamp"],
      ["Student Coordinator 1", coord1.name || "___________________________", coord1.phone || "___________________________", "___________________________", "___________________________"],
      ["Student Coordinator 2", coord2.name || "___________________________", coord2.phone || "___________________________", "___________________________", "___________________________"],
      ["Faculty Coordinator", faculty1.name || "___________________________", faculty1.phone || "___________________________", "___________________________", "___________________________"],
      ["Department Convener / HOD", "___________________________", "___________________________", "___________________________", "___________________________"],
    ];

    const allRows = [head, ...dataRows, ...footerRows];
    const csv = allRows
      .map((row) => row.map((v) => `"${(v || "").toString().replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeTitle = (assignedEvent?.title || assignedEventId || "event")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    a.download = `${safeTitle}-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRegs, assignedEvent, assignedEventId]);

  // Quick manual check-in action
  const handleQuickCheckIn = async (reg: Registration) => {
    if (!user) return;
    if (reg.checkedIn) return;

    if (
      !confirm(
        `Check in participant "${reg.userName}" for ${assignedEvent?.title || assignedEventId}?`
      )
    ) {
      return;
    }

    setCheckingInId(reg.id);
    try {
      await checkInParticipant(reg.id, {
        uid: user.uid,
        name: user.name || "Coordinator",
        assignedEventId,
      });
    } catch (err: any) {
      console.error("Check-in failed:", err);
      alert("Check-in failed: " + (err.message || "Unknown error"));
    } finally {
      setCheckingInId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      window.location.href = "/";
    } catch (err) {
      console.error("Logout error:", err);
      window.location.href = "/";
    }
  };

  if (authLoading || freshLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-3 font-sans">
        <div className="w-9 h-9 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
          Loading Coordinator Portal...
        </p>
      </div>
    );
  }

  if (!user || (user.role !== "sub-admin" && user.role !== "master")) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* ─── Top Header Bar ─── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  CONVERSE 2K26
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Coordinator
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate hidden sm:block">
                Sub-Admin Portal · Attendee Check-In
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Camera Scanner Shortcut */}
            <Link
              to="/admin/scanner"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs font-bold transition-colors shadow-sm"
              title="Open Gate QR Scanner"
            >
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">Camera Scanner</span>
            </Link>

            {/* Coordinator Info */}
            <div className="text-right hidden md:block border-l border-slate-200 pl-3">
              <p className="text-xs font-semibold text-slate-800">{user.name}</p>
              <p className="text-[11px] font-mono text-slate-400">{user.email}</p>
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ─── Assigned Event Banner ─── */}
        {!assignedEventId ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800 flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-base">No Event Assigned</h3>
              <p className="text-sm mt-1 text-amber-700">
                Your account is registered as a Sub-Admin, but you have not yet been assigned to a specific festival event.
                Please contact the Master Admin to assign your event.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800 uppercase tracking-wider">
                    {assignedEvent?.track || "TECH"} TRACK
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {assignedEvent?.format || "Individual"}
                  </span>
                  {assignedEvent?.number && (
                    <span className="inline-flex items-center rounded-md bg-amber-100 px-2.5 py-1 text-xs font-mono font-bold text-amber-900">
                      {assignedEvent.number}
                    </span>
                  )}
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2.5 tracking-tight">
                  {assignedEvent?.title || assignedEventId}
                </h2>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                  {assignedEvent?.venue && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {assignedEvent.venue}
                    </span>
                  )}
                  {assignedEvent?.time && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {assignedEvent.time}
                    </span>
                  )}
                  <span className="font-mono text-slate-400">
                    Event ID: <strong>{assignedEventId}</strong>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                >
                  <Download className="h-4 w-4" /> Export CSV ({filteredRegs.length})
                </button>
                <Link
                  to="/admin/scanner"
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 px-5 py-3 text-xs font-extrabold uppercase tracking-wider shadow-sm transition-all"
                >
                  <QrCode className="h-4 w-4" /> Open Scanner →
                </Link>
              </div>
            </div>

            {/* ─── Metric Cards ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-100">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Total Registrations
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Assigned to this event</p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Checked In
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-green-600 mt-1">{checkedInCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {totalCount > 0 ? `${Math.round((checkedInCount / totalCount) * 100)}% attendance` : "0% attendance"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Pending Check-Ins
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Awaiting gate scan</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Search & Filters Bar ─── */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            {/* Search Input */}
            <div className="flex-1 min-w-[240px]">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                Search Participants
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, phone, entry code, or teammates..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-8 py-2 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter */}
            <div className="min-w-[140px]">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="All">All Statuses</option>
                <option value="Checked-In">Checked In</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            {/* Department Filter */}
            {deptOptions.length > 2 && (
              <div className="min-w-[140px]">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Department
                </label>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  {deptOptions.map((d) => (
                    <option key={d} value={d}>
                      {d === "All" ? "All Departments" : d}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="ml-auto flex items-end">
              <span className="text-sm font-medium text-slate-500 pb-2">
                Showing <strong className="text-slate-800">{filteredRegs.length}</strong> of {totalCount}
              </span>
            </div>
          </div>
        </div>

        {/* ─── Registrations Table ─── */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {regsLoading ? (
            <div className="flex h-48 items-center justify-center text-slate-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Loading attendee records...
            </div>
          ) : filteredRegs.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <Users className="h-6 w-6" />
              </div>
              <h4 className="text-base font-semibold text-slate-800">No Registrations Found</h4>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery || statusFilter !== "All" || deptFilter !== "All"
                  ? "No participants match your active filters or search query."
                  : `No attendees have registered for ${assignedEvent?.title || assignedEventId} yet.`}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-4 inline-flex items-center text-xs font-semibold text-blue-600 hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
                  <tr>
                    <th className="px-6 py-4">Participant / Leader</th>
                    <th className="px-6 py-4">Contact Info</th>
                    <th className="px-6 py-4">Dept</th>
                    <th className="px-6 py-4">Team / Members</th>
                    <th className="px-6 py-4">Entry Code</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Gate Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredRegs.map((r) => {
                    const isCheckingIn = checkingInId === r.id;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Name & Avatar */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-blue-600/10 text-blue-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {r.userName?.charAt(0) || "U"}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{r.userName}</p>
                              {r.leaderName && r.leaderName !== r.userName && (
                                <p className="text-[11px] text-amber-700 font-medium">
                                  👑 Leader: {r.leaderName}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-6 py-4">
                          <p className="text-slate-800 text-xs font-medium">{r.userEmail}</p>
                          <p className="text-slate-400 text-[11px] mt-0.5">{r.userPhone || "—"}</p>
                        </td>

                        {/* Dept */}
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider",
                              r.userDept === "IT"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-blue-100 text-blue-900"
                            )}
                          >
                            {r.userDept || "—"}
                          </span>
                        </td>

                        {/* Team */}
                        <td className="px-6 py-4">
                          {r.teammates && r.teammates.length > 0 ? (
                            <div>
                              <span className="font-semibold text-slate-900 text-xs block">
                                {r.teamName || "Team"} ({1 + r.teammates.length} Members)
                              </span>
                              <span
                                className="text-[11px] text-slate-500 truncate max-w-xs block"
                                title={`Leader: ${r.leaderName || r.userName} (${r.leaderEmail || r.userEmail}); Teammates: ` +
                                  r.teammates.map((t: any) => `${t.name} (${t.email})`).join(", ")}
                              >
                                {r.teammates.map((t: any) => t.name).join(", ")}
                              </span>
                            </div>
                          ) : r.partnerName ? (
                            <span className="text-xs text-slate-700 font-medium">
                              {r.partnerName}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Solo Participant</span>
                          )}
                        </td>

                        {/* Entry Code */}
                        <td className="px-6 py-4">
                          {r.isNonTech || !r.entryCode ? (
                            <span className="font-mono text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-300">
                              No Pass (Fun Event)
                            </span>
                          ) : (
                            <span className="font-mono text-xs font-bold tracking-widest text-slate-800 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                              {r.entryCode}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          {r.isNonTech ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                              <Sparkles className="h-3.5 w-3.5 text-amber-600" /> Registered (Fun)
                            </span>
                          ) : r.checkedIn ? (
                            <div>
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Checked In
                              </span>
                              {r.checkedInAt?.toDate && (
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {r.checkedInAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                              <Clock className="h-3.5 w-3.5 text-slate-400" /> Pending
                            </span>
                          )}
                        </td>

                        {/* Gate Action */}
                        <td className="px-6 py-4 text-right">
                          {r.isNonTech ? (
                            <span className="text-xs font-semibold text-amber-700 inline-flex items-center gap-1">
                              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Fun Event
                            </span>
                          ) : r.checkedIn ? (
                            <span className="text-xs font-semibold text-green-700 inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Admitted
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isCheckingIn}
                              onClick={() => handleQuickCheckIn(r)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                              {isCheckingIn ? "Checking In..." : "Manual Check In"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import {
  X,
  Users,
  Search,
  UserCheck,
  UserX,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import type { FestEvent } from "@/lib/fest-state";
import type { AuthUser } from "@/lib/firebase-auth";
import {
  parseEventTeamSize,
  registerForEvent,
  type Teammate
} from "@/lib/firebase-registrations";
import {
  searchOnboardedUsers,
  verifyCandidateAvailability,
  type OnboardedCandidate
} from "@/lib/firebase-user-search";
import { cn } from "@/lib/utils";

type TeamRegistrationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  event: FestEvent;
  currentUser: AuthUser;
  onSuccess: (regData: { registrationId: string; qrToken: string; entryCode: string }) => void;
};

export function TeamRegistrationModal({
  isOpen,
  onClose,
  event,
  currentUser,
  onSuccess,
}: TeamRegistrationModalProps) {
  const teamSize = parseEventTeamSize(event.format);
  const minTeammates = Math.max(0, teamSize.min - 1);
  const maxTeammates = Math.max(0, teamSize.max - 1);

  const [teamName, setTeamName] = useState(`${currentUser.name || "My"}'s Team`);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OnboardedCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [availabilityMap, setAvailabilityMap] = useState<
    Record<string, { checking: boolean; available: boolean; reason?: string | undefined }>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const searchTimeoutRef = useRef<any>(null);

  const totalMembers = 1 + teammates.length;
  const isTeamFull = totalMembers >= teamSize.max;
  const hasMetMinimum = totalMembers >= teamSize.min;
  const neededToMinimum = Math.max(0, teamSize.min - totalMembers);

  // Debounced search for onboarded accounts only
  useEffect(() => {
    if (!isOpen) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const excludeUids = teammates.map((t) => t.uid);
      const candidates = await searchOnboardedUsers(trimmed, currentUser.uid, excludeUids);
      setSearchResults(candidates);
      setIsSearching(false);

      // Verify availability for each candidate in this event
      candidates.forEach(async (cand) => {
        setAvailabilityMap((prev) => ({
          ...prev,
          [cand.uid]: { checking: true, available: false },
        }));

        const result = await verifyCandidateAvailability(event.id, cand);
        setAvailabilityMap((prev) => ({
          ...prev,
          [cand.uid]: { checking: false, available: result.available, reason: result.reason },
        }));
      });
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, teammates, event.id, currentUser.uid, isOpen]);

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setTeammates([]);
      setSearchQuery("");
      setSearchResults([]);
      setErrorMsg(null);
      setTeamName(`${currentUser.name || "My"}'s Team`);
    }
  }, [isOpen, currentUser.name]);

  if (!isOpen) return null;

  const handleAddTeammate = (candidate: OnboardedCandidate) => {
    if (isTeamFull) return;

    // Check duplicate
    if (teammates.some((t) => t.uid === candidate.uid || t.email === candidate.email)) {
      return;
    }

    const newTeammate: Teammate = {
      uid: candidate.uid,
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      dept: candidate.dept,
      enrollmentNumber: candidate.enrollmentNumber,
    };

    setTeammates((prev) => [...prev, newTeammate]);
    setSearchQuery("");
    setSearchResults([]);
    setErrorMsg(null);
  };

  const handleRemoveTeammate = (indexToRemove: number) => {
    setTeammates((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Validation 1: Check minimum team size
    if (totalMembers < teamSize.min) {
      setErrorMsg(
        `This event requires at least ${teamSize.min} participants. Please add at least ${neededToMinimum} more teammate(s).`
      );
      return;
    }

    // Validation 2: Check maximum team size
    if (totalMembers > teamSize.max) {
      setErrorMsg(
        `Team size cannot exceed ${teamSize.max} participants. Please remove ${totalMembers - teamSize.max} member(s).`
      );
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const cleanTrack = (event.track || "").replace(/ TRACK$/i, "").trim().toUpperCase();
      const isEventNonTech = cleanTrack === "NON-TECH" || cleanTrack === "NON TECH" || cleanTrack === "NONTECH" || cleanTrack.includes("NON");

      const result = await registerForEvent(currentUser.uid, event.id, {
        name: currentUser.name,
        email: currentUser.email || "",
        phone: currentUser.phone || "",
        dept: currentUser.branch || "",
        enrollmentNumber: currentUser.enrollmentNumber || "",
        teamName: teamName.trim() || `${currentUser.name}'s Team`,
        teammates,
        eventTitle: event.title,
        track: event.track,
        isNonTech: isEventNonTech,
        maxSlots: event.maxSlots,
      });

      onSuccess(result);
      onClose();
    } catch (err: any) {
      console.error("Team registration failed:", err);
      setErrorMsg(err.message || "Failed to register team. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-gradient-to-b from-[#092257] to-[#041233] text-white rounded-2xl border-2 border-white/15 shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 sm:px-6 py-4 bg-[#001d5c]/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-[#FFD700] text-[#001d5c] flex items-center justify-center shrink-0 shadow-md">
              <Users className="h-5 w-5 font-bold" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base sm:text-lg font-black uppercase tracking-wide truncate text-white">
                Team Registration: {event.title}
              </h3>
              <p className="text-xs text-[#a9b8e0] truncate font-medium">
                {event.track} Track · Format: <span className="text-[#FFD700] font-bold">{event.format}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Format Requirements Banner */}
          <div className="rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-[#FFD700]">
                Event Team Size Requirement
              </span>
              <p className="text-sm font-bold text-white mt-0.5">
                {teamSize.min === teamSize.max
                  ? `Strictly ${teamSize.min} Participants Required`
                  : `Between ${teamSize.min} and ${teamSize.max} Participants Allowed`}
              </p>
              <p className="text-xs text-[#c3cfea] mt-0.5">
                {minTeammates === 0
                  ? "You can register solo or add up to 1 teammate."
                  : `You are the team leader. You must add ${minTeammates === maxTeammates ? minTeammates : `${minTeammates} to ${maxTeammates}`} teammate(s).`}
              </p>
            </div>

            {/* Current Team Count Badge */}
            <div className="flex items-center gap-2 shrink-0 bg-[#001d5c] px-3.5 py-1.5 rounded-lg border border-white/15">
              <Users className="h-4 w-4 text-[#FFD700]" />
              <span className="font-mono text-sm font-black text-white">
                {totalMembers} / {teamSize.max}
              </span>
              <span className="text-[11px] font-semibold text-[#a9b8e0]">Members</span>
            </div>
          </div>

          {/* Team Name Input */}
          <div>
            <label className="block font-display text-xs font-bold uppercase tracking-wider text-[#a9b8e0] mb-1.5">
              Team Name (Optional)
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Code Wizards, Neural Knights"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/20 transition-all font-body"
              maxLength={40}
            />
          </div>

          {/* Team Roster: Leader + Teammates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-display text-xs font-bold uppercase tracking-wider text-[#a9b8e0]">
                Team Roster ({totalMembers} of {teamSize.max} Filled)
              </label>
              {hasMetMinimum ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" /> Valid Team Size
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  <AlertCircle className="h-3 w-3" /> Need {neededToMinimum} more teammate(s)
                </span>
              )}
            </div>

            {/* 1. Leader Item (Current User) */}
            <div className="rounded-xl border border-white/15 bg-[#001d5c]/60 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-[#FFD700]/20 border border-[#FFD700]/40 flex items-center justify-center text-[#FFD700] font-bold text-sm shrink-0">
                  {currentUser.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
                    <span className="rounded-full bg-[#FFD700] px-2 py-0.2 text-[9px] font-display font-black uppercase text-[#001d5c]">
                      Leader (You)
                    </span>
                  </div>
                  <p className="text-xs text-[#a9b8e0] truncate">
                    {currentUser.email} {currentUser.branch && `· ${currentUser.branch}`}
                  </p>
                </div>
              </div>
              <span className="text-xs text-emerald-400 font-medium px-2 py-1 bg-emerald-500/10 rounded-md border border-emerald-500/20 shrink-0">
                Confirmed
              </span>
            </div>

            {/* 2. Added Teammates */}
            {teammates.map((mate, idx) => (
              <div
                key={mate.uid}
                className="rounded-xl border border-white/15 bg-white/5 p-3.5 flex items-center justify-between gap-3 group hover:border-white/30 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 font-bold text-sm shrink-0">
                    {mate.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white truncate">{mate.name}</p>
                      <span className="rounded-full bg-blue-400/20 px-2 py-0.2 text-[9px] font-display font-bold uppercase text-blue-300 border border-blue-400/30">
                        Teammate #{idx + 1}
                      </span>
                    </div>
                    <p className="text-xs text-[#a9b8e0] truncate">
                      {mate.email} {mate.dept && `· ${mate.dept}`} {mate.enrollmentNumber && `(${mate.enrollmentNumber})`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveTeammate(idx)}
                  className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors shrink-0"
                  title="Remove teammate"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            {/* Team Members Remaining Indicator */}
            {totalMembers < teamSize.max && (
              <div className="rounded-xl border border-dashed border-white/20 p-3.5 text-center text-xs text-[#a9b8e0]">
                {neededToMinimum > 0 ? (
                  <span className="text-amber-300 font-semibold">
                    + {neededToMinimum} required teammate(s) remaining — search below to add
                  </span>
                ) : (
                  <span className="text-slate-300">
                    + Optional teammate can be added (up to {teamSize.max} participants total)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Teammate Search Section (Strictly Onboarded Registered Accounts) */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="block font-display text-xs font-bold uppercase tracking-wider text-[#FFD700]">
                Search & Add Teammates
              </label>
              <span className="text-[10px] text-[#a9b8e0] bg-white/5 px-2 py-0.5 rounded border border-white/10">
                Strictly Registered & Completed Profiles Only
              </span>
            </div>

            {isTeamFull ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-center">
                <p className="text-xs font-semibold text-emerald-300">
                  ✓ Team has reached the maximum capacity of {teamSize.max} members!
                </p>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  To replace a member, remove someone from the roster above.
                </p>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by registered email, full name, or enrollment number..."
                    className="w-full rounded-xl border border-white/15 bg-white/5 pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/20 transition-all font-body"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#FFD700] animate-spin" />
                  )}
                </div>

                {/* Dropdown Results */}
                {searchQuery.trim().length >= 2 && !isSearching && (
                  <div className="mt-2 rounded-xl border border-white/20 bg-[#001d5c] shadow-2xl overflow-hidden divide-y divide-white/10 max-h-56 overflow-y-auto">
                    {searchResults.length === 0 ? (
                      <div className="p-4 text-center">
                        <UserX className="h-6 w-6 text-white/30 mx-auto mb-1.5" />
                        <p className="text-xs font-semibold text-white">No verified registered participants found</p>
                        <p className="text-[11px] text-[#a9b8e0] mt-1 max-w-sm mx-auto">
                          Teammates must have an active account AND must have completed their profile details form (Step 01 Onboarding).
                        </p>
                      </div>
                    ) : (
                      searchResults.map((cand) => {
                        const status = availabilityMap[cand.uid] || { checking: true, available: false };
                        const isAvailable = status.available;

                        return (
                          <div
                            key={cand.uid}
                            className="p-3 hover:bg-white/5 transition-colors flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-white truncate">{cand.name}</p>
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                                  <ShieldCheck className="h-3 w-3" /> Profile Completed
                                </span>
                              </div>
                              <p className="text-xs text-[#a9b8e0] truncate mt-0.5">
                                {cand.email} {cand.dept && `· ${cand.dept}`} {cand.enrollmentNumber && `· (${cand.enrollmentNumber})`}
                              </p>

                              {/* Already registered warning */}
                              {!status.checking && !isAvailable && (
                                <p className="text-[10px] font-bold text-rose-400 mt-1 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                  Already registered in this event with another team!
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAddTeammate(cand)}
                              disabled={status.checking || !isAvailable || isTeamFull}
                              className={cn(
                                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider transition-all",
                                isAvailable
                                  ? "bg-[#FFD700] text-[#001d5c] hover:bg-[#ffdf33] active:scale-95 shadow cursor-pointer"
                                  : "bg-white/10 text-white/40 cursor-not-allowed border border-white/10"
                              )}
                            >
                              {status.checking ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : isAvailable ? (
                                "+ Add"
                              ) : (
                                "Unavailable"
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-3.5 flex items-start gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-display font-bold uppercase tracking-wider text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !hasMetMinimum || totalMembers > teamSize.max}
              className={cn(
                "rounded-xl px-5 py-2.5 text-xs sm:text-sm font-display font-black uppercase tracking-[0.12em] transition-all shadow-lg flex items-center gap-2",
                hasMetMinimum && totalMembers <= teamSize.max && !submitting
                  ? "bg-[#FFD700] text-[#001d5c] hover:bg-[#ffdf33] active:scale-98 shadow-[#FFD700]/20 cursor-pointer"
                  : "bg-white/15 text-white/40 cursor-not-allowed border border-white/10"
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Registering Team...
                </>
              ) : !hasMetMinimum ? (
                `Add ${neededToMinimum} more teammate${neededToMinimum > 1 ? "s" : ""}`
              ) : (
                `Confirm Registration (${totalMembers} Members)`
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

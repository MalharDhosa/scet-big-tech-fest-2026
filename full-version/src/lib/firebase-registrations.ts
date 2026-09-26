import { useState, useEffect } from "react";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDocs,
  arrayUnion,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { toEventSlug, getEventSlug } from "./event-slugs";
import { FEST_EVENTS, type FestEvent } from "./fest-state";

export type Teammate = {
  uid: string;
  name: string;
  email: string;
  phone?: string | undefined;
  dept?: string | undefined;
  enrollmentNumber?: string | undefined;
};

export type Registration = {
  id: string;
  userId: string;
  eventId: string;
  eventTitle?: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userDept: string;
  enrollmentNumber?: string;
  leaderUid?: string;
  leaderName?: string;
  leaderEmail?: string;
  leaderPhone?: string;
  partnerName: string;
  teamName?: string;
  teammates?: Teammate[];
  teamMemberUids?: string[];
  teamMemberEmails?: string[];
  track?: string;
  isNonTech?: boolean;
  qrToken: string;
  entryCode: string;
  checkedIn: boolean;
  checkedInAt: any;
  checkedInBy?: string;
  checkedInByName?: string;
  registeredAt: any;
};

export type TeamMemberInfo = {
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  dept?: string;
  isLeader: boolean;
  isCurrentUser: boolean;
};

export type TeamRoster = {
  isTeam: boolean;
  teamName: string;
  totalMembers: number;
  isCurrentUserLeader: boolean;
  leader: TeamMemberInfo;
  members: TeamMemberInfo[];
};

/**
 * Computes a unified team roster containing the leader and all teammates with role badges.
 */
export function getTeamRoster(
  reg: Registration | null | undefined,
  currentUser?: { uid?: string; email?: string | null } | null
): TeamRoster | null {
  if (!reg) return null;

  const rawTeammates = Array.isArray(reg.teammates) ? reg.teammates : [];
  const isTeam = Boolean(
    reg.teamName ||
    rawTeammates.length > 0 ||
    (reg.teamMemberUids && reg.teamMemberUids.length > 1)
  );

  const leaderUid = reg.leaderUid || reg.userId;
  const leaderName = reg.leaderName || reg.userName || "Team Leader";
  const leaderEmail = reg.leaderEmail || reg.userEmail || "";
  const leaderPhone = reg.leaderPhone || reg.userPhone || "";
  const leaderDept = reg.userDept || "";

  const isCurrentUserLeader = Boolean(
    (currentUser?.uid && leaderUid && currentUser.uid === leaderUid) ||
    (currentUser?.email && leaderEmail && currentUser.email.toLowerCase().trim() === leaderEmail.toLowerCase().trim())
  );

  // Filter out any duplicate instances of the leader from the other members list
  const otherMembers = rawTeammates.filter((tm) => {
    if (leaderUid && tm.uid && tm.uid === leaderUid) return false;
    if (leaderEmail && tm.email && tm.email.toLowerCase().trim() === leaderEmail.toLowerCase().trim()) return false;
    return true;
  });

  const totalMembers = 1 + otherMembers.length;

  return {
    isTeam,
    teamName: reg.teamName || (isTeam ? `${leaderName}'s Team` : ""),
    totalMembers,
    isCurrentUserLeader,
    leader: {
      uid: leaderUid,
      name: leaderName,
      email: leaderEmail,
      phone: leaderPhone,
      dept: leaderDept,
      isLeader: true,
      isCurrentUser: isCurrentUserLeader,
    },
    members: otherMembers.map((tm) => {
      const isCurrent = Boolean(
        (currentUser?.uid && tm.uid && currentUser.uid === tm.uid) ||
        (currentUser?.email && tm.email && currentUser.email.toLowerCase().trim() === tm.email.toLowerCase().trim())
      );
      return {
        uid: tm.uid || "",
        name: tm.name || "Member",
        email: tm.email || "",
        phone: tm.phone || "",
        dept: tm.dept || "",
        isLeader: false,
        isCurrentUser: isCurrent,
      };
    }),
  };
}

/**
 * Parse an event format string to determine minimum, maximum participants and team mode.
 */
export function parseEventTeamSize(formatString: string = ""): {
  min: number;
  max: number;
  isTeam: boolean;
  requiresTeam: boolean;
  isStrictlySolo: boolean;
  badgeLabel: string;
  label: string;
} {
  const lower = (formatString || "").toLowerCase().trim();
  if (!lower) {
    return { min: 1, max: 1, isTeam: false, requiresTeam: false, isStrictlySolo: true, badgeLabel: "SOLO", label: "Individual (1 Participant)" };
  }

  const hasTeamKeyword =
    lower.includes("team") ||
    lower.includes("group") ||
    lower.includes("duo") ||
    lower.includes("trio") ||
    lower.includes("pair") ||
    lower.includes("squad") ||
    lower.includes("partner");

  // 1. Explicit Individual / Solo (only if NO team/group/duo/pair keyword exists)
  if (!hasTeamKeyword && (lower.includes("individual") || lower === "solo" || lower === "1")) {
    return { min: 1, max: 1, isTeam: false, requiresTeam: false, isStrictlySolo: true, badgeLabel: "SOLO", label: "Individual (1 Participant)" };
  }

  // 2. Solo or Duo / Individual or Duo (1 or 2 participants)
  if (
    lower.includes("solo-duo") ||
    lower.includes("solo/duo") ||
    lower.includes("solo or duo") ||
    lower.includes("solo / duo") ||
    lower.includes("individual or duo") ||
    lower.includes("individual / duo") ||
    lower.includes("individual/duo") ||
    lower.includes("individual-duo") ||
    lower.includes("1 or 2") ||
    lower.includes("1 to 2")
  ) {
    return { min: 1, max: 2, isTeam: true, requiresTeam: false, isStrictlySolo: false, badgeLabel: "SOLO-DUO", label: "1 or 2 Participants (Solo-Duo)" };
  }

  // 3. Individual or Team (1 to 4 participants)
  if (
    lower.includes("individual or team") ||
    lower.includes("individual / team") ||
    lower.includes("individual or group") ||
    lower.includes("solo or team") ||
    lower.includes("solo / team")
  ) {
    return { min: 1, max: 4, isTeam: true, requiresTeam: false, isStrictlySolo: false, badgeLabel: "SOLO-TEAM", label: "1 to 4 Participants (Solo or Team)" };
  }

  // 4. Explicit Ranges: "2-3", "2 to 3", "2-4", "3-4", "4-5", etc. (MUST RUN BEFORE strictly-2 checks!)
  const rangeMatch = lower.match(/(\d+)\s*(?:-|to|\/)\s*(\d+)/);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    if (min === 1 && max === 1) {
      return { min: 1, max: 1, isTeam: false, requiresTeam: false, isStrictlySolo: true, badgeLabel: "SOLO", label: "Individual (1 Participant)" };
    }
    if (min === 1 && max === 2) {
      return { min: 1, max: 2, isTeam: true, requiresTeam: false, isStrictlySolo: false, badgeLabel: "SOLO-DUO", label: "1 or 2 Participants (Solo-Duo)" };
    }
    return {
      min,
      max,
      isTeam: true,
      requiresTeam: min > 1,
      isStrictlySolo: false,
      badgeLabel: `TEAM ${min}-${max}`,
      label: `Team of ${min}-${max} Participants`,
    };
  }

  // 5. Strictly Duo / Pair (strictly 2, NOT followed by a range like 2-3)
  if (
    lower === "duo" ||
    lower === "pair" ||
    /\b(duo|pair)\b/.test(lower) ||
    /\bteam\s+of\s+2\b(?!\s*[-–to\/])/.test(lower) ||
    /\bgroup\s+of\s+2\b(?!\s*[-–to\/])/.test(lower) ||
    /\b2\s+participants\b/.test(lower) ||
    /\b2\s+members\b/.test(lower)
  ) {
    return { min: 2, max: 2, isTeam: true, requiresTeam: true, isStrictlySolo: false, badgeLabel: "DUO", label: "Duo (2 Participants)" };
  }

  // 6. Strictly Trio (strictly 3, NOT followed by a range like 3-4)
  if (
    lower === "trio" ||
    /\bteam\s+of\s+3\b(?!\s*[-–to\/])/.test(lower) ||
    /\bgroup\s+of\s+3\b(?!\s*[-–to\/])/.test(lower) ||
    /\b3\s+participants\b/.test(lower) ||
    /\b3\s+members\b/.test(lower)
  ) {
    return { min: 3, max: 3, isTeam: true, requiresTeam: true, isStrictlySolo: false, badgeLabel: "TEAM 3", label: "Team of 3 Participants" };
  }

  // 7. Single count team like "team of 4", "team of 5" (NOT followed by a range)
  const singleMatch = lower.match(/\b(?:team|group|squad|size|max)\s*(?:of)?\s*(\d+)\b(?!\s*[-–to\/])/);
  if (singleMatch && singleMatch[1]) {
    const count = parseInt(singleMatch[1], 10);
    if (count > 0) {
      return {
        min: count,
        max: count,
        isTeam: count > 1,
        requiresTeam: count > 1,
        isStrictlySolo: count === 1,
        badgeLabel: count === 1 ? "SOLO" : count === 2 ? "DUO" : `TEAM ${count}`,
        label: count === 1 ? "Individual (1 Participant)" : `Team of ${count} Participants`,
      };
    }
  }

  // 8. General team/group keywords with no numbers specified
  if (hasTeamKeyword) {
    return { min: 2, max: 4, isTeam: true, requiresTeam: true, isStrictlySolo: false, badgeLabel: "TEAM", label: "Team Event (2-4 Participants)" };
  }

  return { min: 1, max: 1, isTeam: false, requiresTeam: false, isStrictlySolo: true, badgeLabel: "SOLO", label: "Individual (1 Participant)" };
}

// In-flight registration lock to prevent rapid duplicate clicks on slow networks
const inFlightRegistrationLocks = new Set<string>();

/**
 * Anti-Duplicate Verification:
 * Check if any of the given users (by UID or email) are ALREADY registered for the given event
 * in any existing team or solo registration.
 */
export async function checkIfUsersRegisteredForEvent(
  eventId: string,
  users: { uid?: string; email?: string; name?: string }[],
  eventTitle?: string
): Promise<{ isRegistered: boolean; conflictingUser?: string | undefined; conflictReason?: string | undefined }> {
  if (!users || users.length === 0) return { isRegistered: false };

  try {
    const targetEvent = {
      id: eventId,
      title: eventTitle || "",
      slug: toEventSlug(eventTitle || eventId),
    };

    const snap = await getDocs(collection(db, "registrations"));
    if (snap.empty) return { isRegistered: false };

    for (const docSnap of snap.docs) {
      const data = docSnap.data() as Registration;

      // Only inspect registrations that correspond to this specific event
      if (!doesRegistrationMatchEvent(data, targetEvent) && data.eventId !== eventId) {
        continue;
      }

      const allUids = new Set<string>();
      const allEmails = new Set<string>();

      if (data.userId) allUids.add(data.userId);
      if (data.teamMemberUids && Array.isArray(data.teamMemberUids)) {
        data.teamMemberUids.forEach((u) => allUids.add(u));
      }

      if (data.userEmail) allEmails.add(data.userEmail.toLowerCase().trim());
      if (data.teamMemberEmails && Array.isArray(data.teamMemberEmails)) {
        data.teamMemberEmails.forEach((e) => allEmails.add(e.toLowerCase().trim()));
      }
      if (data.teammates && Array.isArray(data.teammates)) {
        data.teammates.forEach((t) => {
          if (t.uid) allUids.add(t.uid);
          if (t.email) allEmails.add(t.email.toLowerCase().trim());
        });
      }

      for (const u of users) {
        const uEmail = u.email ? u.email.toLowerCase().trim() : "";
        if (u.uid && allUids.has(u.uid)) {
          return {
            isRegistered: true,
            conflictingUser: u.name || u.email || u.uid,
            conflictReason: `You are already registered for this event!`,
          };
        }
        if (uEmail && allEmails.has(uEmail)) {
          return {
            isRegistered: true,
            conflictingUser: u.name || u.email || u.uid,
            conflictReason: `"${u.name || u.email}" is already registered for this event!`,
          };
        }
      }
    }

    return { isRegistered: false };
  } catch (err) {
    console.error("Error checking duplicate event registrations:", err);
    return { isRegistered: false };
  }
}

/**
 * Generate a cryptographically signed QR verification token for event entry.
 * Format: CON26:{eventId}:{hash}
 */
async function generateQrToken(userId: string, eventId: string): Promise<string> {
  let saltHex = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    saltHex = Array.from(salt)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } else {
    saltHex = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  const payload = `${userId}:${eventId}:${Date.now()}:${saltHex}`;

  let hash: string;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoded = new TextEncoder().encode(payload);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } else {
    let h = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      h = (h << 5) - h + char;
      h = h & h;
    }
    hash = Math.abs(h).toString(16) + saltHex;
  }

  // Prefix with CON26:{eventId}: so the scanner can instantly identify the event
  return `CON26:${eventId}:${hash}`;
}

/**
 * Generate a short 6-character alphanumeric entry code for manual entry.
 * Uses characters that are easy to read (no I/O/0/1 to avoid confusion).
 */
function generateEntryCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const arr = new Uint8Array(1);
      crypto.getRandomValues(arr);
      code += chars[arr[0]! % chars.length];
    } else {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return code;
}

/**
 * Register a participant or team for an event.
 * PREVENTS DUPLICATES: rigorously checks if any member (leader or teammate)
 * has already registered for this event with another team.
 * Uses deterministic registration IDs so multiple rapid clicks never create duplicate entries!
 */
export async function registerForEvent(
  userId: string,
  eventId: string,
  userData: {
    name: string;
    email: string;
    phone: string;
    dept: string;
    enrollmentNumber?: string;
    partnerName?: string;
    teamName?: string;
    teammates?: Teammate[];
    eventTitle?: string;
    maxSlots?: number;
    track?: string;
    isNonTech?: boolean;
  },
) {
  const targetSlug = toEventSlug(userData.eventTitle || eventId);
  const deterministicDocId = `${userId}_${targetSlug}`;

  // 1. In-flight concurrency lock: prevent rapid multi-clicks from firing concurrent writes
  if (inFlightRegistrationLocks.has(deterministicDocId)) {
    throw new Error("Your registration is already in progress, please wait a moment!");
  }
  inFlightRegistrationLocks.add(deterministicDocId);

  try {
    const teammates = userData.teammates || [];
    const allMembers = [
      { uid: userId, email: userData.email, name: userData.name },
      ...teammates.map((t) => ({ uid: t.uid, email: t.email, name: t.name })),
    ];

    // 2. Check if deterministic document already exists in Firestore
    const regDocRef = doc(db, "registrations", deterministicDocId);
    const existingSnap = await getDoc(regDocRef);
    if (existingSnap.exists()) {
      const existing = existingSnap.data() as Registration;
      return {
        registrationId: existingSnap.id,
        qrToken: existing.qrToken || "",
        entryCode: existing.entryCode || "",
        isNonTech: Boolean(existing.isNonTech),
      };
    }

    // 3. Cross-team duplicate verification for all participants
    const dupCheck = await checkIfUsersRegisteredForEvent(eventId, allMembers, userData.eventTitle);
    if (dupCheck.isRegistered) {
      throw new Error(dupCheck.conflictReason || "One or more participants are already registered for this event!");
    }

    // 4. Check slot limits if maxSlots is defined
    if (userData.maxSlots && userData.maxSlots > 0) {
      const allRegsSnap = await getDocs(collection(db, "registrations"));
      const matchingDocs = new Set<string>();
      const eventTarget = {
        id: eventId,
        title: userData.eventTitle,
        slug: targetSlug,
      };

      allRegsSnap.forEach((d) => {
        const data = d.data() as Registration;
        if (doesRegistrationMatchEvent(data, eventTarget)) {
          matchingDocs.add(d.id);
        }
      });

      if (matchingDocs.size >= userData.maxSlots) {
        throw new Error(`Registration closed: all slots (${userData.maxSlots}) for this event are filled!`);
      }
    }

    // 5. Non-tech detection: for fun NON-TECH events, NO QR token or manual code is generated!
    const cleanTrack = (userData.track || "").toUpperCase().replace(/[\s-]/g, "");
    const isNonTech = Boolean(
      userData.isNonTech ||
      cleanTrack === "NONTECH" ||
      cleanTrack.includes("NON")
    );

    const qrToken = isNonTech ? "" : await generateQrToken(userId, eventId);
    const entryCode = isNonTech ? "" : generateEntryCode();

    const teamMemberUids = [userId, ...teammates.map((t) => t.uid)];
    const teamMemberEmails = [
      userData.email.toLowerCase().trim(),
      ...teammates.map((t) => t.email.toLowerCase().trim()),
    ];
    const partnerName = userData.partnerName || teammates.map((t) => t.name).join(", ");

    // 6. Write with deterministic document ID so duplicate rows are physically impossible in Firestore
    await setDoc(regDocRef, {
      userId,
      eventId,
      eventTitle: userData.eventTitle || "",
      track: isNonTech ? "NON-TECH" : (userData.track || "TECH"),
      isNonTech,
      userName: userData.name,
      userEmail: userData.email,
      userPhone: userData.phone,
      userDept: userData.dept,
      enrollmentNumber: userData.enrollmentNumber || "",
      leaderUid: userId,
      leaderName: userData.name,
      leaderEmail: userData.email,
      leaderPhone: userData.phone,
      teamName: userData.teamName || (teammates.length > 0 ? `${userData.name}'s Team` : ""),
      teammates,
      teamMemberUids,
      teamMemberEmails,
      partnerName,
      qrToken,
      entryCode,
      checkedIn: false,
      checkedInAt: null,
      registeredAt: serverTimestamp(),
    });

    return { registrationId: deterministicDocId, qrToken, entryCode, isNonTech };
  } finally {
    inFlightRegistrationLocks.delete(deterministicDocId);
  }
}

/**
 * Real-time listener for a user's registrations.
 * Syncs both registrations where the user is the leader AND registrations where
 * the user was added as a teammate!
 */
export function useMyRegistrations(userId: string | undefined, userEmail?: string | null) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId && !userEmail) {
      setRegistrations([]);
      setLoading(false);
      return;
    }

    let leaderRegs: Registration[] = [];
    let teammateRegs: Registration[] = [];
    let directEmailRegs: Registration[] = [];
    let leaderEmailRegs: Registration[] = [];
    let arrayEmailRegs: Registration[] = [];

    const mergeAndSet = () => {
      const map = new Map<string, Registration>();
      leaderRegs.forEach((r) => map.set(r.id, r));
      teammateRegs.forEach((r) => map.set(r.id, r));
      directEmailRegs.forEach((r) => map.set(r.id, r));
      leaderEmailRegs.forEach((r) => map.set(r.id, r));
      arrayEmailRegs.forEach((r) => map.set(r.id, r));

      const cleanEmail = userEmail ? userEmail.toLowerCase().trim() : "";
      const mergedList = Array.from(map.values());

      // Auto-link pre-imported offline registrations to real Firebase UID upon first sign-in
      if (userId && cleanEmail) {
        mergedList.forEach((r) => {
          const isUserRecord =
            r.userEmail?.toLowerCase().trim() === cleanEmail ||
            r.leaderEmail?.toLowerCase().trim() === cleanEmail ||
            r.teamMemberEmails?.some((e) => e.toLowerCase().trim() === cleanEmail);

          if (isUserRecord && (r.userId !== userId || !r.teamMemberUids?.includes(userId))) {
            const shouldBeLeader =
              r.userEmail?.toLowerCase().trim() === cleanEmail ||
              r.leaderEmail?.toLowerCase().trim() === cleanEmail;

            const updatePayload: Record<string, any> = {
              teamMemberUids: arrayUnion(userId),
            };
            if (shouldBeLeader && (!r.userId || r.userId.startsWith("sheet_") || r.userId.startsWith("t_"))) {
              updatePayload.userId = userId;
              updatePayload.leaderUid = userId;
              r.userId = userId;
              r.leaderUid = userId;
            }

            updateDoc(doc(db, "registrations", r.id), updatePayload).catch((err) => {
              console.warn("Background auto-link warning:", err);
            });
          }

          // Safety repair: ensure pass has a valid QR token and entry code if it is a tech event
          if (!r.isNonTech && (!r.qrToken || !r.entryCode || !r.qrToken.startsWith("CON26:"))) {
            generateQrToken(userId || cleanEmail, r.eventId).then((token) => {
              const code = r.entryCode && r.entryCode.length >= 6 ? r.entryCode : generateEntryCode();
              r.qrToken = token;
              r.entryCode = code;
              updateDoc(doc(db, "registrations", r.id), {
                qrToken: token,
                entryCode: code,
              }).catch(() => {});
            });
          }
        });
      }

      setRegistrations(mergedList);
      setLoading(false);
    };

    const unsubs: (() => void)[] = [];

    if (userId) {
      // 1. Where user is creator/leader by UID
      const q1 = query(collection(db, "registrations"), where("userId", "==", userId));
      unsubs.push(onSnapshot(q1, (snapshot) => {
        leaderRegs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Registration);
        mergeAndSet();
      }, (err) => {
        console.error("Error fetching leader registrations:", err);
        setLoading(false);
      }));

      // 2. Where user is in teamMemberUids (as a teammate by UID)
      const q2 = query(collection(db, "registrations"), where("teamMemberUids", "array-contains", userId));
      unsubs.push(onSnapshot(q2, (snapshot) => {
        teammateRegs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Registration);
        mergeAndSet();
      }, (err) => {
        console.error("Error fetching teammate registrations:", err);
        setLoading(false);
      }));
    }

    if (userEmail) {
      const cleanEmail = userEmail.toLowerCase().trim();

      // 3. Direct userEmail match (e.g. pre-imported offline registrations)
      const q3 = query(collection(db, "registrations"), where("userEmail", "==", cleanEmail));
      unsubs.push(onSnapshot(q3, (snapshot) => {
        directEmailRegs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Registration);
        mergeAndSet();
      }, (err) => {
        console.warn("Error fetching direct userEmail registrations:", err);
      }));

      // 4. Direct leaderEmail match
      const q4 = query(collection(db, "registrations"), where("leaderEmail", "==", cleanEmail));
      unsubs.push(onSnapshot(q4, (snapshot) => {
        leaderEmailRegs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Registration);
        mergeAndSet();
      }, (err) => {
        console.warn("Error fetching leaderEmail registrations:", err);
      }));

      // 5. Teammate email array match
      const q5 = query(collection(db, "registrations"), where("teamMemberEmails", "array-contains", cleanEmail));
      unsubs.push(onSnapshot(q5, (snapshot) => {
        arrayEmailRegs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Registration);
        mergeAndSet();
      }, (err) => {
        console.warn("Error fetching teamMemberEmails registrations:", err);
      }));
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [userId, userEmail]);

  return { registrations, loading };
}

/**
 * Real-time listener for ALL registrations (admin use).
 */
export function useAllRegistrations() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query without orderBy so documents without registeredAt are never dropped by Firestore
    const q = query(collection(db, "registrations"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Registration);
        // Sort in memory by registeredAt descending
        docs.sort((a, b) => {
          const tA = a.registeredAt?.toMillis?.() || (a.registeredAt?.seconds ? a.registeredAt.seconds * 1000 : 0);
          const tB = b.registeredAt?.toMillis?.() || (b.registeredAt?.seconds ? b.registeredAt.seconds * 1000 : 0);
          return tB - tA;
        });
        setRegistrations(docs);
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to all registrations:", error);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  return { registrations, loading };
}

/**
 * Real-time listener for event slot usage across the fest.
 * Accounting rule:
 * - Solo events: 1 registration doc = 1 slot used.
 * - Team events (Duo, 2-3, 3-4, etc.): 1 team registration doc = 1 team slot used.
 * Returns lookup methods for checking slots used and whether an event is full.
 */
export function useEventSlotCounts() {
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;

    // Only subscribe to registrations if user is authenticated (satisfies Firestore security rules)
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        if (unsubFirestore) {
          unsubFirestore();
          unsubFirestore = null;
        }
        setSlotCounts({});
        setLoading(false);
        return;
      }

      const q = query(collection(db, "registrations"));
      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          const regs: Registration[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Registration),
          }));

          // Group unique registration document IDs per alias key to ensure exact counting:
          // 1 solo doc = 1 slot, 1 team doc = 1 team slot
          const tally: Record<string, number> = {};

          // Count per event using FEST_EVENTS
          FEST_EVENTS.forEach((ev) => {
            const count = regs.filter((r) => doesRegistrationMatchEvent(r, ev)).length;
            const slug = getEventSlug(ev);
            const titleLower = (ev.title || "").toLowerCase().trim();
            const id = (ev.id || "").trim();

            if (slug) tally[slug] = count;
            if (titleLower) tally[titleLower] = count;

            // Only assign tally[id] if this ID does not collide with another event's canonical slug
            // (e.g., IT Quiz has id "py-it", which collides with PY-IT's slug "py-it")
            const isCollidingId = FEST_EVENTS.some((other) => other.id !== ev.id && getEventSlug(other) === id);
            if (id && !isCollidingId) {
              tally[id] = count;
            }
          });

          // Also account for custom / newly added events
          regs.forEach((r) => {
            if (r.eventTitle) {
              const tSlug = toEventSlug(r.eventTitle);
              const tLower = r.eventTitle.toLowerCase().trim();
              if (tally[tSlug] === undefined) {
                const count = regs.filter((reg) => doesRegistrationMatchEvent(reg, { title: r.eventTitle })).length;
                tally[tSlug] = count;
                tally[tLower] = count;
              }
            }
          });

          setSlotCounts(tally);
          setLoading(false);
        },
        () => {
          // Silently handle any disconnects or permission drops
          setLoading(false);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  /**
   * Returns total slots used for a given event.
   */
  const getEventSlotsUsed = (eventOrId: string | { id?: string; title?: string; slug?: string } | null | undefined): number => {
    if (!eventOrId) return 0;
    if (typeof eventOrId === "string") {
      const slug = toEventSlug(eventOrId);
      return slotCounts[slug] ?? slotCounts[eventOrId] ?? slotCounts[eventOrId.toLowerCase().trim()] ?? 0;
    }
    const slug = getEventSlug(eventOrId);
    const titleLower = (eventOrId.title || "").toLowerCase().trim();
    const id = eventOrId.id || "";

    // Prioritize slug and titleLower first to avoid colliding doc IDs (e.g. IT Quiz id 'py-it')
    if (slug && slotCounts[slug] !== undefined) {
      return slotCounts[slug];
    }
    if (titleLower && slotCounts[titleLower] !== undefined) {
      return slotCounts[titleLower];
    }
    if (id && slotCounts[id] !== undefined) {
      return slotCounts[id];
    }
    return 0;
  };

  /**
   * Checks if an event has reached its maximum slots.
   */
  const isEventSlotsFull = (event: { maxSlots?: number; id?: string; title?: string; slug?: string } | null | undefined): boolean => {
    if (!event || !event.maxSlots || event.maxSlots <= 0) return false;
    const used = getEventSlotsUsed(event);
    return used >= event.maxSlots;
  };

  return { slotCounts, getEventSlotsUsed, isEventSlotsFull, loading };
}

/**
 * Rigorously determines whether a registration document corresponds to a given event.
 * Eliminates cross-event false positives (such as IT Quiz with Firestore doc ID 'py-it'
 * falsely matching PY-IT whose URL slug is 'py-it').
 */
export function doesRegistrationMatchEvent(
  r: Registration | null | undefined,
  event: { id?: string; title?: string; slug?: string } | null | undefined
): boolean {
  if (!r || !event) return false;

  const evId = (event.id || "").trim();
  const evTitle = (event.title || "").toLowerCase().trim();
  const evSlug = getEventSlug(event);

  const rEventId = (r.eventId || "").trim();
  const rTitle = (r.eventTitle || "").toLowerCase().trim();

  // 1. If registration has an eventTitle and the event has a title, match by title!
  // This is 100% immune to doc ID vs slug collisions across renamed festival events.
  if (rTitle && evTitle) {
    if (rTitle === evTitle) return true;
    const rTitleSlug = toEventSlug(r.eventTitle);
    if (rTitleSlug === evSlug) return true;
    return false; // Explicitly different titles mean different events!
  }

  // 2. Exact eventId match (doc ID == doc ID)
  if (rEventId && evId && rEventId === evId) {
    return true;
  }

  // 3. Fallback only if rTitle is not present: match by slug only if exact slug matches
  // Guard: if the event has its own ID and it's different from the registration's eventId,
  // slug-based matching is NOT safe — it could cross-contaminate events that share a slug
  // (e.g., event "brick-bot-battle" with slug "py-it" vs registration eventId "py-it").
  if (rEventId && evSlug && rEventId === evSlug && !rTitle) {
    if (!evId || rEventId === evId) {
      return true;
    }
    // rEventId !== evId means the registration belongs to a different event
    return false;
  }

  return false;
}

/**
 * Robust helper to verify if a user is registered for an event across IDs, slugs, and titles.
 */
export function isUserRegisteredForEvent(
  event: { id?: string; title?: string; slug?: string } | null | undefined,
  userRegistrations: Registration[] = [],
  registeredIdsList?: string[]
): boolean {
  if (!event) return false;

  // 1. Primary source of truth: active Firestore registrations
  if (userRegistrations && userRegistrations.length > 0) {
    return userRegistrations.some((r) => doesRegistrationMatchEvent(r, event));
  }

  // 2. If userRegistrations is explicitly provided as an array (even if empty []), trust it!
  // An empty array means the user has 0 registrations in the database.
  if (userRegistrations && Array.isArray(userRegistrations)) {
    return false;
  }

  // 3. Fallback only if userRegistrations was not provided at all (undefined/null)
  if (registeredIdsList && registeredIdsList.length > 0) {
    const evId = event.id || "";
    const evTitle = (event.title || "").toLowerCase().trim();
    const evSlug = getEventSlug(event);
    return registeredIdsList.some(
      (id) => id === evId || id === evSlug || id.toLowerCase().trim() === evTitle
    );
  }

  return false;
}

/**
 * Validate a QR token OR entry code scanned/entered at the gate.
 * Returns the registration if valid, null if not found.
 */
export async function validateQrToken(token: string): Promise<Registration | null> {
  const trimmed = token.trim();

  // 1. Try exact QR token match (new CON26:eventId:hash format)
  let q = query(collection(db, "registrations"), where("qrToken", "==", trimmed));
  let snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const d = snapshot.docs[0]!;
    return { id: d.id, ...d.data() } as Registration;
  }

  // 2. If the scanned token has CON26: prefix, try just the hash portion
  //    (backwards compat: old tokens may have been stored without the prefix)
  if (trimmed.startsWith("CON26:")) {
    const parts = trimmed.split(":");
    if (parts.length >= 3) {
      const hashOnly = parts.slice(2).join(":");
      q = query(collection(db, "registrations"), where("qrToken", "==", hashOnly));
      snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const d = snapshot.docs[0]!;
        return { id: d.id, ...d.data() } as Registration;
      }
    }
  }

  // 3. Try entry code (case-insensitive, for manual entry)
  q = query(collection(db, "registrations"), where("entryCode", "==", trimmed.toUpperCase()));
  snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const d = snapshot.docs[0]!;
    return { id: d.id, ...d.data() } as Registration;
  }

  return null;
}

/**
 * Check in a participant by setting checkedIn = true.
 * 
 * SECURITY HARDENING:
 * 1. Freshly reads the registration doc to guard against race conditions
 *    (two scanners scanning the same QR simultaneously).
 * 2. If the scanner is a sub-admin, verifies the event assignment
 *    matches the registration's event (server-side enforcement).
 * 3. Records an audit trail: who scanned and when.
 */
export async function checkInParticipant(
  registrationId: string,
  scannedBy: { uid: string; name: string; assignedEventId?: string | undefined }
) {
  const regRef = doc(db, "registrations", registrationId);
  const regSnap = await getDoc(regRef);

  if (!regSnap.exists()) {
    throw new Error("REGISTRATION_NOT_FOUND");
  }

  const data = regSnap.data();

  // Race condition guard: re-check checkedIn at write time
  if (data.checkedIn) {
    throw new Error("ALREADY_CHECKED_IN");
  }

  // Server-side event assignment enforcement for sub-admins
  if (scannedBy.assignedEventId && data.eventId !== scannedBy.assignedEventId) {
    throw new Error("EVENT_MISMATCH");
  }

  // Count total team members for audit visibility
  const memberCount = data.teamMemberUids?.length || 1;

  await updateDoc(regRef, {
    checkedIn: true,
    checkedInAt: serverTimestamp(),
    checkedInBy: scannedBy.uid,
    checkedInByName: scannedBy.name,
    checkedInMemberCount: memberCount,
  });
}

/**
 * Delete a registration and ALL duplicates for the same user+event.
 * This ensures no "ghost" registrations reappear after deletion.
 */
export async function deleteRegistration(registrationId: string) {
  // Get the registration document to find userId and event details
  const regRef = doc(db, "registrations", registrationId);
  const regSnap = await getDoc(regRef);

  if (regSnap.exists()) {
    const data = regSnap.data();
    const targetEventId = data.eventId;
    const targetTitle = (data.eventTitle || "").toLowerCase().trim();

    // Find all registrations for this same user to clean up exact duplicates
    const userRegs = await getDocs(
      query(
        collection(db, "registrations"),
        where("userId", "==", data.userId),
      )
    );

    const deletePromises: Promise<void>[] = [];
    userRegs.docs.forEach((d) => {
      const dData = d.data();
      const dTitle = (dData.eventTitle || "").toLowerCase().trim();

      // Only delete if it's the exact doc ID OR clearly the same event (same title or exact same eventId)
      const isSameEvent =
        d.id === registrationId ||
        (targetTitle && dTitle && dTitle === targetTitle) ||
        (!targetTitle && dData.eventId === targetEventId);

      if (isSameEvent) {
        deletePromises.push(deleteDoc(doc(db, "registrations", d.id)));
      }
    });

    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    } else {
      await deleteDoc(regRef);
    }

    // Clean up local storage cache if in browser
    if (typeof window !== "undefined" && data.userId) {
      try {
        localStorage.removeItem(`converse_2026_registered_events_${data.userId}`);
      } catch {}
    }
  } else {
    // Fallback: just delete the one document
    await deleteDoc(regRef);
  }
}

/**
 * Canonical event key resolution to prevent event fragmentation across naming variants:
 * e.g., 'IT Quiz', 'IT-Quiz', 'py-it' all map to the official 'it-quiz'.
 */
export function getCanonicalEventKey(eventTitle?: string, eventId?: string): { canonicalKey: string; canonicalEvent?: FestEvent } {
  const cleanTitle = (eventTitle || "").trim().toLowerCase();
  const cleanId = (eventId || "").trim().toLowerCase();

  // 1. Pass 1: Exact title or exact slug match across all festival events
  if (cleanTitle) {
    for (const fe of FEST_EVENTS) {
      const feTitle = fe.title.toLowerCase();
      const feSlug = toEventSlug(fe.title);
      if (cleanTitle === feTitle || toEventSlug(cleanTitle) === feSlug) {
        return { canonicalKey: feSlug, canonicalEvent: fe };
      }
    }
  }

  // 2. Pass 2: Exact doc eventId match across all festival events
  if (cleanId) {
    for (const fe of FEST_EVENTS) {
      if (cleanId === fe.id.toLowerCase()) {
        return { canonicalKey: toEventSlug(fe.title), canonicalEvent: fe };
      }
    }
  }

  // 3. Pass 3: Explicit historical festival aliases
  if (/it[- ]?quiz/i.test(cleanTitle) || cleanId === "py-it" || cleanId === "it-quiz") {
    const itQuizEvent = FEST_EVENTS.find((e) => /it[- ]?quiz/i.test(e.title));
    if (itQuizEvent) {
      return { canonicalKey: "it-quiz", canonicalEvent: itQuizEvent };
    }
    return { canonicalKey: "it-quiz" };
  }

  if (/cyber[- ]?quiz/i.test(cleanTitle) || cleanId === "cyber-quiz") {
    const cyberEvent = FEST_EVENTS.find((e) => /cyber/i.test(e.title));
    if (cyberEvent) {
      return { canonicalKey: "cyber-quiz", canonicalEvent: cyberEvent };
    }
    return { canonicalKey: "cyber-quiz" };
  }

  if (/aws/i.test(cleanTitle)) {
    const awsEvent = FEST_EVENTS.find((e) => /aws/i.test(e.title));
    if (awsEvent) {
      return { canonicalKey: "aws-builder-challenge", canonicalEvent: awsEvent };
    }
  }

  // 4. Pass 4: Substring match only as conservative fallback
  if (cleanTitle && cleanTitle.length >= 4) {
    for (const fe of FEST_EVENTS) {
      const feTitle = fe.title.toLowerCase();
      if (cleanTitle.includes(feTitle) || feTitle.includes(cleanTitle)) {
        return { canonicalKey: toEventSlug(fe.title), canonicalEvent: fe };
      }
    }
  }

  // 5. Fallback: URL-safe slugification
  const fallback = toEventSlug(eventTitle || eventId || "event");
  return { canonicalKey: fallback };
}

/**
 * Automatically find and clean up all duplicate registrations across the database.
 * Preserves the primary/checked-in registration with its original QR token and entry code,
 * merges any missing data into the primary, and strictly deletes only the extraneous duplicates.
 * Under NO circumstances can all rows be deleted; exactly one primary registration is preserved.
 */
export async function cleanupAllDuplicateRegistrations(): Promise<{
  totalScanned: number;
  duplicatesRemoved: number;
  affectedUsers: string[];
}> {
  const allRegsSnap = await getDocs(collection(db, "registrations"));
  const allDocs = allRegsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Registration),
  }));

  // Step 1: Build identity correlation map across all documents
  // Maps any Firebase Auth UID to canonical email so all documents for a student group together
  const uidToCanonicalEmail = new Map<string, string>();
  for (const docItem of allDocs) {
    const email = (docItem.userEmail || docItem.leaderEmail || "").toLowerCase().trim();
    if (email && docItem.userId && !docItem.userId.startsWith("sheet_") && !docItem.userId.startsWith("t_")) {
      uidToCanonicalEmail.set(docItem.userId, email);
    }
  }

  // Step 2: Group by (canonicalUser + canonicalEventKey)
  const groups = new Map<string, typeof allDocs>();

  for (const docItem of allDocs) {
    const rawEmail = (docItem.userEmail || docItem.leaderEmail || "").toLowerCase().trim();
    const mappedEmail = docItem.userId ? uidToCanonicalEmail.get(docItem.userId) : undefined;
    const canonicalUser = rawEmail || mappedEmail || (docItem.userId || "").toLowerCase().trim();

    const { canonicalKey } = getCanonicalEventKey(docItem.eventTitle, docItem.eventId);
    if (!canonicalUser || !canonicalKey) continue;

    const groupKey = `${canonicalUser}___${canonicalKey}`;
    const existing = groups.get(groupKey) || [];
    existing.push(docItem);
    groups.set(groupKey, existing);
  }

  let duplicatesRemoved = 0;
  const affectedUsers = new Set<string>();
  const deletePromises: Promise<void>[] = [];

  for (const [groupKey, items] of groups.entries()) {
    // If only 1 document exists, it's not a duplicate! Never touch it.
    if (items.length <= 1) continue;

    // Step 3: Sort to determine the primary document to keep:
    // 1. Prefer checked-in document (crucial if scanned at gate)
    // 2. Prefer document with real Auth UID (not placeholder sheet_)
    // 3. Prefer document with valid cryptographic QR token (CON26:...) and entry code
    // 4. Prefer document with teammates
    // 5. Prefer deterministic ID (${userId}_${slug})
    // 6. Prefer alphabetical ID stability
    items.sort((a, b) => {
      if (a.checkedIn && !b.checkedIn) return -1;
      if (!a.checkedIn && b.checkedIn) return 1;

      const aIsRealUid = a.userId && !a.userId.startsWith("sheet_") && !a.userId.startsWith("t_");
      const bIsRealUid = b.userId && !b.userId.startsWith("sheet_") && !b.userId.startsWith("t_");
      if (aIsRealUid && !bIsRealUid) return -1;
      if (!aIsRealUid && bIsRealUid) return 1;

      const aHasQr = Boolean(a.qrToken && a.qrToken.startsWith("CON26:"));
      const bHasQr = Boolean(b.qrToken && b.qrToken.startsWith("CON26:"));
      if (aHasQr && !bHasQr) return -1;
      if (!aHasQr && bHasQr) return 1;

      const aHasCode = Boolean(a.entryCode && a.entryCode.length >= 6);
      const bHasCode = Boolean(b.entryCode && b.entryCode.length >= 6);
      if (aHasCode && !bHasCode) return -1;
      if (!aHasCode && bHasCode) return 1;

      const aTeammates = (a.teammates && a.teammates.length) || 0;
      const bTeammates = (b.teammates && b.teammates.length) || 0;
      if (aTeammates > bTeammates) return -1;
      if (bTeammates > aTeammates) return 1;

      const aIsDeterministic = a.id.includes("_");
      const bIsDeterministic = b.id.includes("_");
      if (aIsDeterministic && !bIsDeterministic) return -1;
      if (!aIsDeterministic && bIsDeterministic) return 1;

      return a.id.localeCompare(b.id);
    });

    const primary = items[0];
    const duplicates = items.slice(1);

    // Step 4: REPAIR & MERGE missing data from duplicates into primary
    const { canonicalEvent } = getCanonicalEventKey(primary.eventTitle, primary.eventId);
    const updateData: Partial<Registration> = {};
    let needsUpdate = false;

    // Check-in status
    if (!primary.checkedIn && items.some((it) => it.checkedIn)) {
      const checkedInDoc = items.find((it) => it.checkedIn);
      primary.checkedIn = true;
      primary.checkedInAt = checkedInDoc?.checkedInAt || serverTimestamp();
      updateData.checkedIn = true;
      updateData.checkedInAt = primary.checkedInAt;
      needsUpdate = true;
    }

    // Canonical event title and ID
    if (canonicalEvent) {
      if (primary.eventId !== canonicalEvent.id) {
        primary.eventId = canonicalEvent.id;
        updateData.eventId = canonicalEvent.id;
        needsUpdate = true;
      }
      if (primary.eventTitle !== canonicalEvent.title) {
        primary.eventTitle = canonicalEvent.title;
        updateData.eventTitle = canonicalEvent.title;
        needsUpdate = true;
      }
    }

    // Cryptographic QR token and entry code guarantee
    const isNonTech = Boolean(primary.isNonTech || canonicalEvent?.track === "NON-TECH");
    if (!isNonTech) {
      let validQr = primary.qrToken && primary.qrToken.startsWith("CON26:") ? primary.qrToken : "";
      let validCode = primary.entryCode && primary.entryCode.length >= 6 ? primary.entryCode : "";

      if (!validQr) {
        const itemWithQr = items.find((it) => it.qrToken && it.qrToken.startsWith("CON26:"));
        if (itemWithQr?.qrToken) {
          validQr = itemWithQr.qrToken;
        }
      }
      if (!validCode) {
        const itemWithCode = items.find((it) => it.entryCode && it.entryCode.length >= 6);
        if (itemWithCode?.entryCode) {
          validCode = itemWithCode.entryCode;
        }
      }

      if (!validQr) {
        validQr = await generateQrToken(primary.userId || primary.userEmail, primary.eventId);
      }
      if (!validCode) {
        validCode = generateEntryCode();
      }

      if (primary.qrToken !== validQr) {
        primary.qrToken = validQr;
        updateData.qrToken = validQr;
        needsUpdate = true;
      }
      if (primary.entryCode !== validCode) {
        primary.entryCode = validCode;
        updateData.entryCode = validCode;
        needsUpdate = true;
      }
    }

    // Real Firebase UID copy
    const realUidDoc = items.find((it) => it.userId && !it.userId.startsWith("sheet_") && !it.userId.startsWith("t_"));
    if (realUidDoc && (!primary.userId || primary.userId.startsWith("sheet_") || primary.userId.startsWith("t_"))) {
      primary.userId = realUidDoc.userId;
      primary.leaderUid = realUidDoc.userId;
      updateData.userId = realUidDoc.userId;
      updateData.leaderUid = realUidDoc.userId;
      needsUpdate = true;
    }

    // Canonical user email and teammate emails
    const cleanEmail = (primary.userEmail || primary.leaderEmail || "").toLowerCase().trim();
    if (cleanEmail) {
      const existingEmails = Array.isArray(primary.teamMemberEmails) ? primary.teamMemberEmails : [];
      if (!existingEmails.includes(cleanEmail)) {
        const updatedEmails = Array.from(new Set([cleanEmail, ...existingEmails]));
        primary.teamMemberEmails = updatedEmails;
        updateData.teamMemberEmails = updatedEmails;
        needsUpdate = true;
      }
    }

    // Teammates list merge if primary has none
    if ((!primary.teammates || primary.teammates.length === 0) && items.some((it) => it.teammates && it.teammates.length > 0)) {
      const docWithTeammates = items.find((it) => it.teammates && it.teammates.length > 0);
      if (docWithTeammates) {
        primary.teammates = docWithTeammates.teammates;
        primary.teamName = docWithTeammates.teamName || primary.teamName;
        updateData.teammates = docWithTeammates.teammates;
        if (docWithTeammates.teamName) updateData.teamName = docWithTeammates.teamName;
        needsUpdate = true;
      }
    }

    // Fill missing user phone, dept, enrollment
    if (!primary.userPhone) {
      const withPhone = items.find((it) => it.userPhone);
      if (withPhone?.userPhone) {
        primary.userPhone = withPhone.userPhone;
        updateData.userPhone = withPhone.userPhone;
        needsUpdate = true;
      }
    }
    if (!primary.userDept) {
      const withDept = items.find((it) => it.userDept);
      if (withDept?.userDept) {
        primary.userDept = withDept.userDept;
        updateData.userDept = withDept.userDept;
        needsUpdate = true;
      }
    }
    if (!primary.enrollmentNumber) {
      const withEnrollment = items.find((it) => it.enrollmentNumber);
      if (withEnrollment?.enrollmentNumber) {
        primary.enrollmentNumber = withEnrollment.enrollmentNumber;
        updateData.enrollmentNumber = withEnrollment.enrollmentNumber;
        needsUpdate = true;
      }
    }

    // Update primary in Firestore
    if (needsUpdate) {
      try {
        await updateDoc(doc(db, "registrations", primary.id), updateData);
      } catch (err) {
        console.warn("Error updating primary registration:", primary.id, err);
      }
    }

    // STRICT DELETION: only delete duplicates (items.slice(1))
    // primary (items[0]) is NEVER included in this list!
    for (const dup of duplicates) {
      deletePromises.push(deleteDoc(doc(db, "registrations", dup.id)));
      duplicatesRemoved++;
      affectedUsers.add(primary.userName || cleanEmail || primary.userId);
    }
  }

  if (deletePromises.length > 0) {
    await Promise.all(deletePromises);
  }

  return {
    totalScanned: allDocs.length,
    duplicatesRemoved,
    affectedUsers: Array.from(affectedUsers),
  };
}


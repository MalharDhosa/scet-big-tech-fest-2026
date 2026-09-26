import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { checkIfUsersRegisteredForEvent, type Teammate } from "./firebase-registrations";

export type OnboardedCandidate = Teammate & {
  year?: string;
  semester?: string;
};

/**
 * Search strictly for registered accounts where the details form has been filled (onboarded: true).
 * Excludes the current user and any already selected teammates.
 */
export async function searchOnboardedUsers(
  searchTerm: string,
  currentUserId: string,
  excludeUids: string[] = []
): Promise<OnboardedCandidate[]> {
  const cleanTerm = searchTerm.trim().toLowerCase();
  if (!cleanTerm) return [];

  try {
    // Query users who have completed their onboarding profile
    const q = query(collection(db, "users"), where("onboarded", "==", true));
    const snap = await getDocs(q);

    if (snap.empty) return [];

    const results: OnboardedCandidate[] = [];
    const excludeSet = new Set([currentUserId, ...excludeUids]);

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const uid = docSnap.id;

      if (excludeSet.has(uid)) continue;

      const name = (data.name || "").trim();
      const email = (data.email || "").trim();
      const enrollmentNumber = (data.enrollmentNumber || "").trim();
      const branch = (data.branch || "").trim();
      const phone = (data.phone || "").trim();

      // Ensure profile details are actually present
      if (!name || !email) continue;

      // Filter by term matching name, email, or enrollment number
      const matchesName = name.toLowerCase().includes(cleanTerm);
      const matchesEmail = email.toLowerCase().includes(cleanTerm);
      const matchesEnrollment = enrollmentNumber.toLowerCase().includes(cleanTerm);

      if (matchesName || matchesEmail || matchesEnrollment) {
        results.push({
          uid,
          name,
          email,
          phone,
          dept: branch,
          enrollmentNumber,
          year: data.year,
          semester: data.semester,
        });
      }

      if (results.length >= 15) break; // Limit dropdown results
    }

    return results;
  } catch (err) {
    console.error("Error searching onboarded users:", err);
    return [];
  }
}

/**
 * Check if a candidate is available for this event or already registered with another team.
 */
export async function verifyCandidateAvailability(
  eventId: string,
  candidate: OnboardedCandidate
): Promise<{ available: boolean; reason?: string }> {
  const check = await checkIfUsersRegisteredForEvent(eventId, [
    { uid: candidate.uid, email: candidate.email, name: candidate.name },
  ]);

  if (check.isRegistered) {
    return { available: false, reason: check.conflictReason || "Already registered for this event with another team" };
  }

  return { available: true };
}

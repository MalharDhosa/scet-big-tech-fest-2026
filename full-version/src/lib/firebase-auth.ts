import { useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  getAuth,
} from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  arrayUnion,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import firebaseApp from "./firebase";

export type UserRole = "master" | "admin" | "sub-admin" | "participant";

export type AuthUser = {
  uid: string;
  email: string | null;
  role: UserRole;
  name: string;
  photoURL: string | null;
  assignedEventId?: string;
  phone?: string;
  collegeName?: string;
  branch?: string;
  semester?: string;
  year?: string;
  enrollmentNumber?: string;
  onboarded: boolean;
};

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const USER_CACHE_KEY = "converse_cached_auth_user";

function getCachedAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY) || localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setCachedAuthUser(u: AuthUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (u) {
      sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
    } else {
      sessionStorage.removeItem(USER_CACHE_KEY);
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {}
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => getCachedAuthUser());
  const [loading, setLoading] = useState(() => !getCachedAuthUser());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const isParticipant = (data.role as UserRole || "participant") === "participant";
            const isOnboarded = data.onboarded === true || (!isParticipant); // Sub-admins don't need onboarding
            
            const resolved: AuthUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: (data.role as UserRole) || "participant",
              name: data.name || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Builder",
              photoURL: firebaseUser.photoURL || data.photoURL || null,
              assignedEventId: data.assignedEventId || undefined,
              phone: data.phone,
              collegeName: data.collegeName,
              branch: data.branch,
              semester: data.semester,
              year: data.year,
              enrollmentNumber: data.enrollmentNumber,
              onboarded: isOnboarded,
            };
            setUser(resolved);
            setCachedAuthUser(resolved);
          } else {
            // First-time login — create participant profile (pre-populating any offline imported sheet details)
            const cleanEmail = (firebaseUser.email || "").toLowerCase().trim();
            const displayName = firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Builder";

            let prefillPhone = "";
            let prefillDept = "";
            let prefillEnrollment = "";
            let prefillName = displayName;

            if (cleanEmail) {
              try {
                const regSnap = await getDocs(query(collection(db, "registrations"), where("userEmail", "==", cleanEmail)));
                if (!regSnap.empty) {
                  const regData = regSnap.docs[0].data();
                  if (regData.userName) prefillName = regData.userName;
                  if (regData.userPhone) prefillPhone = regData.userPhone;
                  if (regData.userDept) prefillDept = regData.userDept;
                  if (regData.enrollmentNumber) prefillEnrollment = regData.enrollmentNumber;

                  // Auto-link this pre-imported registration to the user's new Auth UID
                  regSnap.docs.forEach((d) => {
                    updateDoc(doc(db, "registrations", d.id), {
                      userId: firebaseUser.uid,
                      leaderUid: firebaseUser.uid,
                      teamMemberUids: arrayUnion(firebaseUser.uid),
                    }).catch(() => {});
                  });
                }
              } catch (e) {
                console.warn("Could not pre-fetch imported registration for first-time user:", e);
              }
            }

            const initialUserData: Record<string, any> = {
              email: firebaseUser.email,
              name: prefillName,
              photoURL: firebaseUser.photoURL || null,
              role: "participant",
              phone: prefillPhone || "",
              branch: prefillDept || "",
              enrollmentNumber: prefillEnrollment || "",
              collegeName: "SCET",
              onboarded: false,
              createdAt: serverTimestamp(),
            };

            await setDoc(doc(db, "users", firebaseUser.uid), initialUserData);

            const resolved: AuthUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: "participant",
              name: prefillName,
              photoURL: firebaseUser.photoURL || null,
              phone: prefillPhone || undefined,
              branch: prefillDept || undefined,
              enrollmentNumber: prefillEnrollment || undefined,
              collegeName: "SCET",
              onboarded: false,
            };
            setUser(resolved);
            setCachedAuthUser(resolved);
          }
        } catch (err) {
          console.warn("Network issue fetching user role, falling back to active auth session:", err);
          const cached = getCachedAuthUser();
          if (cached && cached.uid === firebaseUser.uid) {
            setUser(cached);
          } else {
            const fallback: AuthUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: "participant",
              name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Participant",
              photoURL: firebaseUser.photoURL || null,
              onboarded: true,
            };
            setUser(fallback);
            setCachedAuthUser(fallback);
          }
        }
      } else {
        setUser(null);
        setCachedAuthUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { user, loading };
}


/**
 * Google Sign-In for participants (main login page).
 * Returns the user's role for routing decisions.
 */
export async function signInWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  const userDocRef = doc(db, "users", cred.user.uid);
  const userDoc = await getDoc(userDocRef);

  if (!userDoc.exists()) {
    // First-time Google login — check if user was pre-registered in offline import
    const cleanEmail = (cred.user.email || "").toLowerCase().trim();
    const displayName = cred.user.displayName || cred.user.email?.split("@")[0] || "Builder";

    let prefillPhone = "";
    let prefillDept = "";
    let prefillEnrollment = "";
    let prefillName = displayName;

    if (cleanEmail) {
      try {
        const regSnap = await getDocs(query(collection(db, "registrations"), where("userEmail", "==", cleanEmail)));
        if (!regSnap.empty) {
          const regData = regSnap.docs[0].data();
          if (regData.userName) prefillName = regData.userName;
          if (regData.userPhone) prefillPhone = regData.userPhone;
          if (regData.userDept) prefillDept = regData.userDept;
          if (regData.enrollmentNumber) prefillEnrollment = regData.enrollmentNumber;

          // Auto-link pre-imported registrations to this new Google Auth UID
          regSnap.docs.forEach((d) => {
            updateDoc(doc(db, "registrations", d.id), {
              userId: cred.user.uid,
              leaderUid: cred.user.uid,
              teamMemberUids: arrayUnion(cred.user.uid),
            }).catch(() => {});
          });
        }
      } catch (e) {
        console.warn("Could not pre-fetch imported registration in signInWithGoogle:", e);
      }
    }

    await setDoc(userDocRef, {
      email: cred.user.email,
      name: prefillName,
      photoURL: cred.user.photoURL || null,
      role: "participant",
      phone: prefillPhone || "",
      branch: prefillDept || "",
      enrollmentNumber: prefillEnrollment || "",
      collegeName: "SCET",
      onboarded: false,
      createdAt: serverTimestamp(),
    });
    return { uid: cred.user.uid, role: "participant" as UserRole, onboarded: false };
  }

  const role = (userDoc.data().role as UserRole) || "participant";
  const onboarded = userDoc.data().onboarded === true || role !== "participant";
  return { uid: cred.user.uid, role, onboarded };
}

/**
 * Email/password sign-in (admin login page only).
 */
export async function signIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, "users", cred.user.uid));
  const role = userDoc.exists() ? (userDoc.data().role as UserRole) : "participant";
  return { uid: cred.user.uid, role };
}

export async function signOut() {
  await firebaseSignOut(auth);
  // Nuke all browser-side caches to guarantee zero data leaks between accounts
  if (typeof window !== "undefined") {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
  }
}



export interface User {
  uid: string;
  email: string;
  role: UserRole;
  assignedEventId?: string;
}

/**
 * Assign an existing Google user as a sub-admin coordinator for a specific event.
 * No email/password required — user logs in directly with Google!
 */
export async function assignUserAsSubAdmin(
  uid: string,
  name: string,
  assignedEventId: string,
  assignedEventTitle?: string
) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Must be authenticated as master admin");

  await updateDoc(doc(db, "users", uid), {
    role: "sub-admin" as UserRole,
    name,
    assignedEventId,
    ...(assignedEventTitle ? { assignedEventTitle } : {}),
    onboarded: true,
  });
}

/**
 * Revoke sub-admin privileges, returning the user to standard participant status.
 */
export async function revokeSubAdmin(uid: string) {
  await updateDoc(doc(db, "users", uid), {
    role: "participant" as UserRole,
    assignedEventId: deleteField(),
    assignedEventTitle: deleteField(),
  });
}

/**
 * Legacy creator for backwards compatibility if needed.
 */
export async function createSubAdmin(email: string, password: string, name: string, assignedEventId: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Must be authenticated as master admin");

  // Create a temporary secondary Firebase app to avoid switching the master admin's auth session
  const secondaryApp = initializeApp(firebaseApp.options, "sub-admin-creator-" + Date.now());
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    // Write the user document using the MAIN db instance (not the secondary one)
    await setDoc(doc(db, "users", cred.user.uid), {
      email,
      name,
      role: "sub-admin" as UserRole,
      assignedEventId,
      createdAt: serverTimestamp(),
    });
    // Sign out the secondary auth and clean up
    await firebaseSignOut(secondaryAuth);
    await deleteApp(secondaryApp);
    return { uid: cred.user.uid, email, assignedEventId };
  } catch (err) {
    // Clean up secondary app even on error
    try { await deleteApp(secondaryApp); } catch { /* ignore */ }
    throw err;
  }
}

/**
 * Real-time listener for all sub-admin users (used by Master Admin panel).
 */
export function useSubAdmins() {
  const [subAdmins, setSubAdmins] = useState<{
    uid: string;
    email: string;
    name: string;
    assignedEventId: string;
    assignedEventTitle?: string;
    createdAt: any;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "sub-admin"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setSubAdmins(
          snapshot.docs.map((d) => ({
            uid: d.id,
            email: d.data().email || "",
            name: d.data().name || "",
            assignedEventId: d.data().assignedEventId || "",
            assignedEventTitle: d.data().assignedEventTitle || "",
            createdAt: d.data().createdAt,
          })),
        );
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to sub-admins:", error);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  return { subAdmins, loading };
}

/**
 * Delete a sub-admin's Firestore user document.
 */
export async function deleteSubAdminDoc(uid: string) {
  await deleteDoc(doc(db, "users", uid));
}

/**
 * Fresh-read a user's data directly from Firestore (bypasses cache).
 * Used by the scanner to get the CURRENT assignedEventId before every check-in.
 */
export async function getFreshUserData(uid: string): Promise<{ role: UserRole; assignedEventId?: string; name: string } | null> {
  const userDoc = await getDoc(doc(db, "users", uid));
  if (!userDoc.exists()) return null;
  const data = userDoc.data();
  return {
    role: (data.role as UserRole) || "participant",
    assignedEventId: data.assignedEventId || undefined,
    name: data.name || "Unknown",
  };
}


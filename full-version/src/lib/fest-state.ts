import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { toEventSlug } from "./event-slugs";

export type FestEvent = {
  id: string;
  number: string;
  tag: string;
  tagType: string;
  title: string;
  desc: string;
  time: string;
  venue: string;
  format: string;
  prize: string;
  track: "TECH" | "NON-TECH" | "ROBOTICS";
  iconName: string;
  logoUrl?: string;
  posterUrl?: string;
  maxSlots?: number;
  slug?: string;
  registrationOpen?: boolean;
  registrationClosedMessage?: string;
  type?: string;
  reward?: string;
  // Deep Details
  fullDesc?: string;
  rules?: string[];
  coordinatorName?: string;
  coordinatorPhone?: string;
  coordinators?: Array<{ name: string; phone: string }>;
  facultyCoordinators?: Array<{ name: string; phone: string }>;
  date?: string;
  startTime?: string;
  endTime?: string;
  whatsappGroupUrl?: string;
  instagramUrl?: string;
  googleFormUrl?: string;
};

export const FEST_EVENTS: FestEvent[] = [
  {
    id: "it-quiz",
    number: "#01",
    tag: "BUILD • DEPLOY • SCALE",
    tagType: "quiz",
    title: "AWS Builder Challenge",
    desc: "Build a working solution to a real-world problem using AWS services, teamwork, creativity, and technical skills — all within two hours.",
    time: "2:15 PM - 4:15 PM",
    venue: "Lab-1,2,4",
    format: "Team of 2-3",
    prize: "25 College Credits + Certificate",
    track: "TECH",
    iconName: "HelpCircle",
    maxSlots: 5,
  },
  {
    id: "cyber-quiz",
    number: "#02",
    tag: "CODE • SWITCH • CONQUER",
    tagType: "security",
    title: "Codathon",
    desc: "A relay-style coding challenge where teamwork, adaptability, and coding skills are put to the test.",
    time: "9:00 AM - 10:00 AM",
    venue: "Auditorium Hall B",
    format: "Team of 2",
    prize: "30 College Credits + Certificate",
    track: "TECH",
    iconName: "Shield",
    maxSlots: 50,
  },
  {
    id: "py-it",
    number: "#03",
    tag: "KNOW • THINK • BUILD",
    tagType: "python",
    title: "IT Quiz",
    desc: "Test your knowledge of information technology through a fast-paced quiz covering technical concepts, logic, reasoning, and general IT knowledge.",
    time: "9:00 AM - 10:00 AM",
    venue: "Software Center Lab 1",
    format: "Individual",
    prize: "35 College Credits + Certificate",
    track: "TECH",
    iconName: "Terminal",
    maxSlots: 180,
  },
  {
    id: "ai-model-clash",
    number: "#04",
    tag: "AI / ML",
    tagType: "ai",
    title: "Cyber Quiz",
    desc: "Put your cybersecurity knowledge to the test and prove your skills through a quiz followed by a hands-on Capture the Flag challenge.",
    time: "9:00 AM - 10:00 AM",
    venue: "AIDS Computing Center",
    format: "Individual",
    prize: "45 College Credits + Trophy",
    track: "TECH",
    iconName: "Cpu",
    maxSlots: 110,
  },
  {
    id: "brick-bot-battle",
    number: "#05",
    tag: "ROBOTICS",
    tagType: "robotics",
    title: "PY-IT — Practice Your Interview Technique",
    desc: "Step into the interview arena and test your aptitude, communication, confidence, and professional skills across three challenging rounds.",
    time: "9:00 AM - 7:00 AM",
    venue: "Central Arena Ground",
    format: "Individual",
    prize: "50 College Credits + Medals",
    track: "TECH",
    iconName: "Bot",
    maxSlots: 120,
  },
  {
    id: "data-dig",
    number: "#06",
    tag: "FIND • FIX • FLY",
    tagType: "data",
    title: "Bug Buzz",
    desc: "Find the bugs. Fix the code. Beat the clock. A two-round debugging challenge designed to test speed, accuracy, and problem-solving.",
    time: "9:00 AM - 10:03 AM",
    venue: "Data Analytics Lab",
    format: "Individual",
    prize: "30 College Credits + Certificate",
    track: "TECH",
    iconName: "BarChart3",
    maxSlots: 110,
  },
  {
    id: "prompt-forge",
    number: "#07",
    tag: "GEN AI",
    tagType: "prompt",
    title: "LOGO Hunt",
    desc: "How well do you recognize the brands around you? Identify 30 logos against the clock and prove your visual recognition skills.",
    time: "9:00 AM - 10:00 AM",
    venue: "Innovation Lab 2",
    format: "Individual",
    prize: "25 College Credits + Certificate",
    track: "TECH",
    iconName: "Sparkles",
    maxSlots: 110,
  },
  {
    id: "qJacjs6i2Mu5Gxxqa4dA",
    number: "#08",
    tag: "SOLVE • CRACK • UNCOVER",
    tagType: "quiz",
    title: "DETECTIVE – THE INSIDE JOB",
    desc: "Think you can crack the case? Put your logic, observation, and teamwork to the test in a thrilling detective-themed competition! Follow the clues, uncover the truth, and find the culprit before it's too late.",
    time: "2:00 PM - 4:00 PM",
    venue: "L-02",
    format: "Individual",
    prize: "Suprise !!!",
    track: "NON-TECH",
    iconName: "HelpCircle",
    maxSlots: 150,
    googleFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSch0fRLqulLp0OSmEPgb4FjQ2a5qlZyIqTQ5LLcTevmCN5oaQ/viewform",
    logoUrl: "https://firebasestorage.googleapis.com/v0/b/converse2k26.firebasestorage.app/o/event-logos%2Ftemp-1789438674859.webp?alt=media&token=3f9db767-ba8c-4583-becd-3eb0ae9a107c",
    posterUrl: "https://firebasestorage.googleapis.com/v0/b/converse2k26.firebasestorage.app/o/event-posters%2Ftemp-1789438684132.webp?alt=media&token=dddd1d3b-068e-43dc-bbe7-0dad8839d985",
  },
  {
    id: "xF5MwVpca6vMl7Yzq0AN",
    number: "#09",
    tag: "BID • STRATEGIZE • WIN",
    tagType: "quiz",
    title: "IPL AUCTION",
    desc: "Step into the world of IPL franchise management! Form your team, manage your ₹ 60 Crore purse, compete in intense player bidding, and build the perfect 6-player squad.",
    time: "10:00 AM - 12:00 PM",
    venue: "L-03",
    format: "Team of 3-4",
    prize: "Cash price for the winning team",
    track: "NON-TECH",
    iconName: "HelpCircle",
    maxSlots: 200,
    googleFormUrl: "https://forms.gle/wCxwaTy1qpHee4aRA",
    posterUrl: "https://firebasestorage.googleapis.com/v0/b/converse2k26.firebasestorage.app/o/event-posters%2Ftemp-1789439369126.webp?alt=media&token=56d7104b-9c78-4baf-b361-0292a5d1ef29",
  },
];

// Profile state is now managed entirely via Firestore (firebase-auth.ts)

const STORAGE_KEY_BASE = "converse_2026_registered_events";

// Clean up old shared key that leaked across accounts
if (typeof window !== "undefined") {
  try { localStorage.removeItem(STORAGE_KEY_BASE); } catch {}
}

export function useFestState(uid?: string, email?: string | null) {
  const storageKey = uid ? `${STORAGE_KEY_BASE}_${uid}` : null;

  const [registeredIds, setRegisteredIds] = useState<string[]>(() => {
    if (typeof window === "undefined" || !storageKey) return [];
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Re-read localStorage when the uid (storageKey) changes
  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) {
      setRegisteredIds([]);
      return;
    }
    try {
      const saved = localStorage.getItem(storageKey);
      setRegisteredIds(saved ? JSON.parse(saved) : []);
    } catch {
      setRegisteredIds([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (registeredIds.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(registeredIds));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {}
  }, [registeredIds, storageKey]);

  // Real-time Firestore sync: ensures registered status updates immediately from database
  useEffect(() => {
    if (!uid) return;

    let leaderIds: string[] = [];
    let teammateIds: string[] = [];
    let emailIds: string[] = [];

    const syncState = () => {
      // Direct synchronization with Firestore documents (never keep stale removed registrations)
      const dbIds = Array.from(
        new Set([...leaderIds, ...teammateIds, ...emailIds])
      );
      setRegisteredIds(dbIds);
      if (storageKey) {
        try {
          if (dbIds.length > 0) {
            localStorage.setItem(storageKey, JSON.stringify(dbIds));
          } else {
            localStorage.removeItem(storageKey);
          }
        } catch {}
      }
    };

    const q1 = query(collection(db, "registrations"), where("userId", "==", uid));
    const unsub1 = onSnapshot(q1, (snap) => {
      leaderIds = snap.docs.map((d) => d.data().eventId).filter(Boolean);
      syncState();
    }, () => {});

    const q2 = query(collection(db, "registrations"), where("teamMemberUids", "array-contains", uid));
    const unsub2 = onSnapshot(q2, (snap) => {
      teammateIds = snap.docs.map((d) => d.data().eventId).filter(Boolean);
      syncState();
    }, () => {});

    let unsub3 = () => {};
    let unsub4 = () => {};
    let unsub5 = () => {};
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      let directIds: string[] = [];
      let leaderEmailIds: string[] = [];
      let arrayEmailIds: string[] = [];

      const syncEmailState = () => {
        emailIds = Array.from(new Set([...directIds, ...leaderEmailIds, ...arrayEmailIds]));
        syncState();
      };

      const q3 = query(collection(db, "registrations"), where("userEmail", "==", cleanEmail));
      unsub3 = onSnapshot(q3, (snap) => {
        directIds = snap.docs.map((d) => d.data().eventId).filter(Boolean);
        syncEmailState();
      }, () => {});

      const q4 = query(collection(db, "registrations"), where("leaderEmail", "==", cleanEmail));
      unsub4 = onSnapshot(q4, (snap) => {
        leaderEmailIds = snap.docs.map((d) => d.data().eventId).filter(Boolean);
        syncEmailState();
      }, () => {});

      const q5 = query(collection(db, "registrations"), where("teamMemberEmails", "array-contains", cleanEmail));
      unsub5 = onSnapshot(q5, (snap) => {
        arrayEmailIds = snap.docs.map((d) => d.data().eventId).filter(Boolean);
        syncEmailState();
      }, () => {});
    }

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
    };
  }, [uid, email, storageKey]);

  const registerEvent = (id: string) => {
    setRegisteredIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const unregisterEvent = (id: string) => {
    setRegisteredIds((prev) => prev.filter((item) => item !== id));
  };

  const isRegistered = (id: string) => {
    return registeredIds.includes(id);
  };

  const registeredEvents = FEST_EVENTS.filter((e) => isRegistered(e.id));

  return {
    registeredIds,
    registeredEvents,
    registerEvent,
    unregisterEvent,
    isRegistered,
    totalCount: FEST_EVENTS.length,
    registeredCount: registeredIds.length,
    progressPercent: Math.round((registeredIds.length / FEST_EVENTS.length) * 100),
  };
}

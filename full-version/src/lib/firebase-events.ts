import { useState, useEffect } from "react";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { FestEvent } from "./fest-state";

/**
 * Real-time listener for Firestore `events` collection.
 * Replaces the hardcoded FEST_EVENTS array.
 */
export function useFirestoreEvents() {
  const [events, setEvents] = useState<FestEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "events"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as FestEvent[];
        setEvents(docs);
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to events:", error);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  return { events, loading };
}

export async function createEvent(event: Omit<FestEvent, "id">) {
  const docRef = await addDoc(collection(db, "events"), {
    ...event,
    registrationOpen: true,
    maxSlots: 100,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateEvent(eventId: string, fields: Partial<FestEvent> & Record<string, any>) {
  await setDoc(doc(db, "events", eventId), {
    ...fields,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function deleteEvent(eventId: string) {
  await deleteDoc(doc(db, "events", eventId));
}

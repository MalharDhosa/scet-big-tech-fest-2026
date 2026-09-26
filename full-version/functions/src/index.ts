import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";

admin.initializeApp();

// SMTP config — connection pooling to avoid Gmail rate limits
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  pool: true,
  maxConnections: 1,
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 2,
  auth: {
    user: "converseit@scet.ac.in",
    pass: "lqddxgwkvaubgfrp",
  },
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Interface for what the client sends
interface SendReminderData {
  targetAudience: "all" | "specific" | string;
  subject: string;
  template: string;
  specificEmails?: string[];
  campaignId?: string; // For real-time progress tracking
}

export const sendManualEventReminder = onCall({ timeoutSeconds: 1800, memory: "512MiB" }, async (request) => {
  if (!request.auth) {
    throw new Error("Unauthenticated");
  }
  const db = getFirestore();
  const callerDoc = await db.collection("users").doc(request.auth.uid).get();
  if (callerDoc.data()?.role !== "admin" && callerDoc.data()?.role !== "master") {
    throw new Error("Permission denied. Must be an admin.");
  }

  const { targetAudience, subject, template, specificEmails, campaignId } = request.data as SendReminderData;
  if (!subject || !template) {
    throw new Error("Subject and template are required");
  }

  // Progress tracking doc
  const progressRef = campaignId ? db.collection("emailProgress").doc(campaignId) : null;
  const updateProgress = async (sent: number, total: number, status: string) => {
    if (progressRef) {
      await progressRef.set({ sent, total, status, updatedAt: new Date().toISOString() }, { merge: true });
    }
  };

  let usersToEmail: any[] = [];

  if (targetAudience === "specific" && specificEmails && specificEmails.length > 0) {
    const emailSet = new Set(specificEmails.map(e => e.toLowerCase().trim()));
    const usersSnap = await db.collection("users").get();
    usersToEmail = usersSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((u: any) => u.email && emailSet.has(u.email.toLowerCase()));
    
    const foundEmails = new Set(usersToEmail.map((u: any) => u.email.toLowerCase()));
    for (const email of emailSet) {
      if (!foundEmails.has(email)) {
        usersToEmail.push({ id: "", email, name: "" });
      }
    }
  } else if (targetAudience === "all") {
    const usersSnap = await db.collection("users").get();
    usersToEmail = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else if (targetAudience === "all_events") {
    // All users who personally registered for at least one event
    const allRegsSnap = await db.collection("registrations").get();
    const userIds = new Set<string>();
    allRegsSnap.docs.forEach(d => {
      const data = d.data();
      if (data.userId) userIds.add(data.userId);
    });
    for (const uid of Array.from(userIds)) {
      const userDoc = await db.collection("users").doc(uid).get();
      if (userDoc.exists) {
        usersToEmail.push({ id: userDoc.id, ...userDoc.data() });
      }
    }
  } else {
    // Specific event — include leaders + all team members
    const eventId = targetAudience.startsWith("event_") ? targetAudience.slice(6) : targetAudience;
    const registrationsSnap = await db.collection("registrations").where("eventId", "==", eventId).get();
    const userIds = new Set<string>();
    registrationsSnap.docs.forEach(d => {
      const data = d.data();
      if (data.userId) userIds.add(data.userId);
      if (data.teamMemberUids && Array.isArray(data.teamMemberUids)) {
        data.teamMemberUids.forEach((uid: string) => { if (uid) userIds.add(uid); });
      }
    });
    for (const uid of Array.from(userIds)) {
      const userDoc = await db.collection("users").doc(uid).get();
      if (userDoc.exists) {
        usersToEmail.push({ id: userDoc.id, ...userDoc.data() });
      }
    }
  }

  if (usersToEmail.length === 0) {
    return { success: true, count: 0 };
  }

  // ─── PRE-FETCH all registrations and events in bulk (2 queries total) ───
  const needsEvents = template.includes("[Participated Events]") || template.includes("[WhatsApp Links]") || template.includes("[My Events]");

  // Build per-user event map: userId → Set of eventIds
  const userEventMap = new Map<string, Set<string>>();
  // Event data cache: eventId → event doc data
  const eventCache: Record<string, any> = {};

  if (needsEvents) {
    // Single query: fetch ALL registrations
    const allRegsSnap = await db.collection("registrations").get();
    for (const d of allRegsSnap.docs) {
      const data = d.data();
      const eventId = data.eventId;
      if (!eventId) continue;

      // Leader
      if (data.userId) {
        if (!userEventMap.has(data.userId)) userEventMap.set(data.userId, new Set());
        userEventMap.get(data.userId)!.add(eventId);
      }
      // Team members
      if (data.teamMemberUids && Array.isArray(data.teamMemberUids)) {
        for (const uid of data.teamMemberUids) {
          if (!uid) continue;
          if (!userEventMap.has(uid)) userEventMap.set(uid, new Set());
          userEventMap.get(uid)!.add(eventId);
        }
      }
    }

    // Single query: fetch ALL events
    const allEventsSnap = await db.collection("events").get();
    for (const d of allEventsSnap.docs) {
      eventCache[d.id] = d.data();
    }
  }

  const total = usersToEmail.filter(u => u.email).length;
  await updateProgress(0, total, "sending");

  let count = 0;
  const errors: string[] = [];
  const sentEmails: string[] = [];
  const failedEmails: string[] = [];

  for (const user of usersToEmail) {
    const email = user.email;
    if (!email) continue;

    let participatedEventNames: string[] = [];
    let whatsappLinks: string[] = [];
    let myEventsDetails: string[] = [];

    if (needsEvents && user.id) {
      // Use pre-fetched map — NO additional Firestore queries!
      const userEvents = userEventMap.get(user.id);
      if (userEvents) {
        for (const eid of userEvents) {
          const ev = eventCache[eid];
          if (ev) {
            const title = ev.title || eid;
            participatedEventNames.push(title);

            if (ev.whatsappGroupUrl) {
              whatsappLinks.push(`${title}: ${ev.whatsappGroupUrl}`);
            }

            let detail = `• ${title}`;
            if (ev.date) detail += `\n  Date: ${ev.date}`;
            if (ev.time) detail += `\n  Time: ${ev.time}`;
            if (ev.venue) detail += `\n  Venue: ${ev.venue}`;
            if (ev.whatsappGroupUrl) detail += `\n  WhatsApp: ${ev.whatsappGroupUrl}`;
            myEventsDetails.push(detail);
          }
        }
      }
    }

    const eventsStr = participatedEventNames.length > 0 ? participatedEventNames.join(", ") : "None";
    const whatsappStr = whatsappLinks.length > 0 ? whatsappLinks.join("\n") : "No WhatsApp group links available";
    const myEventsStr = myEventsDetails.length > 0 ? myEventsDetails.join("\n\n") : "No events registered";

    let emailText = template;
    // User profile variables
    emailText = emailText.replace(/\[Participant Name\]/g, user.name || "Participant");
    emailText = emailText.replace(/\[Email\]/g, user.email || "");
    emailText = emailText.replace(/\[College Name\]/g, user.collegeName || user.college || "");
    emailText = emailText.replace(/\[Branch\]/g, user.branch || "");
    emailText = emailText.replace(/\[Year\]/g, user.year || "");
    emailText = emailText.replace(/\[Semester\]/g, user.semester || "");
    emailText = emailText.replace(/\[Enrollment\]/g, user.enrollmentNumber || "");
    // Per-user event variables
    emailText = emailText.replace(/\[Participated Events\]/g, eventsStr);
    emailText = emailText.replace(/\[WhatsApp Links\]/g, whatsappStr);
    emailText = emailText.replace(/\[My Events\]/g, myEventsStr);

    // Target event-specific variables (only work when targeting a specific event)
    let eventName = "All Events";
    let eventDate = "";
    let eventTime = "";
    let eventVenue = "";
    let googleFormUrl = "";
    const resolvedEventId = targetAudience.startsWith("event_") ? targetAudience.slice(6) : targetAudience;
    if (targetAudience !== "all" && targetAudience !== "specific") {
      const targetEventData = eventCache[resolvedEventId];
      if (targetEventData) {
        eventName = targetEventData.title || eventName;
        eventDate = targetEventData.date || "";
        eventTime = targetEventData.time || "";
        eventVenue = targetEventData.venue || "";
        googleFormUrl = targetEventData.googleFormUrl || "";
      }
    }
    emailText = emailText.replace(/\[Event Name\]/g, eventName);
    emailText = emailText.replace(/\[Event Date\]/g, eventDate);
    emailText = emailText.replace(/\[Event Time\]/g, eventTime);
    emailText = emailText.replace(/\[Event Venue\]/g, eventVenue);
    emailText = emailText.replace(/\[Google Form URL\]/g, googleFormUrl);

    try {
      await transporter.sendMail({
        from: `"CONVERSE 2K26" <converseit@scet.ac.in>`,
        to: email,
        subject: subject,
        text: emailText,
      });
      count++;
      sentEmails.push(email);
      // Update progress every 5 emails
      if (count % 5 === 0 || count === total) {
        await updateProgress(count, total, "sending");
      }
      // Small delay to avoid Gmail rate limiting
      await delay(500);
    } catch (err: any) {
      errors.push(`${email}: ${err.message}`);
      failedEmails.push(email);
      // If rate limited, wait longer before retrying
      if (err.message && err.message.includes("Too many")) {
        await delay(10000); // Wait 10 seconds on rate limit
      }
    }
  }

  // Save full results to progress doc
  await updateProgress(count, total, "done");
  if (progressRef) {
    await progressRef.set({
      sentEmails: sentEmails.slice(0, 500),
      failedEmails,
      totalSent: count,
      totalFailed: errors.length,
    }, { merge: true });
  }

  return { success: true, count, totalFailed: errors.length, errors: errors.length > 0 ? errors.slice(0, 10) : undefined };
});

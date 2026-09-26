import { collection, doc, getDocs, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { toEventSlug } from "./event-slugs";
import { FEST_EVENTS, type FestEvent } from "./fest-state";
import { doesRegistrationMatchEvent, type Registration } from "./firebase-registrations";

export type ParsedRegistrationRow = {
  raw: Record<string, string>;
  name: string;
  email: string;
  phone: string;
  dept: string;
  enrollmentNumber: string;
  eventTitle: string;
  matchedEvent: FestEvent | null;
  teamName: string;
  teammatesRaw: string;
  status: "valid" | "duplicate" | "invalid";
  statusReason: string;
};

export type ImportStats = {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
};

/**
 * Robust RFC-4180 compliant CSV / TSV parser that supports:
 * - Tab-separated values (direct copy-paste from Google Sheets / Excel)
 * - Comma-separated values
 * - Double-quoted cells with embedded commas, tabs, and quotes
 * - Windows (\r\n) and Unix (\n) line breaks
 */
export function parseSpreadsheetText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  if (!text || !text.trim()) {
    return { headers: [], rows: [] };
  }

  // Detect delimiter: if line contains tabs, it's likely copied from Google Sheets / Excel
  const firstLine = text.split(/\r?\n/)[0] || "";
  const delimiter = firstLine.includes("\t") ? "\t" : ",";

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      currentRow.push(currentCell.trim());
      currentCell = "";
      if (currentRow.some((c) => c !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += char;
    }
  }

  // Push last remaining cell and row if any
  if (currentCell !== "" || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== "")) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1);

  const parsedObjects: Record<string, string>[] = [];

  for (const row of dataRows) {
    const obj: Record<string, string> = {};
    for (let h = 0; h < rawHeaders.length; h++) {
      const headerKey = rawHeaders[h] || `Column_${h + 1}`;
      obj[headerKey] = (row[h] || "").trim();
    }
    parsedObjects.push(obj);
  }

  return { headers: rawHeaders, rows: parsedObjects };
}

/**
 * Smart field detector that finds the best matching column key from various common Google Forms/Sheets headers.
 */
export function findColumnKey(headers: string[], patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const found = headers.find((h) => pattern.test(h.toLowerCase().trim()));
    if (found) return found;
  }
  return null;
}

/**
 * Maps arbitrary column headers into standardized registration fields.
 */
export function detectColumnMapping(headers: string[]) {
  return {
    nameKey: findColumnKey(headers, [
      /^name$/i,
      /^full\s*name/i,
      /^student\s*name/i,
      /^participant\s*name/i,
      /name/i,
    ]),
    emailKey: findColumnKey(headers, [
      /^email$/i,
      /^email\s*address/i,
      /^student\s*email/i,
      /^gmail/i,
      /email/i,
    ]),
    phoneKey: findColumnKey(headers, [
      /^phone$/i,
      /^mobile$/i,
      /^contact/i,
      /^phone\s*no/i,
      /^mobile\s*no/i,
      /^whatsapp/i,
      /phone/i,
      /mobile/i,
    ]),
    deptKey: findColumnKey(headers, [
      /^dept$/i,
      /^department/i,
      /^branch/i,
      /^stream/i,
      /dept/i,
      /branch/i,
    ]),
    enrollmentKey: findColumnKey(headers, [
      /^enrollment$/i,
      /^enrollment\s*no/i,
      /^enrollment\s*number/i,
      /^roll\s*no/i,
      /^id/i,
      /enrollment/i,
    ]),
    eventKey: findColumnKey(headers, [
      /^event$/i,
      /^event\s*name/i,
      /^event\s*title/i,
      /^registered\s*event/i,
      /^selected\s*event/i,
      /event/i,
    ]),
    teamNameKey: findColumnKey(headers, [
      /^team\s*name/i,
      /^team$/i,
      /^group\s*name/i,
      /team/i,
    ]),
    teammatesKey: findColumnKey(headers, [
      /^teammate/i,
      /^teammates/i,
      /^team\s*members/i,
      /^partner/i,
      /^member\s*2/i,
      /teammate/i,
      /partner/i,
    ]),
  };
}

/**
 * Match a raw event string against the festival's event catalog.
 */
export function resolveEvent(rawInput: string, eventsList: FestEvent[]): FestEvent | null {
  if (!rawInput || !rawInput.trim()) return null;
  const cleanInput = rawInput.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  const inputSlug = toEventSlug(rawInput);

  // 1. Direct title match FIRST, then direct ID or slug match
  for (const ev of eventsList) {
    if (ev.title.toLowerCase().trim() === rawInput.toLowerCase().trim()) return ev;
  }
  for (const ev of eventsList) {
    if (ev.id.toLowerCase().trim() === rawInput.toLowerCase().trim()) return ev;
    if (toEventSlug(ev.title) === inputSlug || toEventSlug(ev.id) === inputSlug) return ev;
  }

  // 2. Normalized alphanumeric match
  for (const ev of eventsList) {
    const cleanEvId = ev.id.toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanEvTitle = ev.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleanEvId === cleanInput || cleanEvTitle === cleanInput) return ev;
  }

  // 3. Substring match
  for (const ev of eventsList) {
    const cleanEvTitle = ev.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleanEvTitle.includes(cleanInput) || cleanInput.includes(cleanEvTitle)) {
      return ev;
    }
  }

  return null;
}

/**
 * Analyze parsed spreadsheet rows against existing registrations in Firestore.
 */
export async function analyzeRegistrationRows(
  rows: Record<string, string>[],
  mapping: ReturnType<typeof detectColumnMapping>,
  eventsList: FestEvent[],
  defaultEventId?: string
): Promise<{ analyzedRows: ParsedRegistrationRow[]; stats: ImportStats }> {
  // Fetch existing registrations to check for duplicates
  const existingRegsSnap = await getDocs(collection(db, "registrations"));
  const existingRegs: Registration[] = existingRegsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as Registration)
  );

  const defaultEvent = defaultEventId
    ? eventsList.find((e) => e.id === defaultEventId) || null
    : null;

  const analyzedRows: ParsedRegistrationRow[] = [];
  const processedKeysInCurrentBatch = new Set<string>();

  for (const r of rows) {
    const name = (mapping.nameKey ? r[mapping.nameKey] : "") || "";
    const email = (mapping.emailKey ? r[mapping.emailKey] : "") || "";
    const phone = (mapping.phoneKey ? r[mapping.phoneKey] : "") || "";
    const dept = (mapping.deptKey ? r[mapping.deptKey] : "") || "";
    const enrollmentNumber = (mapping.enrollmentKey ? r[mapping.enrollmentKey] : "") || "";
    const rawEvent = (mapping.eventKey ? r[mapping.eventKey] : "") || "";
    const teamName = (mapping.teamNameKey ? r[mapping.teamNameKey] : "") || "";
    const teammatesRaw = (mapping.teammatesKey ? r[mapping.teammatesKey] : "") || "";

    const matchedEvent = resolveEvent(rawEvent, eventsList) || defaultEvent;

    let status: "valid" | "duplicate" | "invalid" = "valid";
    let statusReason = "Ready to import";

    if (!name.trim()) {
      status = "invalid";
      statusReason = "Missing participant name";
    } else if (!email.trim() || !email.includes("@")) {
      status = "invalid";
      statusReason = "Missing or invalid email address";
    } else if (!matchedEvent) {
      status = "invalid";
      statusReason = "Event could not be resolved (specify an Event column or select a default event)";
    } else {
      const cleanEmail = email.toLowerCase().trim();
      const eventSlug = toEventSlug(matchedEvent.title || matchedEvent.id);
      const batchKey = `${cleanEmail}___${eventSlug}`;

      // Check duplicate within the same uploaded file
      if (processedKeysInCurrentBatch.has(batchKey)) {
        status = "duplicate";
        statusReason = "Duplicate entry within this file";
      } else {
        processedKeysInCurrentBatch.add(batchKey);

        // Check duplicate against existing Firestore database
        const isAlreadyInDb = existingRegs.some((existing) => {
          const userMatches =
            existing.userEmail?.toLowerCase().trim() === cleanEmail ||
            existing.teamMemberEmails?.some((te) => te.toLowerCase().trim() === cleanEmail);
          if (!userMatches) return false;
          return doesRegistrationMatchEvent(existing, matchedEvent);
        });

        if (isAlreadyInDb) {
          status = "duplicate";
          statusReason = `Already registered for ${matchedEvent.title} in database`;
        }
      }
    }

    analyzedRows.push({
      raw: r,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      dept: dept.trim(),
      enrollmentNumber: enrollmentNumber.trim(),
      eventTitle: matchedEvent?.title || rawEvent,
      matchedEvent,
      teamName: teamName.trim(),
      teammatesRaw: teammatesRaw.trim(),
      status,
      statusReason,
    });
  }

  const stats: ImportStats = {
    totalRows: analyzedRows.length,
    validRows: analyzedRows.filter((r) => r.status === "valid").length,
    duplicateRows: analyzedRows.filter((r) => r.status === "duplicate").length,
    invalidRows: analyzedRows.filter((r) => r.status === "invalid").length,
  };

  return { analyzedRows, stats };
}

/**
 * Cryptographic QR token generator for imported passes (CON26:{eventId}:{hash}).
 */
async function generateImportQrToken(emailOrUid: string, eventId: string): Promise<string> {
  const salt = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const payload = `${emailOrUid}:${eventId}:${Date.now()}:${salt}`;

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoded = new TextEncoder().encode(payload);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return `CON26:${eventId}:${hash}`;
  }

  // Simple deterministic fallback hash
  let h = 0;
  for (let i = 0; i < payload.length; i++) {
    h = (h << 5) - h + payload.charCodeAt(i);
    h = h & h;
  }
  return `CON26:${eventId}:${Math.abs(h).toString(16)}${salt}`;
}

/**
 * 6-character alphanumeric entry code generator (easy to read, no I/O/0/1).
 */
function generateImportEntryCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Execute batch import into Firestore.
 */
export async function executeBulkImport(
  validRows: ParsedRegistrationRow[],
  onProgress?: (current: number, total: number) => void
): Promise<{ successCount: number; errorCount: number; errors: string[] }> {
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Pre-fetch all user documents to link account UIDs if they already exist
  const usersSnap = await getDocs(collection(db, "users"));
  const emailToUidMap = new Map<string, string>();
  usersSnap.docs.forEach((d) => {
    const uData = d.data();
    if (uData.email) {
      emailToUidMap.set(uData.email.toLowerCase().trim(), d.id);
    }
  });

  const total = validRows.length;

  for (let idx = 0; idx < total; idx++) {
    const row = validRows[idx];
    if (!row.matchedEvent) continue;

    try {
      const cleanEmail = row.email.toLowerCase().trim();
      const eventSlug = toEventSlug(row.matchedEvent.title || row.matchedEvent.id);
      const existingUid = emailToUidMap.get(cleanEmail);
      const userId = existingUid || `sheet_${cleanEmail.replace(/[^a-z0-9]/g, "_")}`;
      const deterministicDocId = `${userId}_${eventSlug}`;

      // Check if non-tech
      const cleanTrack = (row.matchedEvent.track || "").toUpperCase().replace(/[\s-]/g, "");
      const isNonTech = cleanTrack === "NONTECH" || cleanTrack === "NON" || cleanTrack.includes("NON");

      const qrToken = isNonTech ? "" : await generateImportQrToken(userId, row.matchedEvent.id);
      const entryCode = isNonTech ? "" : generateImportEntryCode();

      // Parse teammates if provided
      const teammatesList: Array<{ uid: string; name: string; email: string }> = [];
      const teamEmails: string[] = [cleanEmail];

      if (row.teammatesRaw) {
        const rawMembers = row.teammatesRaw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
        for (const rawM of rawMembers) {
          const emailMatch = rawM.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          const tEmail = emailMatch ? emailMatch[1].toLowerCase().trim() : "";
          const tName = rawM.replace(/\(.*?\)/g, "").replace(tEmail, "").trim() || "Teammate";
          if (tEmail) teamEmails.push(tEmail);
          teammatesList.push({
            uid: tEmail ? emailToUidMap.get(tEmail) || `t_${tEmail.replace(/[^a-z0-9]/g, "_")}` : `t_${Math.random().toString(36).slice(2, 8)}`,
            name: tName,
            email: tEmail,
          });
        }
      }

      const regDocRef = doc(db, "registrations", deterministicDocId);
      await setDoc(regDocRef, {
        userId,
        eventId: row.matchedEvent.id,
        eventTitle: row.matchedEvent.title,
        track: isNonTech ? "NON-TECH" : (row.matchedEvent.track || "TECH"),
        isNonTech,
        userName: row.name,
        userEmail: cleanEmail,
        userPhone: row.phone || "",
        userDept: row.dept || "",
        enrollmentNumber: row.enrollmentNumber || "",
        leaderUid: userId,
        leaderName: row.name,
        leaderEmail: cleanEmail,
        leaderPhone: row.phone || "",
        teamName: row.teamName || (teammatesList.length > 0 ? `${row.name}'s Team` : ""),
        teammates: teammatesList,
        teamMemberUids: [userId, ...teammatesList.map((t) => t.uid)],
        teamMemberEmails: teamEmails,
        partnerName: row.teammatesRaw || "",
        qrToken,
        entryCode,
        checkedIn: false,
        checkedInAt: null,
        registeredAt: serverTimestamp(),
        source: "google_sheets_bulk_import",
      });

      successCount++;
    } catch (err: any) {
      console.error("Failed to import row:", row.name, err);
      errorCount++;
      errors.push(`${row.name} (${row.email}): ${err.message || "Unknown error"}`);
    }

    if (onProgress) {
      onProgress(idx + 1, total);
    }
  }

  return { successCount, errorCount, errors };
}

/**
 * Generate and trigger download of a sample CSV template for staff/coordinators.
 */
export function downloadSampleCsvTemplate() {
  const headers = [
    "Full Name",
    "Student Email",
    "Phone Number",
    "Department",
    "Enrollment No",
    "Event Name",
    "Team Name",
    "Teammates",
  ];

  const sampleRows = [
    [
      "Sagar Isamaliya",
      "sagar.isamaliya@scet.ac.in",
      "9876543210",
      "IT",
      "220120116001",
      "PY-IT",
      "",
      "",
    ],
    [
      "Meet Patel",
      "meet.patel@scet.ac.in",
      "9876543211",
      "AI&DS",
      "220120116045",
      "Codathon",
      "",
      "",
    ],
    [
      "Aarav Shah",
      "aarav.shah@scet.ac.in",
      "9876543212",
      "IT",
      "220120116089",
      "IT Quiz",
      "Quiz Masters",
      "Rohan Mehta (rohan@scet.ac.in), Diya Dave (diya@scet.ac.in)",
    ],
  ];

  const csvContent = [
    headers.join(","),
    ...sampleRows.map((row) =>
      row.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "comverse_2k26_registration_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

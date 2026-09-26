import type { FestEvent } from "./fest-state";
import type { ReminderSettings } from "./firebase-site-config";

/**
 * Format a Date object to iCalendar / Google Calendar compact timestamp string.
 * Format: YYYYMMDDTHHmm00
 */
export function formatCalendarDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const mins = pad(date.getMinutes());
  return `${year}${month}${day}T${hours}${mins}00`;
}

/**
 * Parses event date and time strings into start & end Date objects.
 * Supports strings like "11:45 AM - 01:15 PM" and dates like "2026-04-26" or "Apr 26, 2026".
 */
export function parseEventDates(event: FestEvent): { start: Date; end: Date } {
  // Base date defaults to CONVERSE 2K26 Day 1: April 26, 2026
  let baseDate = new Date(2026, 3, 26); // Note month is 0-indexed: 3 = April

  if (event.date) {
    const parsed = new Date(event.date);
    if (!isNaN(parsed.getTime())) {
      baseDate = parsed;
    }
  }

  const start = new Date(baseDate);
  const end = new Date(baseDate);

  // Default default start: 10:00 AM, end: 12:00 PM
  start.setHours(10, 0, 0, 0);
  end.setHours(12, 0, 0, 0);

  // If event has explicit startTime / endTime (e.g. "11:45", "13:15")
  if (event.startTime) {
    const parts = event.startTime.split(":");
    if (parts.length >= 2) {
      start.setHours(parseInt(parts[0] || "10", 10), parseInt(parts[1] || "0", 10), 0, 0);
    }
  }

  if (event.endTime) {
    const parts = event.endTime.split(":");
    if (parts.length >= 2) {
      end.setHours(parseInt(parts[0] || "12", 10), parseInt(parts[1] || "0", 10), 0, 0);
    }
  } else if (event.time) {
    // Parse time range like "11:45 AM - 01:15 PM" or "02:15 PM"
    const match = event.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?(?:\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i);
    if (match) {
      let startH = parseInt(match[1] || "10", 10);
      const startM = parseInt(match[2] || "0", 10);
      const startAmpm = (match[3] || "").toUpperCase();

      if (startAmpm === "PM" && startH < 12) startH += 12;
      if (startAmpm === "AM" && startH === 12) startH = 0;
      start.setHours(startH, startM, 0, 0);

      if (match[4]) {
        let endH = parseInt(match[4] || "12", 10);
        const endM = parseInt(match[5] || "0", 10);
        const endAmpm = (match[6] || startAmpm).toUpperCase();

        if (endAmpm === "PM" && endH < 12) endH += 12;
        if (endAmpm === "AM" && endH === 12) endH = 0;
        end.setHours(endH, endM, 0, 0);
      } else {
        // Default 2-hour duration if no end time specified
        end.setTime(start.getTime() + 2 * 60 * 60 * 1000);
      }
    }
  }

  // Ensure end is always after start
  if (end.getTime() <= start.getTime()) {
    end.setTime(start.getTime() + 2 * 60 * 60 * 1000);
  }

  return { start, end };
}

/**
 * Builds the Google Calendar URL with reminder lead time and daily notifications.
 */
export function generateGoogleCalendarUrl(
  event: FestEvent,
  settings?: ReminderSettings
): string {
  const { start, end } = parseEventDates(event);
  const startStr = formatCalendarDate(start);
  const endStr = formatCalendarDate(end);

  const prefix = settings?.calendarTitlePrefix ?? "CONVERSE 2K26: ";
  const title = `${prefix}${event.title}`;

  const leadMins = settings?.leadTimeMinutes ?? 60;
  const leadHours = Math.round(leadMins / 60);
  const leadLabel = leadMins >= 60 ? `${leadHours} hour${leadHours > 1 ? "s" : ""}` : `${leadMins} minutes`;

  const venue = event.venue ? `${event.venue}, SCET Campus` : "SCET Campus, Surat";
  const customNotes = settings?.calendarDescriptionTemplate || 
    "Official CONVERSE 2K26 SCET Tech Fest Event. Please report 15 minutes before start time with your QR entry pass.";

  const details = [
    customNotes,
    "",
    `⏰ Event Time: ${event.time || "Scheduled at fest"}`,
    `📍 Venue: ${venue}`,
    `🏷 Track: ${event.track} Track · ${event.format}`,
    "",
    `🔔 Reminders Active:`,
    `• ${leadLabel} before event start`,
    settings?.dailyReminderEnabled ? `• Daily reminder notification leading up to the fest` : null,
    "",
    `Official Fest Portal: https://itaiconverse.in`,
  ].filter(Boolean).join("\n");

  let url = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${startStr}/${endStr}` +
    `&details=${encodeURIComponent(details)}` +
    `&location=${encodeURIComponent(venue)}`;

  // If daily reminder recurrence is enabled, add RRULE until fest end date
  if (settings?.dailyReminderEnabled) {
    // Recurrence rule: repeats daily until end of event day
    const untilDate = formatCalendarDate(new Date(end.getTime() + 24 * 60 * 60 * 1000)).slice(0, 8);
    url += `&recur=${encodeURIComponent(`RRULE:FREQ=DAILY;UNTIL=${untilDate}T235959Z`)}`;
  }

  return url;
}

/**
 * Generates an RFC 5545 compliant .ics (iCalendar) file string with VALARM reminder triggers.
 */
export function generateIcsFileContent(
  event: FestEvent,
  settings?: ReminderSettings
): string {
  const { start, end } = parseEventDates(event);
  const startStr = formatCalendarDate(start);
  const endStr = formatCalendarDate(end);
  const nowStr = formatCalendarDate(new Date());

  const prefix = settings?.calendarTitlePrefix ?? "CONVERSE 2K26: ";
  const title = `${prefix}${event.title}`;
  const venue = event.venue ? `${event.venue}, SCET Campus` : "SCET Campus, Surat";
  const leadMins = settings?.leadTimeMinutes ?? 60;

  const description = (
    (settings?.calendarDescriptionTemplate || "Official CONVERSE 2K26 SCET Tech Fest Event.") +
    `\\n\\nVenue: ${venue}\\nTime: ${event.time || ""}\\nTrack: ${event.track} Track`
  ).replace(/\n/g, "\\n");

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CONVERSE 2K26//SCET Tech Fest//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:converse-2026-${event.id}-${Date.now()}@itaiconverse.in`,
    `DTSTAMP:${nowStr}Z`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${venue}`,
    "STATUS:CONFIRMED",
    // Alarm 1: Configured lead time (Default: 1 hour = 60 mins before start)
    "BEGIN:VALARM",
    `TRIGGER:-PT${leadMins}M`,
    "ACTION:DISPLAY",
    `DESCRIPTION:Reminder: ${event.title} starts in ${leadMins} minutes!`,
    "END:VALARM",
  ];

  // Alarm 2: 1-Day Advance Reminder if daily reminders are enabled
  if (settings?.dailyReminderEnabled) {
    icsLines.push(
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      `DESCRIPTION:Daily Alert: ${event.title} is tomorrow at CONVERSE 2K26!`,
      "END:VALARM"
    );
  }

  icsLines.push("END:VEVENT", "END:VCALENDAR");

  return icsLines.join("\r\n");
}

/**
 * Triggers a download of the .ics calendar file for mobile phone calendars (Apple Calendar / Google Calendar).
 */
export function downloadIcsFile(event: FestEvent, settings?: ReminderSettings) {
  const icsContent = generateIcsFileContent(event, settings);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const filename = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-converse-reminder.ics`;

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * Primary action: Launches Google Calendar in a new tab with pre-filled reminders.
 */
export function openGoogleCalendar(event: FestEvent, settings?: ReminderSettings): Window | null {
  const url = generateGoogleCalendarUrl(event, settings);
  return window.open(url, "_blank", "noopener,noreferrer");
}

import { useState } from "react";
import type { FestEvent } from "@/lib/fest-state";
import type { ReminderSettings } from "@/lib/firebase-site-config";
import { openGoogleCalendar, downloadIcsFile } from "@/lib/calendar-reminders";
import { 
  CalendarPlus, 
  Download, 
  CheckCircle2, 
  Bell, 
  Clock, 
  MapPin, 
  X, 
  QrCode,
  Sparkles,
  Smartphone
} from "lucide-react";

interface RegistrationCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: FestEvent;
  settings?: ReminderSettings;
  onViewPass?: () => void;
}

export function RegistrationCalendarModal({
  isOpen,
  onClose,
  event,
  settings,
  onViewPass,
}: RegistrationCalendarModalProps) {
  const [downloadedIcs, setDownloadedIcs] = useState(false);

  if (!isOpen) return null;

  const leadMins = settings?.leadTimeMinutes ?? 60;
  const leadHours = Math.round(leadMins / 60);
  const leadLabel = leadMins >= 60 ? `${leadHours} hour${leadHours > 1 ? "s" : ""}` : `${leadMins} mins`;

  const handleOpenGoogleCal = () => {
    openGoogleCalendar(event, settings);
  };

  const handleDownloadIcs = () => {
    downloadIcsFile(event, settings);
    setDownloadedIcs(true);
    setTimeout(() => setDownloadedIcs(false), 3000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border-2 border-[#FFD700]/40 bg-gradient-to-b from-[#092257] via-[#061a45] to-[#041233] text-white p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gold Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#FFD700] via-[#FFE033] to-[#FFD700]" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header with Celebration Badge */}
        <div className="text-center pt-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 mb-3 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="h-8 w-8 stroke-[2.5]" />
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD700]/15 border border-[#FFD700]/30 px-3 py-1 text-xs font-display font-bold uppercase tracking-wider text-[#FFD700] mb-2">
            <Sparkles className="h-3.5 w-3.5" /> Slot Confirmed
          </div>

          <h3 className="font-display text-xl sm:text-2xl font-black uppercase tracking-wide text-white">
            Registration Successful!
          </h3>
          <p className="text-xs text-[#a9b8e0] mt-1 max-w-sm mx-auto">
            You are officially registered for <span className="text-white font-bold">{event.title}</span>.
          </p>
        </div>

        {/* Reminders Configured Card */}
        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-display text-[11px] font-bold uppercase tracking-wider text-[#FFD700] flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-[#FFD700]" /> Reminders Configured
            </span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Active
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2 text-white/90">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FFD700] mt-1.5 shrink-0" />
              <span>
                <strong>1-Hour Alert:</strong> You will be reminded <strong>{leadLabel}</strong> before the event starts.
              </span>
            </div>

            {settings?.dailyReminderEnabled && (
              <div className="flex items-start gap-2 text-white/90">
                <span className="h-1.5 w-1.5 rounded-full bg-[#FFD700] mt-1.5 shrink-0" />
                <span>
                  <strong>Daily Reminder:</strong> Daily schedule reminders leading up to festival day.
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 text-white/70 pt-1 text-[11px]">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-[#a9b8e0]" /> {event.time || "Time as scheduled"}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-[#a9b8e0]" /> {event.venue || "SCET Campus"}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 space-y-2.5">
          {/* Primary: Open Google Calendar */}
          <button
            type="button"
            onClick={handleOpenGoogleCal}
            className="w-full h-12 rounded-xl bg-[#FFD700] text-[#001d5c] font-display text-xs sm:text-sm font-black uppercase tracking-[0.1em] hover:bg-[#ffdf33] flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[#FFD700]/25 cursor-pointer active:scale-[0.99]"
          >
            <CalendarPlus className="h-4 w-4" />
            Add to Google Calendar
          </button>

          {/* Secondary: Download .ics for Apple/Android Mobile Calendar */}
          <button
            type="button"
            onClick={handleDownloadIcs}
            className="w-full h-11 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-display text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {downloadedIcs ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Downloaded Calendar File!
              </>
            ) : (
              <>
                <Smartphone className="h-4 w-4 text-[#FFD700]" />
                Download Mobile Calendar (.ics)
              </>
            )}
          </button>

          {/* Tertiary: View QR Pass & Done */}
          <div className="flex gap-2 pt-1">
            {onViewPass && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewPass();
                }}
                className="flex-1 h-10 rounded-xl bg-[#003399] hover:bg-[#002980] border border-[#FFD700]/40 text-white font-display text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <QrCode className="h-3.5 w-3.5 text-[#FFD700]" />
                View Entry Pass
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-display text-[11px] font-bold uppercase tracking-wider flex items-center justify-center transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

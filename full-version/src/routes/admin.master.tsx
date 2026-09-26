import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth, signOut, assignUserAsSubAdmin, revokeSubAdmin, useSubAdmins } from "@/lib/firebase-auth";
import { useFirestoreEvents, createEvent, updateEvent, deleteEvent } from "@/lib/firebase-events";
import { uploadEventLogo, uploadEventPoster, uploadTeamMemberPhoto } from "@/lib/firebase-storage";
import { useAllRegistrations, deleteRegistration, cleanupAllDuplicateRegistrations, doesRegistrationMatchEvent, type Registration } from "@/lib/firebase-registrations";
import { collection, getDocs, doc, updateDoc, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { FEST_EVENTS } from "@/lib/fest-state";
import { useSiteConfig, updateSiteConfig, setSponsorsVisibility, setTeamCtaVisibility, setDashboardExploreVisibility, DEFAULT_SITE_CONFIG, sortCategoryMembers, type SiteConfig, type TeamCategory, type TeamMember } from "@/lib/firebase-site-config";
import { openGoogleCalendar } from "@/lib/calendar-reminders";
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  UserPlus,
  Download,
  FileSpreadsheet,
  LogOut,
  Menu,
  X,
  Pencil,
  Trash2,
  Plus,
  Save,
  CheckCircle2,
  Clock,
  Shield,
  QrCode,
  Activity,
  Upload,
  ImageIcon,
  UserCog,
  ExternalLink,
  BellRing,
  Sparkles,
  Power,
  Eye,
  EyeOff,
  Compass,
  Layers,
  Lock,
  FileUp,
  FileDown,
  RotateCcw,
  ArrowUpDown,
  GripVertical,
  ListOrdered,
  Mail,
} from "lucide-react";
import { BulkRegistrationModal } from "@/components/brick/BulkRegistrationModal";
import { cn } from "@/lib/utils";
import type { FestEvent } from "@/lib/fest-state";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/admin/master")({
  head: () => ({
    meta: [
      { title: "Admin Panel | CONVERSE 2K26" },
      { name: "description", content: "Administrative control panel." },
    ],
  }),
  component: MasterAdmin,
  errorComponent: ({ error, reset }) => {
    console.error("Admin Master error:", error);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4 text-white font-sans">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <Shield className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Admin Panel Encountered an Issue
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {error?.message || "An unexpected error occurred while loading the control panel."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                reset();
                window.location.reload();
              }}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-700 transition-colors shadow-md cursor-pointer"
            >
              Reload Admin Panel
            </button>
            <a
              href="/admin"
              className="rounded-lg border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Admin Gateway
            </a>
          </div>
        </div>
      </div>
    );
  },
});

type Section = "dashboard" | "events" | "registrations" | "users" | "content" | "subadmins" | "export" | "emails";

function MasterAdmin() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { events, loading: eventsLoading } = useFirestoreEvents();
  const { registrations, loading: regsLoading } = useAllRegistrations();
  const { config, loading: configLoading } = useSiteConfig();
  const { subAdmins, loading: subAdminsLoading } = useSubAdmins();

  const masterEvents = useMemo(() => {
    const list = FEST_EVENTS.map((fe) => {
      const fsEvent = events.find((e) => e.id === fe.id);
      if (!fsEvent) return fe;
      const merged = { ...fe } as any;
      Object.keys(fsEvent).forEach((k) => {
        const val = (fsEvent as any)[k];
        if (val !== undefined && val !== null && val !== "") {
          merged[k] = val;
        }
      });
      return merged as FestEvent;
    });

    events.forEach((fsEvent) => {
      if (!list.some((e) => e.id === fsEvent.id)) {
        list.push({
          ...fsEvent,
          number: fsEvent.number || `#${String(list.length + 1).padStart(2, "0")}`,
        } as FestEvent);
      }
    });

    const seen = new Set<string>();
    return list.filter((e) => {
      const key = (e.id || e.title).toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [events]);

  const [section, setSection] = useState<Section>("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Email Campaigns state
  const [emailCampaignTarget, setEmailCampaignTarget] = useState<string>("all");
  const [emailCampaignSubject, setEmailCampaignSubject] = useState("");
  const [emailCampaignTemplate, setEmailCampaignTemplate] = useState("");
  const [emailCampaignSending, setEmailCampaignSending] = useState(false);
  const [emailSelectedUsers, setEmailSelectedUsers] = useState<Array<{ email: string; name: string }>>([]); 
  const [emailSearchQuery, setEmailSearchQuery] = useState("");
  const [emailSearchFocused, setEmailSearchFocused] = useState(false);
  const [emailProgress, setEmailProgress] = useState<{ sent: number; total: number; status: string } | null>(null);
  const emailTextareaRef = useRef<HTMLTextAreaElement>(null);

  const insertEmailVariable = (variable: string) => {
    if (emailTextareaRef.current) {
      const start = emailTextareaRef.current.selectionStart;
      const end = emailTextareaRef.current.selectionEnd;
      const val = emailCampaignTemplate;
      const newVal = val.substring(0, start) + `[${variable}]` + val.substring(end);
      setEmailCampaignTemplate(newVal);
      // Wait for React to update the state, then set cursor position
      setTimeout(() => {
        if (emailTextareaRef.current) {
          emailTextareaRef.current.selectionStart = start + variable.length + 2;
          emailTextareaRef.current.selectionEnd = start + variable.length + 2;
          emailTextareaRef.current.focus();
        }
      }, 0);
    } else {
      setEmailCampaignTemplate((prev) => prev + `[${variable}]`);
    }
  };

  const handleSendEmailCampaign = async () => {
    if (!emailCampaignSubject || !emailCampaignTemplate) {
      alert("Please enter a subject and a template.");
      return;
    }
    if (emailCampaignTarget === "specific") {
      if (emailSelectedUsers.length === 0) {
        alert("Please select at least one user to send to.");
        return;
      }
    }
    if (!confirm(`Are you sure you want to send this email campaign?${emailCampaignTarget === "specific" ? ` (${emailSelectedUsers.length} recipients)` : ""}`)) return;
    
    setEmailCampaignSending(true);
    setEmailProgress({ sent: 0, total: 0, status: "starting" });

    // Generate unique campaign ID for progress tracking
    const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Listen to progress in real-time
    const unsubProgress = onSnapshot(doc(db, "emailProgress", campaignId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setEmailProgress({ sent: data.sent || 0, total: data.total || 0, status: data.status || "sending" });
      }
    });

    try {
      const sendCustomEmail = httpsCallable(functions, "sendManualEventReminder", { timeout: 1800000 });
      const payload: any = {
        targetAudience: emailCampaignTarget,
        subject: emailCampaignSubject,
        template: emailCampaignTemplate,
        campaignId,
      };
      if (emailCampaignTarget === "specific") {
        payload.specificEmails = emailSelectedUsers.map(u => u.email);
      }
      const result = await sendCustomEmail(payload);
      const data = result.data as any;
      setEmailProgress({ sent: data.count, total: data.count, status: "done" });
      setTimeout(() => {
        alert(`Emails sent successfully! Count: ${data.count}${data.errors ? `\n\nErrors:\n${data.errors.join("\n")}` : ""}`);
        setEmailCampaignSubject("");
        setEmailCampaignTemplate("");
        setEmailSelectedUsers([]);
        setEmailProgress(null);
      }, 500);
    } catch (err: any) {
      alert("Error sending emails: " + err.message);
      setEmailProgress(null);
    } finally {
      unsubProgress();
      setEmailCampaignSending(false);
    }
  };

  // Event form state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<FestEvent | null>(null);
  const [eventForm, setEventForm] = useState({
    title: "", desc: "", time: "", venue: "", format: "Individual", prize: "", track: "TECH" as "TECH" | "NON-TECH" | "ROBOTICS",
    tag: "", tagType: "quiz", iconName: "HelpCircle", maxSlots: 100,
    fullDesc: "", rules: "", coordinatorName: "", coordinatorPhone: "",
    coordinators: [{ name: "", phone: "" }] as Array<{ name: string; phone: string }>,
    facultyCoordinators: [{ name: "", phone: "" }] as Array<{ name: string; phone: string }>,
    date: "", startTime: "", endTime: "",
    logoUrl: "", posterUrl: "",
    whatsappGroupUrl: "", instagramUrl: "",
    googleFormUrl: "",
    registrationOpen: true,
    registrationClosedMessage: "",
  });
  const [uploadingLogo, setUploadingLogo] = useState<string | null>(null);
  const [uploadingPoster, setUploadingPoster] = useState<string | null>(null);

  // Calendar Reminder Settings state
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [savingReminders, setSavingReminders] = useState(false);
  const [reminderSavedToast, setReminderSavedToast] = useState(false);
  const [reminderForm, setReminderForm] = useState(config.reminderSettings || DEFAULT_SITE_CONFIG.reminderSettings);

  useEffect(() => {
    if (config.reminderSettings) {
      setReminderForm(config.reminderSettings);
    }
  }, [config.reminderSettings]);

  const handleSaveReminderSettings = async () => {
    setSavingReminders(true);
    try {
      await updateSiteConfig({
        ...config,
        reminderSettings: reminderForm,
      });
      setReminderSavedToast(true);
      setTimeout(() => {
        setReminderSavedToast(false);
        setShowReminderModal(false);
      }, 1400);
    } catch (err: any) {
      alert("Failed to save reminder settings: " + (err.message || "Unknown error"));
    } finally {
      setSavingReminders(false);
    }
  };

  const handleTestReminder = () => {
    const sampleEvent = events[0] || {
      id: "cyber-quiz",
      title: "Cyber-Quiz",
      track: "TECH",
      format: "Individual or Duo",
      time: "11:45 AM - 01:15 PM",
      venue: "Auditorium Hall B",
      description: "Test event for calendar reminder configuration",
    };
    openGoogleCalendar(sampleEvent as any, reminderForm);
  };

  // Registration filters & search
  const [deptFilter, setDeptFilter] = useState("All");
  const [eventFilter, setEventFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [regSearchQuery, setRegSearchQuery] = useState("");
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);

  // Site content form
  const [contentForm, setContentForm] = useState<SiteConfig | null>(null);
  const [contentSaved, setContentSaved] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [contentSubTab, setContentSubTab] = useState<string>("all");
  const [savingSponsorsToggle, setSavingSponsorsToggle] = useState(false);
  const [sponsorsSavedToast, setSponsorsSavedToast] = useState(false);
  const [uploadingMemberPhotoId, setUploadingMemberPhotoId] = useState<string | null>(null);
  const [uploadSuccessMemberId, setUploadSuccessMemberId] = useState<string | null>(null);

  // Team Import / Export & Roster management state
  const [teamImportToast, setTeamImportToast] = useState<string | null>(null);
  const [teamDirectSaving, setTeamDirectSaving] = useState(false);
  const teamFileInputRef = useRef<HTMLInputElement>(null);

  // Section Ordering Modal & Drag and Drop state
  const [showSectionOrderModal, setShowSectionOrderModal] = useState(false);
  const [draggedCategoryIndex, setDraggedCategoryIndex] = useState<number | null>(null);
  const [dragOverCategoryIndex, setDragOverCategoryIndex] = useState<number | null>(null);

  const handleCategoryDragStart = (e: React.DragEvent, index: number) => {
    setDraggedCategoryIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${index}`);
  };

  const handleCategoryDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCategoryIndex !== index) {
      setDragOverCategoryIndex(index);
    }
  };

  const handleCategoryDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedCategoryIndex === null || draggedCategoryIndex === targetIndex) {
      setDraggedCategoryIndex(null);
      setDragOverCategoryIndex(null);
      return;
    }

    setContentForm((f) => {
      if (!f) return f;
      const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
      const cats = [...currentTeam.categories];
      const [movedItem] = cats.splice(draggedCategoryIndex, 1);
      if (!movedItem) return f;
      cats.splice(targetIndex, 0, movedItem);
      return {
        ...f,
        team: {
          ...currentTeam,
          categories: cats,
        },
      };
    });

    setDraggedCategoryIndex(null);
    setDragOverCategoryIndex(null);
  };

  const handleMoveCategory = (fromIdx: number, toIdx: number) => {
    setContentForm((f) => {
      if (!f) return f;
      const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
      const cats = [...currentTeam.categories];
      if (fromIdx < 0 || fromIdx >= cats.length || toIdx < 0 || toIdx >= cats.length) return f;
      const [moved] = cats.splice(fromIdx, 1);
      if (!moved) return f;
      cats.splice(toIdx, 0, moved);
      return { ...f, team: { ...currentTeam, categories: cats } };
    });
  };

  const handleLoadOfficialRoster = () => {
    if (!window.confirm("Load the official CONVERSE 2K26 roster? This updates roles, bios, and names while PRESERVING uploaded photos.")) {
      return;
    }
    // Build a map of existing photos by member ID so we can preserve them
    const existingPhotos = new Map<string, string>();
    const currentCats = contentForm?.team?.categories || [];
    for (const cat of currentCats) {
      for (const mem of (cat.members || [])) {
        if (mem.id && mem.photo) {
          existingPhotos.set(mem.id, mem.photo);
        }
      }
    }
    const officialCats = DEFAULT_SITE_CONFIG.team!.categories.map((cat) => ({
      ...cat,
      members: sortCategoryMembers(
        (cat.members || []).map((m) => ({
          ...m,
          // Preserve existing photo if one was uploaded
          photo: existingPhotos.get(m.id) || m.photo || "",
        })),
        cat.id,
        cat.name
      ),
    }));
    setContentForm((f) => {
      if (!f) return f;
      return {
        ...f,
        team: {
          ...(f.team || DEFAULT_SITE_CONFIG.team!),
          categories: officialCats,
        },
      };
    });
    setTeamImportToast("Official 2K26 Roster loaded — roles & bios updated, photos preserved! Click 'Save Team Changes' to write to Firestore.");
    setTimeout(() => setTeamImportToast(null), 7000);
  };

  const handleImportTeamJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const rawCats: TeamCategory[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.categories)
            ? parsed.categories
            : null;

        if (!rawCats || rawCats.length === 0) {
          alert("Invalid team JSON: Must contain an array of categories or a { categories: [...] } object.");
          return;
        }

        const cats = rawCats.map((cat) => ({
          ...cat,
          members: sortCategoryMembers(cat.members || [], cat.id, cat.name),
        }));

        setContentForm((f) => {
          if (!f) return f;
          return {
            ...f,
            team: {
              ...(f.team || DEFAULT_SITE_CONFIG.team!),
              categories: cats,
            },
          };
        });

        const totalMems = cats.reduce((acc, c) => acc + (c.members?.length || 0), 0);
        setTeamImportToast(`Imported ${cats.length} categories (${totalMems} members) with Heads & Coordinators sorted on top! Click 'Save Team Changes' to commit.`);
        setTimeout(() => setTeamImportToast(null), 7000);
      } catch (err: any) {
        alert("Failed to parse JSON file: " + (err.message || "Invalid JSON format"));
      } finally {
        if (e.target) e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleExportTeamJson = () => {
    const cats = contentForm?.team?.categories || DEFAULT_SITE_CONFIG.team!.categories;
    const sortedCats = cats.map((cat) => ({
      ...cat,
      members: sortCategoryMembers(cat.members || [], cat.id, cat.name),
    }));
    const jsonStr = JSON.stringify({ categories: sortedCats }, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-roster-2026-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveTeamDirect = async () => {
    if (!contentForm) return;
    setTeamDirectSaving(true);
    try {
      const baseCats = (contentForm.team?.categories && contentForm.team.categories.length > 0)
        ? contentForm.team.categories
        : DEFAULT_SITE_CONFIG.team!.categories;
      // Automatically sort all category members so Heads & Coordinators are guaranteed to be on top in Firestore
      const catsToSave = baseCats.map((cat) => ({
        ...cat,
        members: sortCategoryMembers(cat.members || [], cat.id, cat.name),
      }));
      const fullForm: SiteConfig = {
        ...contentForm,
        team: {
          ...(contentForm.team || DEFAULT_SITE_CONFIG.team!),
          categories: catsToSave,
        },
      };
      await updateSiteConfig(fullForm);
      setContentForm(fullForm);
      setTeamImportToast(`All ${catsToSave.length} categories saved to Firestore with Heads & Coordinators sorted on top! Live on /team.`);
      setTimeout(() => setTeamImportToast(null), 5000);
    } catch (err: any) {
      console.error("Error saving team to Firestore:", err);
      alert("Failed to save team: " + (err.message || "Unknown error"));
    } finally {
      setTeamDirectSaving(false);
    }
  };

  const handleSwapCategories = (idxA: number, idxB: number) => {
    if (idxA === idxB || isNaN(idxA) || isNaN(idxB)) return;
    setContentForm((f) => {
      if (!f) return f;
      const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
      const updatedCats = [...currentTeam.categories];
      if (idxA < 0 || idxA >= updatedCats.length || idxB < 0 || idxB >= updatedCats.length) return f;
      const temp = updatedCats[idxA]!;
      updatedCats[idxA] = updatedCats[idxB]!;
      updatedCats[idxB] = temp;
      return { ...f, team: { ...currentTeam, categories: updatedCats } };
    });
  };

  const getFullRoleName = (catName: string, type: "head" | "member" | "coordinator" | "volunteer" | "faculty", isEventCat: boolean): string => {
    const trimmed = (catName || "").trim();
    if (!trimmed) {
      if (type === "head") return isEventCat ? "Event Coordinator" : "Committee Head";
      if (type === "member") return isEventCat ? "Event Volunteer" : "Committee Member";
      if (type === "coordinator") return "Event Coordinator";
      if (type === "volunteer") return "Event Volunteer";
      if (type === "faculty") return isEventCat ? "Event Faculty Coordinator" : "Faculty Coordinator";
    }
    if (type === "head") return `${trimmed} Head`;
    if (type === "member") return `${trimmed} Member`;
    if (type === "coordinator") return `${trimmed} Coordinator`;
    if (type === "volunteer") return `${trimmed} Volunteer`;
    if (type === "faculty") {
      const cleanTrack = trimmed.replace(/\s+Track$/i, "").replace(/\s+Challenge$/i, "");
      return `${cleanTrack} Faculty Coordinator`;
    }
    return `${trimmed} Head`;
  };

  const handleAddCategorySection = (type: "committee" | "event") => {
    setContentForm((f) => {
      if (!f) return f;
      const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
      const isEvent = type === "event";
      const newCat: TeamCategory = {
        id: isEvent ? `event-track-${Date.now()}` : `committee-${Date.now()}`,
        name: isEvent ? "New Event Track" : "New Committee",
        color: isEvent ? "emerald" : "blue",
        description: isEvent ? "Event challenge arena & guidelines" : "Committee description and operations",
        members: [
          {
            id: `mem-${Date.now()}`,
            name: "",
            role: isEvent ? "Event Coordinator" : "Committee Head",
            bio: "",
            fact: "",
            photo: "",
            enrollment: "",
            email: "",
            year: "",
            div: "",
          },
        ],
      };
      return {
        ...f,
        team: {
          ...currentTeam,
          categories: [...currentTeam.categories, newCat],
        },
      };
    });
  };

  const handleAddMemberToCategory = (catIdx: number, defaultRole: string) => {
    setContentForm((f) => {
      if (!f) return f;
      const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
      const updatedCats = [...currentTeam.categories];
      const targetCat = { ...updatedCats[catIdx]! };
      const newMember: TeamMember = {
        id: `mem-${Date.now()}`,
        name: "",
        role: defaultRole,
        photo: "",
        bio: "",
        fact: "",
        enrollment: "",
        email: "",
        year: "",
        div: "",
      };
      // Auto-sort so Head or Coordinator is placed appropriately on top
      const allMems = [...(targetCat.members || []), newMember];
      targetCat.members = sortCategoryMembers(allMems, targetCat.id, targetCat.name);
      updatedCats[catIdx] = targetCat;
      return { ...f, team: { ...currentTeam, categories: updatedCats } };
    });
  };

  const handleAutoSortCategoryMembers = (catIdx: number) => {
    setContentForm((f) => {
      if (!f) return f;
      const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
      const updatedCats = [...currentTeam.categories];
      const targetCat = { ...updatedCats[catIdx]! };
      targetCat.members = sortCategoryMembers(targetCat.members || [], targetCat.id, targetCat.name);
      updatedCats[catIdx] = targetCat;
      return { ...f, team: { ...currentTeam, categories: updatedCats } };
    });
  };

  const handleUploadMemberPhoto = async (catIndex: number, memIndex: number, memberId: string, file: File) => {
    try {
      setUploadingMemberPhotoId(memberId);
      const url = await uploadTeamMemberPhoto(memberId, file);
      // Update local state and auto-save to Firestore
      let updatedForm = contentForm;
      setContentForm((f) => {
        if (!f) return f;
        const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
        const updatedCats = [...currentTeam.categories];
        const targetCat = { ...updatedCats[catIndex]! };
        const updatedMems = [...targetCat.members];
        updatedMems[memIndex] = { ...updatedMems[memIndex]!, photo: url, id: memberId };
        targetCat.members = updatedMems;
        updatedCats[catIndex] = targetCat;
        updatedForm = { ...f, team: { ...currentTeam, categories: updatedCats } };
        return updatedForm;
      });
      // Auto-save photo to Firestore immediately
      if (updatedForm) {
        await updateSiteConfig(updatedForm);
      }
      setUploadSuccessMemberId(memberId);
      setTimeout(() => setUploadSuccessMemberId(null), 3000);
    } catch (err: any) {
      alert("Failed to upload photo: " + (err.message || "Unknown error"));
    } finally {
      setUploadingMemberPhotoId(null);
    }
  };

  const handleToggleSponsors = async () => {
    const currentVal = contentForm?.landing?.sponsorsEnabled !== false;
    const nextVal = !currentVal;

    // 1. Optimistic local update
    setContentForm((f) => f && ({
      ...f,
      landing: {
        ...f.landing,
        sponsorsEnabled: nextVal,
      },
    }));

    // 2. Persist immediately to Firestore and update cache
    setSavingSponsorsToggle(true);
    try {
      await setSponsorsVisibility(nextVal);
      setSponsorsSavedToast(true);
      setTimeout(() => setSponsorsSavedToast(false), 2200);
    } catch (err: any) {
      console.error("Failed to update sponsor visibility:", err);
      alert("Failed to save sponsor visibility: " + (err.message || "Unknown error"));
      // Rollback on error
      setContentForm((f) => f && ({
        ...f,
        landing: {
          ...f.landing,
          sponsorsEnabled: currentVal,
        },
      }));
    } finally {
      setSavingSponsorsToggle(false);
    }
  };

  const [savingTeamCtaToggle, setSavingTeamCtaToggle] = useState(false);
  const [teamCtaSavedToast, setTeamCtaSavedToast] = useState(false);

  const handleToggleTeamCta = async () => {
    const currentVal = contentForm?.team?.ctaEnabled !== false;
    const nextVal = !currentVal;

    // 1. Optimistic local update
    setContentForm((f) => {
      if (!f) return f;
      const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
      return {
        ...f,
        team: {
          ...currentTeam,
          ctaEnabled: nextVal,
        },
      };
    });

    // 2. Persist immediately to Firestore and update cache
    setSavingTeamCtaToggle(true);
    try {
      await setTeamCtaVisibility(nextVal);
      setTeamCtaSavedToast(true);
      setTimeout(() => setTeamCtaSavedToast(false), 2200);
    } catch (err: any) {
      console.error("Failed to update Team CTA visibility:", err);
      alert("Failed to save CTA visibility: " + (err.message || "Unknown error"));
      // Rollback on error
      setContentForm((f) => {
        if (!f) return f;
        const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
        return {
          ...f,
          team: {
            ...currentTeam,
            ctaEnabled: currentVal,
          },
        };
      });
    } finally {
      setSavingTeamCtaToggle(false);
    }
  };

  const [savingExploreToggle, setSavingExploreToggle] = useState(false);
  const [exploreSavedToast, setExploreSavedToast] = useState(false);

  const handleToggleDashboardExplore = async () => {
    const currentVal = contentForm?.dashboard?.exploreEnabled !== false;
    const nextVal = !currentVal;

    // 1. Optimistic local update
    setContentForm((f) => f && ({
      ...f,
      dashboard: {
        ...f.dashboard,
        exploreEnabled: nextVal,
      },
    }));

    // 2. Persist immediately to Firestore and update cache
    setSavingExploreToggle(true);
    try {
      await setDashboardExploreVisibility(nextVal);
      setExploreSavedToast(true);
      setTimeout(() => setExploreSavedToast(false), 2200);
    } catch (err: any) {
      console.error("Failed to update explore visibility:", err);
      alert("Failed to save dashboard explore section visibility: " + (err.message || "Unknown error"));
      // Rollback on error
      setContentForm((f) => f && ({
        ...f,
        dashboard: {
          ...f.dashboard,
          exploreEnabled: currentVal,
        },
      }));
    } finally {
      setSavingExploreToggle(false);
    }
  };

  // Users state
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<any | null>(null); // Kept for backwards compat if needed, but unused
  const [userForm, setUserForm] = useState({ name: "", phone: "", branch: "", semester: "", year: "", enrollmentNumber: "" });
  const [userSaveStatus, setUserSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Sub-admin form (Google account assignment)
  const [subAdminEmail, setSubAdminEmail] = useState("");
  const [subAdminName, setSubAdminName] = useState("");
  const [subAdminEventId, setSubAdminEventId] = useState("");
  const [subAdminSearchOpen, setSubAdminSearchOpen] = useState(false);
  const [subAdminStatus, setSubAdminStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [subAdminMsg, setSubAdminMsg] = useState("");

  const subAdminSuggestions = useMemo(() => {
    const q = subAdminEmail.trim().toLowerCase();
    if (!q) return [];
    return (allUsers || [])
      .filter((u) => u?.email && (
        u.email.toLowerCase().includes(q) ||
        (u.name && u.name.toLowerCase().includes(q))
      ))
      .slice(0, 6);
  }, [allUsers, subAdminEmail]);

  // Master Admin promotion state
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoteStatus, setPromoteStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [promoteMsg, setPromoteMsg] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newCollegeInput, setNewCollegeInput] = useState("");
  const [newBranchInput, setNewBranchInput] = useState("");

  const emailSuggestions = useMemo(() => {
    const q = promoteEmail.trim().toLowerCase();
    if (!q) return [];
    return (allUsers || [])
      .filter((u) => u?.email && u.role !== "master" && (
        u.email.toLowerCase().includes(q) ||
        (u.name && u.name.toLowerCase().includes(q))
      ))
      .slice(0, 6);
  }, [allUsers, promoteEmail]);

  // Route guard
  useEffect(() => {
    if (!authLoading && (!user || user.role !== "master")) {
      navigate({ to: "/admin" });
    }
  }, [user, authLoading, navigate]);

  // Init content form when config loads with automatic fallback to full 17-category roster
  useEffect(() => {
    if (!configLoading && config) {
      const currentCats = config.team?.categories;
      const isUpgraded = Array.isArray(currentCats) && currentCats.length >= 10 && currentCats.some((c) => c.id === "marketing-registration" || c.id === "event-codathon");

      setContentForm((prev) => {
        if (!prev) {
          return {
            ...config,
            footer: config.footer || DEFAULT_SITE_CONFIG.footer,
            team: {
              ...(config.team || DEFAULT_SITE_CONFIG.team!),
              categories: isUpgraded ? config.team!.categories : DEFAULT_SITE_CONFIG.team!.categories,
            },
          };
        }
        if (!prev.team?.categories || prev.team.categories.length < 10) {
          return {
            ...prev,
            team: {
              ...(prev.team || DEFAULT_SITE_CONFIG.team!),
              categories: isUpgraded ? config.team!.categories : DEFAULT_SITE_CONFIG.team!.categories,
            },
          };
        }
        return prev;
      });
    }
  }, [config, configLoading]);

  // Fetch all users from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setAllUsers(users);
      setUsersLoading(false);
    });
    return () => unsub();
  }, []);

  const deptOptions = useMemo(() => {
    const depts = new Set<string>();
    registrations.forEach((r) => { if (r.userDept) depts.add(r.userDept); });
    allUsers.forEach((u) => { if (u.branch) depts.add(u.branch); });
    const list = Array.from(depts).filter(Boolean).sort();
    return ["All", ...(list.length > 0 ? list : ["IT", "AIDS", "MCA", "CO", "EC", "MECH", "CIVIL"])];
  }, [registrations, allUsers]);

  const eventOptions = useMemo(() => {
    return [
      { value: "All", label: "All Events" },
      ...masterEvents.map((e) => ({
        value: e.id,
        label: `${e.number ? e.number + " " : ""}${e.title}`,
      })),
    ];
  }, [masterEvents]);

  // Filtered registrations with real-time text search and accurate event matching
  const filteredRegs = useMemo(() => {
    const q = regSearchQuery.trim().toLowerCase();

    return registrations.filter((r) => {
      // 1. Department filter
      if (deptFilter !== "All" && r.userDept !== deptFilter) return false;

      // 2. Status filter
      if (statusFilter === "Checked-In" && !r.checkedIn) return false;
      if (statusFilter === "Pending" && r.checkedIn) return false;

      // 3. Event filter
      if (eventFilter !== "All") {
        const evObj = masterEvents.find((e) => e.id === eventFilter || e.title === eventFilter);
        if (evObj) {
          if (!doesRegistrationMatchEvent(r, evObj) && r.eventId !== eventFilter && r.eventTitle !== eventFilter) {
            return false;
          }
        } else if (r.eventId !== eventFilter && r.eventTitle !== eventFilter) {
          return false;
        }
      }

      // 4. Real-time Search Query across all fields
      if (q) {
        const name = (r.userName || "").toLowerCase();
        const email = (r.userEmail || "").toLowerCase();
        const leaderEmail = (r.leaderEmail || "").toLowerCase();
        const leaderName = (r.leaderName || "").toLowerCase();
        const phone = (r.userPhone || "").toLowerCase();
        const eventId = (r.eventId || "").toLowerCase();
        const eventTitle = (r.eventTitle || "").toLowerCase();
        const entryCode = (r.entryCode || "").toLowerCase();
        const teamName = (r.teamName || "").toLowerCase();
        const partnerName = (r.partnerName || "").toLowerCase();
        const memberEmails = (r.teamMemberEmails || []).map((e) => e.toLowerCase()).join(" ");
        const teammates = (r.teammates || [])
          .map((t: any) => `${t.name || ""} ${t.email || ""} ${t.phone || ""} ${t.enrollmentNumber || ""}`)
          .join(" ")
          .toLowerCase();

        const fullHaystack = `${name} ${email} ${leaderEmail} ${leaderName} ${phone} ${eventId} ${eventTitle} ${entryCode} ${teamName} ${partnerName} ${memberEmails} ${teammates}`;
        if (!fullHaystack.includes(q)) return false;
      }

      return true;
    });
  }, [registrations, deptFilter, eventFilter, statusFilter, regSearchQuery, masterEvents]);

  const [isExporting, setIsExporting] = useState(false);

  const exportCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // Fetch users to backfill any missing enrollment numbers in old registrations
      const usersSnap = await getDocs(collection(db, "users"));
      const userEnrollments: Record<string, string> = {};
      usersSnap.forEach((doc) => {
        const data = doc.data();
        if (data.enrollmentNumber) {
          userEnrollments[doc.id] = data.enrollmentNumber;
        }
      });
    const selectedEvent = eventFilter !== "ALL" ? masterEvents.find((e) => e.id === eventFilter) : null;
    const eventTitleDisplay = selectedEvent ? selectedEvent.title : "All Events";
    const exportTimeStr = new Date().toLocaleString("en-IN", { dateStyle: "full", timeStyle: "medium" });

    const head = [
      "Sr No",
      "Participant / Leader Name",
      "Email",
      "Phone",
      "Department",
      "Enrollment No",
      "Event Name",
      "Team Name",
      "Teammates",
      "Entry Code",
      "Status",
      "Participant Signature",
    ];

    const dataRows = filteredRegs.map((r, idx) => {
      const matchedEv = masterEvents.find((e) => doesRegistrationMatchEvent(r, e));
      const evName = matchedEv?.title || r.eventTitle || r.eventId || "General";
      const teammatesStr = r.teammates && r.teammates.length > 0
        ? `Leader: ${r.leaderName || r.userName} (${r.leaderEmail || r.userEmail}); Members: ` +
          r.teammates.map((t: any) => `${t.name} (${t.email})`).join("; ")
        : (r.partnerName || "Solo");

      return [
        (idx + 1).toString(),
        r.userName || "",
        r.userEmail || "",
        r.userPhone || "",
        r.userDept || "",
        r.enrollmentNumber || userEnrollments[r.userId] || "",
        evName,
        r.teamName || (r.teammates && r.teammates.length > 0 ? `${r.userName}'s Team` : "Solo"),
        teammatesStr,
        r.entryCode || "—",
        r.checkedIn ? "Checked In" : "Pending",
        "", // Participant signature blank for signing
      ];
    });

    // Verification & Sign-off Section at the bottom of the CSV
    const checkedInCount = filteredRegs.filter((r) => r.checkedIn).length;
    const pendingCount = filteredRegs.length - checkedInCount;

    // Coordinators info
    const coord1 = selectedEvent?.coordinators?.[0] || { name: "", phone: "" };
    const coord2 = selectedEvent?.coordinators?.[1] || { name: "", phone: "" };
    const faculty1 = selectedEvent?.facultyCoordinators?.[0] || { name: "", phone: "" };

    const footerRows = [
      [],
      ["---", "---", "---", "---", "---", "---", "---", "---", "---", "---", "---", "---"],
      ["CONVERSE 2K26 — EVENT ATTENDANCE & VERIFICATION SIGN-OFF SHEET"],
      ["Event Name:", eventTitleDisplay, "", "Total Registrations:", filteredRegs.length.toString()],
      ["Generated On:", exportTimeStr, "", "Checked In Count:", checkedInCount.toString(), "", "Pending Count:", pendingCount.toString()],
      [],
      ["OFFICIAL VERIFICATION & APPROVAL SIGNATURES"],
      ["Role", "Designated Person Name", "Contact Number", "Physical Signature", "Date & Official Stamp"],
      ["Student Coordinator 1", coord1.name || "___________________________", coord1.phone || "___________________________", "___________________________", "___________________________"],
      ["Student Coordinator 2", coord2.name || "___________________________", coord2.phone || "___________________________", "___________________________", "___________________________"],
      ["Faculty Coordinator", faculty1.name || "___________________________", faculty1.phone || "___________________________", "___________________________", "___________________________"],
      ["Department Convener / HOD", "___________________________", "___________________________", "___________________________", "___________________________"],
    ];

    const allRows = [head, ...dataRows, ...footerRows];
    const csv = allRows
      .map((row) => row.map((v) => `"${(v || "").toString().replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeEventSuffix = selectedEvent ? `-${(selectedEvent.title || eventFilter).toLowerCase().replace(/[^a-z0-9]/g, "-")}` : "";
    a.download = `converse-2k26${safeEventSuffix}-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCleanDuplicates = async () => {
    if (!confirm("Clean up all duplicate registrations? This will safely remove extraneous duplicate entries caused by repeated clicks on slow connections, while keeping each participant's primary registration, QR code, and entry pass intact.")) {
      return;
    }
    setIsCleaningDuplicates(true);
    try {
      const res = await cleanupAllDuplicateRegistrations();
      if (res.duplicatesRemoved === 0) {
        alert("Awesome! No duplicate registrations found across all " + res.totalScanned + " records.");
      } else {
        alert(`Successfully removed ${res.duplicatesRemoved} duplicate registration(s) across ${res.affectedUsers.length} participant(s):\n${res.affectedUsers.slice(0, 8).join(", ")}${res.affectedUsers.length > 8 ? "..." : ""}`);
      }
    } catch (err: any) {
      console.error("Cleanup error:", err);
      alert("Failed to clean duplicates: " + (err.message || "Unknown error"));
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const handleSaveEvent = async () => {
    try {
      // Auto-format time string if startTime and endTime are provided
      let computedTime = eventForm.time;
      if (eventForm.startTime && eventForm.endTime) {
        const formatTime = (time: string) => {
          const [h = "0", m = "00"] = time.split(':');
          let hours = parseInt(h, 10) || 0;
          const ampm = hours >= 12 ? 'PM' : 'AM';
          hours = hours % 12;
          hours = hours ? hours : 12;
          return `${hours}:${m} ${ampm}`;
        };
        computedTime = `${formatTime(eventForm.startTime)} - ${formatTime(eventForm.endTime)}`;
      }

      const validCoordinators = (eventForm.coordinators || []).filter(
        c => (c.name && c.name.trim() !== "") || (c.phone && c.phone.trim() !== "")
      );

      const validFacultyCoordinators = (eventForm.facultyCoordinators || []).filter(
        c => (c.name && c.name.trim() !== "") || (c.phone && c.phone.trim() !== "")
      );

      const payload = {
        ...eventForm,
        time: computedTime,
        rules: eventForm.rules.split("\n").filter(r => r.trim() !== ""),
        coordinators: validCoordinators,
        coordinatorName: validCoordinators.map(c => c.name).filter(Boolean).join(", "),
        coordinatorPhone: validCoordinators.map(c => c.phone).filter(Boolean).join(", "),
        facultyCoordinators: validFacultyCoordinators,
        googleFormUrl: (eventForm.googleFormUrl || "").trim(),
      };
      if (editingEvent) {
        await updateEvent(editingEvent.id, payload);
      } else {
        const number = `#${String(events.length + 1).padStart(2, "0")}`;
        await createEvent({ ...payload, number } as any);
      }
      setShowEventModal(false);
      setEditingEvent(null);
      resetEventForm();
    } catch (err) {
      console.error("Error saving event:", err);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (confirm("Are you sure you want to delete this event?")) {
      await deleteEvent(id);
    }
  };

  const openEditEvent = (ev: FestEvent) => {
    let initialCoordinators: Array<{ name: string; phone: string }> = [];
    if (ev.coordinators && ev.coordinators.length > 0) {
      initialCoordinators = ev.coordinators.map(c => ({ name: c.name || "", phone: c.phone || "" }));
    } else if (ev.coordinatorName || ev.coordinatorPhone) {
      const names = (ev.coordinatorName || "").split(/[,;\n]/).map(s => s.trim());
      const phones = (ev.coordinatorPhone || "").split(/[,;\n]/).map(s => s.trim());
      const maxLen = Math.max(names.length, phones.length);
      for (let i = 0; i < maxLen; i++) {
        if (names[i] || phones[i]) {
          initialCoordinators.push({
            name: names[i] || "",
            phone: phones[i] || "",
          });
        }
      }
    }
    if (initialCoordinators.length === 0) {
      initialCoordinators = [{ name: "", phone: "" }];
    }

    let initialFacultyCoordinators: Array<{ name: string; phone: string }> = [];
    if (ev.facultyCoordinators && ev.facultyCoordinators.length > 0) {
      initialFacultyCoordinators = ev.facultyCoordinators.map(c => ({ name: c.name || "", phone: c.phone || "" }));
    }
    if (initialFacultyCoordinators.length === 0) {
      initialFacultyCoordinators = [{ name: "", phone: "" }];
    }

    setEditingEvent(ev);
    setEventForm({
      title: ev.title || "", desc: ev.desc || "", time: ev.time || "", venue: ev.venue || "",
      format: ev.format || "Individual", prize: ev.prize || "", track: ev.track || "TECH", tag: ev.tag || "",
      tagType: (ev as any).tagType || "quiz", iconName: ev.iconName || "HelpCircle",
      maxSlots: (ev as any).maxSlots || 100,
      fullDesc: ev.fullDesc || "",
      rules: ev.rules ? (Array.isArray(ev.rules) ? ev.rules.join("\n") : String(ev.rules)) : "",
      coordinatorName: ev.coordinatorName || "",
      coordinatorPhone: ev.coordinatorPhone || "",
      coordinators: initialCoordinators,
      facultyCoordinators: initialFacultyCoordinators,
      date: ev.date || "",
      startTime: ev.startTime || "",
      endTime: ev.endTime || "",
      logoUrl: ev.logoUrl || "",
      posterUrl: ev.posterUrl || "",
      whatsappGroupUrl: ev.whatsappGroupUrl || "",
      instagramUrl: ev.instagramUrl || "",
      googleFormUrl: ev.googleFormUrl || "",
      registrationOpen: ev.registrationOpen !== false,
      registrationClosedMessage: ev.registrationClosedMessage || "",
    });
    setShowEventModal(true);
  };

  const resetEventForm = () => {
    setEventForm({
      title: "", desc: "", time: "", venue: "", format: "Individual", prize: "", track: "TECH",
      tag: "", tagType: "quiz", iconName: "HelpCircle", maxSlots: 100,
      fullDesc: "", rules: "", coordinatorName: "", coordinatorPhone: "",
      coordinators: [{ name: "", phone: "" }],
      facultyCoordinators: [{ name: "", phone: "" }],
      date: "", startTime: "", endTime: "",
      logoUrl: "", posterUrl: "",
      whatsappGroupUrl: "", instagramUrl: "",
      googleFormUrl: "",
      registrationOpen: true,
      registrationClosedMessage: "",
    });
  };

  const handleSaveContent = async () => {
    if (!contentForm) return;
    try {
      await updateSiteConfig(contentForm);
      setContentSaved(true);
      setTimeout(() => setContentSaved(false), 2000);
    } catch (err) {
      console.error("Error saving site content:", err);
    }
  };

  const handleAssignSubAdmin = async () => {
    if (!subAdminEmail.trim() || !subAdminEventId) {
      setSubAdminStatus("error");
      setSubAdminMsg("Please select a registered user and choose an event to assign.");
      setTimeout(() => setSubAdminStatus("idle"), 3500);
      return;
    }

    setSubAdminStatus("loading");
    setSubAdminMsg("");

    const targetUser = (allUsers || []).find(
      (u) => u.email?.toLowerCase().trim() === subAdminEmail.toLowerCase().trim()
    );

    if (!targetUser) {
      setSubAdminStatus("error");
      setSubAdminMsg(
        `No registered user found with Gmail "${subAdminEmail}". The user must sign in with Google on the site at least once first.`
      );
      setTimeout(() => setSubAdminStatus("idle"), 5000);
      return;
    }

    const assignedEventObj = masterEvents.find((e) => e.id === subAdminEventId);
    const resolvedName = subAdminName.trim() || targetUser.name || "Coordinator";

    try {
      await assignUserAsSubAdmin(
        targetUser.uid,
        resolvedName,
        subAdminEventId,
        assignedEventObj?.title || ""
      );

      setSubAdminStatus("success");
      setSubAdminMsg(
        `"${resolvedName}" (${targetUser.email}) is now assigned as Sub-Admin for "${assignedEventObj?.title || subAdminEventId}"! They can log in directly using Google.`
      );
      setSubAdminEmail("");
      setSubAdminName("");
      setSubAdminEventId("");
      setTimeout(() => setSubAdminStatus("idle"), 4500);
    } catch (err: any) {
      console.error("Failed to assign sub-admin:", err);
      setSubAdminStatus("error");
      setSubAdminMsg(`Failed to assign: ${err.message || "Unknown error"}`);
      setTimeout(() => setSubAdminStatus("idle"), 4000);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      window.location.href = "/";
    } catch (err) {
      console.error("Logout error:", err);
      window.location.href = "/";
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!user || user.role !== "master") return null;

  const navLinks: { key: Section; name: string; icon: any }[] = [
    { key: "dashboard", name: "Dashboard", icon: LayoutDashboard },
    { key: "events", name: "Events", icon: Calendar },
    { key: "registrations", name: "Registrations", icon: Users },
    { key: "users", name: "Users", icon: UserCog },
    { key: "content", name: "Site Content", icon: FileText },
    { key: "subadmins", name: "Sub-Admins", icon: UserPlus },
    { key: "export", name: "Export Data", icon: Download },
    { key: "emails", name: "Email Campaigns", icon: Mail },
  ];

  const sectionTitle = navLinks.find(l => l.key === section)?.name || "Dashboard";

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 text-slate-300">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <Shield className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-bold text-white tracking-tight">Admin Panel</h2>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = section === link.key;
            return (
              <button
                key={link.name}
                onClick={() => setSection(link.key)}
                className={`flex items-center w-full space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{link.name}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <Link
            to="/admin/scanner"
            className="flex items-center space-x-3 px-4 py-3 w-full text-left rounded-lg hover:bg-slate-800 text-slate-300 transition-colors mb-2"
          >
            <QrCode className="w-5 h-5" />
            <span className="font-medium">QR Scanner</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-3 w-full text-left rounded-lg hover:bg-slate-800 text-rose-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-slate-200 z-10">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center">
              <button
                className="md:hidden mr-4 text-slate-500 hover:text-slate-700"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-semibold text-slate-800 capitalize">
                {sectionTitle}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-slate-600 hidden sm:block">
                Logged in as <span className="font-semibold text-slate-800">{user.email}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            {renderSection()}
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              className="fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 text-slate-300 z-50 flex flex-col md:hidden"
            >
              <div className="p-4 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-500" />
                  <h2 className="text-xl font-bold text-white tracking-tight">Admin Panel</h2>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="w-6 h-6 text-slate-400 hover:text-white" />
                </button>
              </div>
              <nav className="flex-1 px-4 space-y-2 overflow-y-auto mt-4">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = section === link.key;
                  return (
                    <button
                      key={link.name}
                      onClick={() => { setSection(link.key); setIsMobileMenuOpen(false); }}
                      className={`flex items-center w-full space-x-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive ? "bg-blue-600 text-white" : "hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{link.name}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-slate-800">
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-3 px-4 py-3 w-full text-left rounded-lg hover:bg-slate-800 text-rose-400 transition"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Preview Form Modal ── */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setShowPreviewModal(false)}>
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-800">Preview: Onboarding Form</h3>
              <button onClick={() => setShowPreviewModal(false)} className="text-slate-500 hover:text-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe
              src="/onboarding?preview=true"
              className="flex-1 w-full bg-slate-100"
              title="Preview Form"
            />
          </div>
        </div>
      )}

      {/* ── Reorder Section Positions Modal ── */}
      {showSectionOrderModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={() => setShowSectionOrderModal(false)}
        >
          <div
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-purple-50/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 shadow-xs">
                  <ListOrdered className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Section Positions & Order</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Drag any section up or down to place it wherever you want. Position numbers update live.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSectionOrderModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Draggable List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2 bg-slate-50/60">
              {(() => {
                const cats = (contentForm?.team?.categories || DEFAULT_SITE_CONFIG.team!.categories) as TeamCategory[];
                if (!cats || cats.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      No categories found. Click "Load Official 2K26 Form Roster" first!
                    </div>
                  );
                }

                return cats.map((cat, idx) => {
                  const catNameLower = (cat.name || "").toLowerCase();
                  const isLeadership =
                    cat.id === "leadership-advisory" ||
                    catNameLower.includes("leadership") ||
                    catNameLower.includes("hod") ||
                    catNameLower.includes("faculty");
                  const isStudentLeads =
                    cat.id === "student-heads" ||
                    catNameLower.includes("student head") ||
                    catNameLower.includes("student lead");
                  const isEvent =
                    cat.id.startsWith("event-") ||
                    catNameLower.includes("event") ||
                    catNameLower.includes("codathon") ||
                    catNameLower.includes("arena") ||
                    catNameLower.includes("crafter") ||
                    catNameLower.includes("hunt") ||
                    catNameLower.includes("quiz") ||
                    catNameLower.includes("robot") ||
                    catNameLower.includes("clash") ||
                    catNameLower.includes("escape");

                  const isDragging = draggedCategoryIndex === idx;
                  const isDragOver = dragOverCategoryIndex === idx && !isDragging;

                  const colorDotClass =
                    cat.color === "red"
                      ? "bg-red-500"
                      : cat.color === "yellow"
                        ? "bg-amber-400"
                        : cat.color === "blue"
                          ? "bg-blue-600"
                          : cat.color === "black"
                            ? "bg-slate-900"
                            : cat.color === "purple"
                              ? "bg-purple-600"
                              : cat.color === "emerald"
                                ? "bg-emerald-500"
                                : "bg-slate-400";

                  return (
                    <div
                      key={cat.id || idx}
                      draggable={true}
                      onDragStart={(e) => handleCategoryDragStart(e, idx)}
                      onDragOver={(e) => handleCategoryDragOver(e, idx)}
                      onDrop={(e) => handleCategoryDrop(e, idx)}
                      onDragEnd={() => {
                        setDraggedCategoryIndex(null);
                        setDragOverCategoryIndex(null);
                      }}
                      className={cn(
                        "group select-none rounded-xl border px-3.5 py-2.5 flex items-center justify-between gap-3 transition-all cursor-grab active:cursor-grabbing",
                        isDragging
                          ? "opacity-40 border-dashed border-purple-500 bg-purple-50/50 scale-[0.99]"
                          : isDragOver
                            ? "border-purple-500 bg-purple-50/80 ring-2 ring-purple-400/50 shadow-md scale-[1.01]"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs"
                      )}
                    >
                      {/* Left: Handle + Index + Dot + Type + Name */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className="p-1 rounded-md text-slate-400 group-hover:text-purple-600 hover:bg-purple-50 transition-colors"
                          title="Drag to reposition"
                        >
                          <GripVertical className="w-5 h-5" />
                        </div>

                        <span className="font-mono text-xs font-black bg-slate-900 text-white rounded-md px-2 py-0.5 min-w-[32px] text-center shrink-0">
                          #{idx + 1}
                        </span>

                        <span
                          className={cn(
                            "w-3 h-3 rounded-full shrink-0 border border-black/10 shadow-2xs",
                            colorDotClass
                          )}
                          title={`Color: ${cat.color}`}
                        />

                        <span
                          className={cn(
                            "inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider border shrink-0",
                            isEvent
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : isLeadership
                                ? "bg-rose-50 text-rose-700 border-rose-300"
                                : isStudentLeads
                                  ? "bg-amber-50 text-amber-700 border-amber-300"
                                  : "bg-blue-50 text-blue-700 border-blue-300"
                          )}
                        >
                          {isEvent ? "EVENT" : isLeadership ? "LEADERSHIP" : isStudentLeads ? "LEADS" : "COMMITTEE"}
                        </span>

                        <span className="font-bold text-sm text-slate-800 truncate">
                          {cat.name || "Untitled Section"}
                        </span>

                        <span className="text-xs text-slate-400 font-medium shrink-0">
                          ({cat.members?.length || 0} members)
                        </span>
                      </div>

                      {/* Right: Fallback nudge buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveCategory(idx, idx - 1);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-20 cursor-pointer transition-colors"
                          title="Move up 1 position"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={idx === cats.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveCategory(idx, idx + 1);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-20 cursor-pointer transition-colors"
                          title="Move down 1 position"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-200 bg-white">
              <div className="text-xs text-slate-500">
                💡 Drag sections to reorder. Changes take effect immediately. Click <b>"Save Team Changes to Firestore"</b> to publish live!
              </div>
              <button
                type="button"
                onClick={() => setShowSectionOrderModal(false)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 active:scale-95 transition-all cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                Done & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Event Add/Edit Modal ── */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => { setShowEventModal(false); setEditingEvent(null); }}>
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg border border-slate-200 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingEvent ? "Edit Event" : "Create New Event"}
              </h3>
              <button onClick={() => { setShowEventModal(false); setEditingEvent(null); }} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="h-5 w-5" /></button>
            </div>
            
            <div className="space-y-4">
              {renderInput("Event Title", eventForm.title, (v) => setEventForm(f => ({ ...f, title: v })))}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={eventForm.desc}
                  onChange={(e) => setEventForm((f) => ({ ...f, desc: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none h-24"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {renderInput("Date", eventForm.date, (v) => setEventForm(f => ({ ...f, date: v })), "", "date")}
                <div className="grid grid-cols-2 gap-4">
                  {renderInput("Start Time", eventForm.startTime, (v) => setEventForm(f => ({ ...f, startTime: v })), "", "time")}
                  {renderInput("End Time", eventForm.endTime, (v) => setEventForm(f => ({ ...f, endTime: v })), "", "time")}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {renderInput("Venue", eventForm.venue, (v) => setEventForm(f => ({ ...f, venue: v })))}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Track</label>
                  <select value={eventForm.track} onChange={(e) => setEventForm((f) => ({ ...f, track: e.target.value as any }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                    <option>TECH</option><option>NON-TECH</option><option>ROBOTICS</option>
                  </select>
                </div>
              </div>

              {/* Dedicated Google Form Link for Non-Tech Events */}
              {eventForm.track === "NON-TECH" && (
                <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/90 via-blue-50/60 to-indigo-50/90 p-4 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                      <ExternalLink className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span>Google Form Registration Link (External)</span>
                    </div>
                    <span className="text-[10px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-200 text-indigo-900 border border-indigo-300">
                      Required for Non-Tech
                    </span>
                  </div>
                  <p className="text-xs text-indigo-800 leading-relaxed font-body">
                    Non-tech events are organized externally with their own Google Forms. When participants click the <strong>Register</strong> button on the website, they will be redirected directly to this Google Form. <em>No QR code, 6-letter verification code, or profile pass will be generated.</em>
                  </p>
                  <div>
                    <input
                      type="url"
                      value={eventForm.googleFormUrl}
                      onChange={(e) => setEventForm(f => ({ ...f, googleFormUrl: e.target.value }))}
                      placeholder="https://docs.google.com/forms/d/e/.../viewform or https://forms.gle/..."
                      className="w-full rounded-lg border border-indigo-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 font-mono shadow-inner"
                    />
                    <span className="text-[11px] text-indigo-600 font-medium mt-1 block">
                      Paste the Google Form URL that will open when participants click "Register" on this event.
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Format</label>
                  <select value={eventForm.format} onChange={(e) => setEventForm((f) => ({ ...f, format: e.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                    <option>Individual</option>
                    <option>Individual or Duo</option>
                    <option>Team of 2</option>
                    <option>Team of 2-3</option>
                    <option>Team of 3-4</option>
                    <option>Team of 4-5</option>
                    <option>Group Event (2-4)</option>
                  </select>
                </div>
                {renderInput("Max Slots", String(eventForm.maxSlots), (v) => setEventForm(f => ({ ...f, maxSlots: Number(v) || 100 })), "", "number")}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {renderInput("Prize", eventForm.prize, (v) => setEventForm(f => ({ ...f, prize: v })))}
                {renderInput("Tag Label", eventForm.tag, (v) => setEventForm(f => ({ ...f, tag: v })), "e.g. QUIZ, AI / ML")}
              </div>

              {/* Registration Status & Control */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <span>Registration Availability</span>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                        eventForm.registrationOpen !== false 
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-rose-100 text-rose-800 border-rose-300"
                      )}>
                        {eventForm.registrationOpen !== false ? "● Accepting Registrations" : "✕ Registrations Closed"}
                      </span>
                    </h5>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Turn off to close registrations for this event across the entire website and display the closed alert.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEventForm(f => ({ ...f, registrationOpen: f.registrationOpen === false ? true : false }))}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      eventForm.registrationOpen !== false ? "bg-emerald-600" : "bg-slate-300"
                    )}
                    role="switch"
                    aria-checked={eventForm.registrationOpen !== false}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                        eventForm.registrationOpen !== false ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {eventForm.registrationOpen === false && (
                  <div className="pt-2 border-t border-slate-200/80 animate-in fade-in">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Custom Closed Note / Instructions (Optional)
                    </label>
                    <input
                      type="text"
                      value={eventForm.registrationClosedMessage || ""}
                      onChange={(e) => setEventForm(f => ({ ...f, registrationClosedMessage: e.target.value }))}
                      placeholder="e.g. Registrations for this challenge have officially closed. Stay tuned for track updates!"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      This message will be prominently displayed on the event page inside the registration alert box.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 mt-2">
                <h4 className="text-md font-semibold text-slate-800 mb-3">Deep Details</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Description</label>
                    <textarea
                      value={eventForm.fullDesc}
                      onChange={(e) => setEventForm((f) => ({ ...f, fullDesc: e.target.value }))}
                      placeholder="Detailed explanation of the event..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none h-32"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">Rules & Guidelines (One per line)</label>
                      <span className="text-[11px] text-blue-600 font-medium">
                        Tip: Lines without bullets (• or -) become highlighted section titles!
                      </span>
                    </div>
                    <textarea
                      value={eventForm.rules}
                      onChange={(e) => setEventForm((f) => ({ ...f, rules: e.target.value }))}
                      placeholder="Before You Start&#10;• Reach the venue at least 10 minutes early.&#10;&#10;Round 1 (Quiz)&#10;• 30 questions, 1 mark each"
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-y min-h-[130px]"
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-sm font-semibold text-slate-800">Event Coordinators & Contact Numbers</h5>
                        <p className="text-xs text-slate-500">Add student coordinators and phone numbers for this event.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEventForm((f) => ({
                            ...f,
                            coordinators: [...(f.coordinators || []), { name: "", phone: "" }],
                          }));
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Coordinator
                      </button>
                    </div>

                    <div className="space-y-3 pt-1">
                      {(eventForm.coordinators || [{ name: "", phone: "" }]).map((coord, idx) => (
                        <div key={idx} className="flex items-start gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Coordinator #{idx + 1} Name
                              </label>
                              <input
                                type="text"
                                value={coord.name}
                                onChange={(e) => {
                                  const list = [...(eventForm.coordinators || [])];
                                  const current = list[idx] || { name: "", phone: "" };
                                  list[idx] = { name: e.target.value, phone: current.phone || "" };
                                  setEventForm((f) => ({ ...f, coordinators: list }));
                                }}
                                placeholder="e.g. Jevin Mangukiya"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Phone Number
                              </label>
                              <input
                                type="tel"
                                value={coord.phone}
                                onChange={(e) => {
                                  const list = [...(eventForm.coordinators || [])];
                                  const current = list[idx] || { name: "", phone: "" };
                                  list[idx] = { name: current.name || "", phone: e.target.value };
                                  setEventForm((f) => ({ ...f, coordinators: list }));
                                }}
                                placeholder="e.g. 9023105834"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                          {(eventForm.coordinators || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const list = (eventForm.coordinators || []).filter((_, i) => i !== idx);
                                setEventForm((f) => ({ ...f, coordinators: list }));
                              }}
                              className="mt-6 p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Delete coordinator"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Faculty Coordinators Section */}
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-sm font-semibold text-slate-800">Faculty Coordinators & Contact Numbers</h5>
                        <p className="text-xs text-slate-500">Add faculty coordinators and contact numbers for this event.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEventForm((f) => ({
                            ...f,
                            facultyCoordinators: [...(f.facultyCoordinators || []), { name: "", phone: "" }],
                          }));
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100/70 hover:bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Faculty Coordinator
                      </button>
                    </div>

                    <div className="space-y-3 pt-1">
                      {(eventForm.facultyCoordinators || [{ name: "", phone: "" }]).map((coord, idx) => (
                        <div key={idx} className="flex items-start gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Faculty Coordinator #{idx + 1} Name
                              </label>
                              <input
                                type="text"
                                value={coord.name}
                                onChange={(e) => {
                                  const list = [...(eventForm.facultyCoordinators || [])];
                                  const current = list[idx] || { name: "", phone: "" };
                                  list[idx] = { name: e.target.value, phone: current.phone || "" };
                                  setEventForm((f) => ({ ...f, facultyCoordinators: list }));
                                }}
                                placeholder="e.g. Prof. / Dr. Name"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Phone / Mobile Number
                              </label>
                              <input
                                type="tel"
                                value={coord.phone}
                                onChange={(e) => {
                                  const list = [...(eventForm.facultyCoordinators || [])];
                                  const current = list[idx] || { name: "", phone: "" };
                                  list[idx] = { name: current.name || "", phone: e.target.value };
                                  setEventForm((f) => ({ ...f, facultyCoordinators: list }));
                                }}
                                placeholder="e.g. 9876543210"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                              />
                            </div>
                          </div>
                          {(eventForm.facultyCoordinators || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const list = (eventForm.facultyCoordinators || []).filter((_, i) => i !== idx);
                                setEventForm((f) => ({ ...f, facultyCoordinators: list }));
                              }}
                              className="mt-6 p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Delete faculty coordinator"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Event Logo & Poster Section */}
              <div className="pt-4 border-t border-slate-100 mt-2">
                <h4 className="text-md font-semibold text-slate-800 mb-3">Event Media (Logo & Poster)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  
                  {/* Event Logo */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex flex-col items-center gap-3 text-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Event Logo</span>
                    {eventForm.logoUrl ? (
                      <img src={eventForm.logoUrl} alt="Logo preview" className="h-16 w-16 object-contain rounded-lg border border-slate-200 bg-white p-1 shadow-sm" />
                    ) : (
                      <div className="h-16 w-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 bg-white">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                    <label className="cursor-pointer">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                        <Upload className="h-3.5 w-3.5" /> {eventForm.logoUrl ? "Change Logo" : "Upload Logo"}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const targetId = editingEvent?.id || `temp-${Date.now()}`;
                            const url = await uploadEventLogo(targetId, file);
                            setEventForm(f => ({ ...f, logoUrl: url }));
                          } catch (err: any) {
                            alert(err.message || "Logo upload failed");
                          } finally {
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Event Poster Photo */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex flex-col items-center gap-3 text-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Poster Photo</span>
                    {eventForm.posterUrl ? (
                      <img src={eventForm.posterUrl} alt="Poster preview" className="h-24 w-16 object-cover rounded-lg border border-slate-200 bg-white shadow-sm" />
                    ) : (
                      <div className="h-24 w-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 bg-white">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                    <label className="cursor-pointer">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                        <Upload className="h-3.5 w-3.5" /> {eventForm.posterUrl ? "Change Poster" : "Upload Poster"}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const targetId = editingEvent?.id || `temp-${Date.now()}`;
                            const url = await uploadEventPoster(targetId, file);
                            setEventForm(f => ({ ...f, posterUrl: url }));
                          } catch (err: any) {
                            alert(err.message || "Poster upload failed");
                          } finally {
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                  </div>

                </div>
              </div>

              {/* Event Social & Community Links */}
              <div className="pt-4 border-t border-slate-100 mt-2">
                <h4 className="text-md font-semibold text-slate-800 mb-1">Event Social & Community Links</h4>
                <p className="text-xs text-slate-500 mb-3">Add specific WhatsApp participants group and Instagram links for this event. These appear on the event page as floating action buttons.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderInput(
                    "Event WhatsApp Group Link",
                    eventForm.whatsappGroupUrl,
                    (v) => setEventForm((f) => ({ ...f, whatsappGroupUrl: v })),
                    "https://chat.whatsapp.com/..."
                  )}
                  {renderInput(
                    "Event Instagram Link",
                    eventForm.instagramUrl,
                    (v) => setEventForm((f) => ({ ...f, instagramUrl: v })),
                    "https://instagram.com/..."
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button onClick={() => { setShowEventModal(false); setEditingEvent(null); }} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSaveEvent} className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm">
                <Save className="h-4 w-4" /> {editingEvent ? "Update" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CALENDAR & REMINDER SETTINGS MODAL ─── */}
      {showReminderModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
          onClick={() => setShowReminderModal(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-auto animate-in zoom-in-95 duration-150 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shadow-sm">
                  <BellRing className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Calendar & Reminder Settings</h3>
                  <p className="text-xs text-slate-500">Configure auto-calendar reminders for participant event registrations.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReminderModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 max-h-[72vh] overflow-y-auto pr-1">
              {/* Toggle 1: Auto Calendar & Reminders Enabled */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reminderForm.enabled}
                    onChange={(e) => setReminderForm(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">Enable Automatic Calendar Reminders</span>
                    <span className="text-xs text-slate-500">
                      When participants register, automatically configure Google Calendar with event timings and preset alert reminders.
                    </span>
                  </div>
                </label>
              </div>

              {/* Setting 2: Lead Time Reminder */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Event Start Reminder (Lead Time Alert)
                </label>
                <p className="text-xs text-slate-500 mb-2.5">
                  How long before the event starts should the mobile calendar alert the participant?
                </p>

                {/* Preset Pills */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                  {[
                    { label: "15 min", value: 15 },
                    { label: "30 min", value: 30 },
                    { label: "45 min", value: 45 },
                    { label: "1 Hour", value: 60 },
                    { label: "1.5 Hrs", value: 90 },
                    { label: "2 Hours", value: 120 },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setReminderForm(prev => ({ ...prev, leadTimeMinutes: preset.value }))}
                      className={cn(
                        "py-2 px-2 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer",
                        reminderForm.leadTimeMinutes === preset.value
                          ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom minutes input */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">Or custom alert time:</span>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    value={reminderForm.leadTimeMinutes}
                    onChange={(e) => setReminderForm(prev => ({ ...prev, leadTimeMinutes: parseInt(e.target.value, 10) || 60 }))}
                    className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800"
                  />
                  <span className="text-xs text-slate-500 font-medium">minutes before start</span>
                </div>
              </div>

              {/* Setting 3: Daily Reminder */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reminderForm.dailyReminderEnabled}
                    onChange={(e) => setReminderForm(prev => ({ ...prev, dailyReminderEnabled: e.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 block flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-amber-600" /> Daily Reminders Active
                    </span>
                    <span className="text-xs text-slate-600">
                      Sets daily countdown reminders and recurring schedule notices on the participant's mobile calendar.
                    </span>
                  </div>
                </label>

                {reminderForm.dailyReminderEnabled && (
                  <div className="pt-2 border-t border-amber-200/60 flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-700">Daily Alert Time:</span>
                    <input
                      type="time"
                      value={reminderForm.dailyReminderTime || "09:00"}
                      onChange={(e) => setReminderForm(prev => ({ ...prev, dailyReminderTime: e.target.value }))}
                      className="rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-bold text-slate-800"
                    />
                    <span className="text-xs text-amber-800 font-medium">(e.g. 9:00 AM daily notice)</span>
                  </div>
                )}
              </div>

              {/* Setting 4: Auto-open on Registration */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reminderForm.autoOpenCalendarOnRegister}
                    onChange={(e) => setReminderForm(prev => ({ ...prev, autoOpenCalendarOnRegister: e.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">
                      Auto-Launch Calendar upon Registration
                    </span>
                    <span className="text-xs text-slate-500">
                      Instantly opens Google Calendar and presents the mobile calendar confirmation modal right after user confirms event registration.
                    </span>
                  </div>
                </label>
              </div>

              {/* Setting 5: Title Prefix & Description Template */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Calendar Event Title Prefix
                  </label>
                  <input
                    type="text"
                    value={reminderForm.calendarTitlePrefix || ""}
                    onChange={(e) => setReminderForm(prev => ({ ...prev, calendarTitlePrefix: e.target.value }))}
                    placeholder="CONVERSE 2K26: "
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Preview: <span className="font-semibold text-slate-700">{reminderForm.calendarTitlePrefix || "CONVERSE 2K26: "}Cyber-Quiz</span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Custom Calendar Description / Reporting Instructions
                  </label>
                  <textarea
                    rows={3}
                    value={reminderForm.calendarDescriptionTemplate || ""}
                    onChange={(e) => setReminderForm(prev => ({ ...prev, calendarDescriptionTemplate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                    placeholder="Notes included in participant calendar event..."
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestReminder}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                title="Open a sample Google Calendar event in a new tab with current settings"
              >
                <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
                Test on Google Calendar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowReminderModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReminderSettings}
                  disabled={savingReminders}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingReminders ? (
                    <span>Saving…</span>
                  ) : reminderSavedToast ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" /> Saved!
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" /> Save Reminder Settings
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Registration Modal from Google Sheets / CSV */}
      <BulkRegistrationModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        eventsList={masterEvents}
      />
    </div>
  );

  function renderSection() {
    switch (section) {
      case "dashboard": return renderDashboard();
      case "events": return renderEvents();
      case "registrations": return renderRegistrations();
      case "users": return renderUsers();
      case "content": return renderContent();
      case "subadmins": return renderSubAdmins();
      case "export": return renderExport();
      case "emails": return renderEmails();
    }
  }

  /* ─── Dashboard Overview ─── */
  function renderDashboard() {
    const statCards = [
      { title: 'Total Registrations', value: registrations.length, icon: Users, color: 'bg-blue-500', onClick: () => setSection("registrations") },
      { title: 'Checked-In', value: registrations.filter(r => r.checkedIn).length, icon: CheckCircle2, color: 'bg-green-500', onClick: () => setSection("registrations") },
      { title: 'Active Events', value: events.length, icon: Calendar, color: 'bg-purple-500', onClick: () => setSection("events") },
      { title: 'Pending Check-Ins', value: registrations.filter(r => !r.checkedIn).length, icon: Clock, color: 'bg-amber-500', onClick: () => setSection("registrations") },
    ];

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Welcome Back, Admin</h2>
          <p className="text-slate-500 mt-1">Here is an overview of CONVERSE 2K26 today.</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                onClick={card.onClick}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-all group text-left w-full"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 font-medium">{card.title}</p>
                    <p className="text-3xl font-bold text-slate-800 mt-1">
                      {regsLoading || eventsLoading ? '...' : card.value}
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ─── Events Section ─── */
   function renderEvents() {
    const allEvents = masterEvents;
    
    return (
      <section className="animate-in fade-in duration-300">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Event Management</h2>
            <p className="text-slate-500 text-sm mt-1">All {allEvents.length} events for CONVERSE 2K26.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setReminderForm(config.reminderSettings || DEFAULT_SITE_CONFIG.reminderSettings);
                setShowReminderModal(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-semibold text-sm transition-all shadow-sm cursor-pointer"
              title="Configure calendar reminder timing and daily notifications"
            >
              <BellRing className="w-4 h-4 text-amber-600" />
              <span>Reminder Settings</span>
              <span className="bg-amber-200/80 text-amber-900 text-[11px] font-bold px-1.5 py-0.5 rounded-full">
                {reminderForm.leadTimeMinutes}m
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingEvent(null);
                resetEventForm();
                setShowEventModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add New Event
            </button>
          </div>
        </div>
        
        {allEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <p className="text-slate-500 font-medium">No events configured.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
                  <tr>
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Track</th>
                    <th className="px-6 py-4">Format</th>
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4 text-center">Logo</th>
                    <th className="px-6 py-4 text-center">Poster</th>
                    <th className="px-6 py-4 text-center">Registrations</th>
                    <th className="px-6 py-4 text-center">Registration Status</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {allEvents.map((ev) => {
                    const regCount = registrations.filter(r => r.eventId === ev.id).length;
                    const isUploading = uploadingLogo === ev.id;
                    return (
                    <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{ev.title}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium",
                          ev.track === "TECH" ? "bg-amber-100 text-amber-800" :
                          ev.track === "NON-TECH" ? "bg-blue-100 text-blue-800" :
                          "bg-emerald-100 text-emerald-800"
                        )}>{ev.track}</span>
                      </td>
                      <td className="px-6 py-4">{ev.format}</td>
                      <td className="px-6 py-4 text-slate-500">{ev.time}</td>
                      <td className="px-6 py-4 text-center">
                        <label className={cn(
                          "flex items-center justify-center gap-3 cursor-pointer group",
                          isUploading && "opacity-50 pointer-events-none"
                        )}>
                          {/* Left Image Logo (Now clickable!) */}
                          {ev.logoUrl ? (
                            <img src={ev.logoUrl} alt={`${ev.title} logo`} className="h-9 w-9 rounded-md object-cover border-[2px] border-slate-200 group-hover:border-blue-400 transition-colors shadow-sm" />
                          ) : (
                            <span className="h-9 w-9 rounded-md border-[2px] border-dashed border-slate-300 flex items-center justify-center text-slate-400 group-hover:border-blue-400 group-hover:text-blue-500 transition-colors bg-slate-50">
                              <ImageIcon className="h-4 w-4" />
                            </span>
                          )}
                          
                          {/* Upload Button */}
                          <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 group-hover:bg-slate-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-all shadow-sm">
                            {isUploading ? (
                              <span className="animate-spin h-3.5 w-3.5 border-2 border-slate-400 border-t-transparent rounded-full" />
                            ) : (
                              <Upload className="h-3.5 w-3.5" />
                            )}
                            {ev.logoUrl ? "Change" : "Upload"}
                          </div>

                          {/* Hidden File Input */}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                setUploadingLogo(ev.id);
                                const url = await uploadEventLogo(ev.id, file);
                                await updateEvent(ev.id, { logoUrl: url });
                              } catch (err: any) {
                                alert(err.message || "Upload failed");
                              } finally {
                                setUploadingLogo(null);
                                e.target.value = "";
                              }
                            }}
                          />
                        </label>
                      </td>

                      {/* Poster Column */}
                      <td className="px-6 py-4 text-center">
                        <label className={cn(
                          "flex items-center justify-center gap-3 cursor-pointer group",
                          uploadingPoster === ev.id && "opacity-50 pointer-events-none"
                        )}>
                          {ev.posterUrl ? (
                            <img src={ev.posterUrl} alt={`${ev.title} poster`} className="h-12 w-9 rounded-md object-cover border-[2px] border-slate-200 group-hover:border-blue-400 transition-colors shadow-sm" />
                          ) : (
                            <span className="h-12 w-9 rounded-md border-[2px] border-dashed border-slate-300 flex items-center justify-center text-slate-400 group-hover:border-blue-400 group-hover:text-blue-500 transition-colors bg-slate-50">
                              <ImageIcon className="h-4 w-4" />
                            </span>
                          )}
                          
                          <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 group-hover:bg-slate-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-all shadow-sm">
                            {uploadingPoster === ev.id ? (
                              <span className="animate-spin h-3.5 w-3.5 border-2 border-slate-400 border-t-transparent rounded-full" />
                            ) : (
                              <Upload className="h-3.5 w-3.5" />
                            )}
                            {ev.posterUrl ? "Change" : "Upload"}
                          </div>

                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                setUploadingPoster(ev.id);
                                const url = await uploadEventPoster(ev.id, file);
                                await updateEvent(ev.id, { posterUrl: url });
                              } catch (err: any) {
                                alert(err.message || "Poster upload failed");
                              } finally {
                                setUploadingPoster(null);
                                e.target.value = "";
                              }
                            }}
                          />
                        </label>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {ev.track === "NON-TECH" ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                              <ExternalLink className="h-3 w-3" /> External Form
                            </span>
                            {ev.googleFormUrl ? (
                              <a
                                href={ev.googleFormUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5"
                                title={ev.googleFormUrl}
                              >
                                Test Form ↗
                              </a>
                            ) : (
                              <span className="text-[10px] text-amber-600 font-medium">Link not set</span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                            <Users className="h-3 w-3" /> {regCount}
                          </span>
                        )}
                      </td>
                      {/* Registration Status Toggle Column */}
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={async () => {
                            const isCurrentlyOpen = ev.registrationOpen !== false;
                            const willOpen = !isCurrentlyOpen;
                            try {
                              await updateEvent(ev.id, { registrationOpen: willOpen });
                            } catch (err: any) {
                              alert("Failed to update registration status: " + (err.message || err));
                            }
                          }}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm cursor-pointer select-none",
                            ev.registrationOpen !== false
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300 group"
                              : "bg-rose-50 text-rose-800 border-rose-300 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 group"
                          )}
                          title={ev.registrationOpen !== false ? "Click to Close Registration" : "Click to Re-Open Registration"}
                        >
                          {ev.registrationOpen !== false ? (
                            <>
                              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                              <span className="group-hover:hidden font-black tracking-wide text-emerald-800">OPEN</span>
                              <span className="hidden group-hover:inline font-black tracking-wide text-rose-700">Close Reg</span>
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                              <span className="group-hover:hidden font-black tracking-wide text-rose-700">CLOSED</span>
                              <span className="hidden group-hover:inline font-black tracking-wide text-emerald-700">Re-Open</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => openEditEvent(ev)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    );
  }

  /* ─── Registrations Section ─── */
  function renderRegistrations() {
    return (
      <section className="animate-in fade-in duration-300">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Registrations</h2>
            <p className="text-slate-500 text-sm mt-1">View and filter all participants.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowBulkImportModal(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-300 px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-100 transition-colors shadow-sm cursor-pointer"
              title="Import registrations directly from Google Sheets or CSV"
            >
              <FileSpreadsheet className="h-4 w-4 text-blue-600" />
              Import from Sheet / CSV
            </button>
            <button
              type="button"
              disabled={isCleaningDuplicates}
              onClick={handleCleanDuplicates}
              className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-300 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              title="Detect and remove duplicate registrations created by rapid multiple clicks"
            >
              <Sparkles className={cn("h-4 w-4 text-amber-600", isCleaningDuplicates && "animate-spin")} />
              {isCleaningDuplicates ? "Cleaning Duplicates..." : "Clean Duplicates"}
            </button>
            <button onClick={exportCsv} disabled={isExporting} className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer disabled:opacity-50">
              <Download className={cn("h-4 w-4", isExporting && "animate-pulse")} /> {isExporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </div>

        {/* Filters & Real-time Search */}
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[240px]">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                Search Participants
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={regSearchQuery}
                  onChange={(e) => setRegSearchQuery(e.target.value)}
                  placeholder="Search name, email, event, code, or teammates..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-8 py-2 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <Users className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                {regSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setRegSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {renderFilter("Department", deptFilter, setDeptFilter, deptOptions)}
            {renderFilter("Event", eventFilter, setEventFilter, eventOptions)}
            {renderFilter("Status", statusFilter, setStatusFilter, ["All", "Checked-In", "Pending"])}
            
            <div className="ml-auto flex items-end">
              <span className="text-sm font-medium text-slate-500 pb-2">
                Showing <strong className="text-slate-800">{filteredRegs.length}</strong> of {registrations.length} records
              </span>
            </div>
          </div>
        </div>

        {regsLoading ? (
           <div className="flex h-32 items-center justify-center text-slate-400">Loading registrations...</div>
        ) : filteredRegs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <p className="text-slate-500 font-medium">
              {regSearchQuery || deptFilter !== "All" || eventFilter !== "All" || statusFilter !== "All"
                ? "No registrations match the selected filters or search query."
                : "No registrations found in the database."}
            </p>
            {regSearchQuery && (
              <button
                type="button"
                onClick={() => setRegSearchQuery("")}
                className="mt-3 text-xs font-semibold text-blue-600 hover:underline"
              >
                Clear search query
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
                  <tr>
                    <th className="px-6 py-4">Leader / User</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Dept</th>
                    <th className="px-6 py-4">Event</th>
                    <th className="px-6 py-4">Team / Members</th>
                    <th className="px-6 py-4">Entry Code</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredRegs.map((r) => {
                    const resolvedTitle = r.eventTitle || masterEvents.find((e) => e.id === r.eventId)?.title || r.eventId;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">{r.userName}</td>
                        <td className="px-6 py-4 text-slate-500">{r.userEmail}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider", 
                            r.userDept === "IT" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                          )}>
                            {r.userDept}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <span className="font-semibold text-slate-900 block text-xs">
                              {resolvedTitle}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {r.eventId}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {r.teammates && r.teammates.length > 0 ? (
                            <div>
                              <span className="font-semibold text-slate-900 text-xs block">
                                {r.teamName || "Team"} ({1 + r.teammates.length} Members)
                              </span>
                              <span className="text-[11px] text-slate-500 truncate max-w-xs block" title={`Leader: ${r.leaderName || r.userName} (${r.leaderEmail || r.userEmail}); Members: ` + r.teammates.map((t: any) => `${t.name} (${t.email})`).join(", ")}>
                                <span className="text-amber-600 font-semibold">👑 {r.leaderName || r.userName}</span> ({r.leaderEmail || r.userEmail}), {r.teammates.map((t: any) => `${t.name} (${t.email})`).join(", ")}
                              </span>
                            </div>
                          ) : r.partnerName ? (
                            <span className="text-xs text-slate-600">{r.partnerName}</span>
                          ) : (
                            <span className="text-xs text-slate-400">Solo</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {r.isNonTech || !r.entryCode ? (
                            <span className="font-sans text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded shadow-sm">
                              No Pass (Fun Event)
                            </span>
                          ) : (
                            <span className="font-mono text-xs font-bold tracking-widest text-slate-700 bg-slate-100 px-2 py-1 rounded">
                              {r.entryCode}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {r.isNonTech ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-800 border border-purple-200">
                              <Sparkles className="h-3.5 w-3.5 text-purple-600" /> Registered
                            </span>
                          ) : r.checkedIn ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Checked In
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                              <Clock className="h-3.5 w-3.5" /> Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm(`Delete registration for ${r.userName} (${resolvedTitle})? This will permanently remove their QR code and entry code.`)) {
                                try {
                                  await deleteRegistration(r.id);
                                } catch (err: any) {
                                  alert("Failed to delete registration: " + (err.message || "Unknown error"));
                                }
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50 cursor-pointer"
                            title="Delete registration"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    );
  }

  /* ─── Site Content Section ─── */
  function renderContent() {
    if (!contentForm || !contentForm.landing) return <div className="flex h-32 items-center justify-center text-slate-400">Loading content...</div>;
    const activeTab = contentSubTab;
    return (
      <section className="animate-in fade-in duration-300">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Site Configuration</h2>
            <p className="text-slate-500 text-sm mt-1">Manage global text and configurations by section.</p>
          </div>
          <button onClick={handleSaveContent} className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm sticky top-24 z-10 cursor-pointer">
            <Save className="h-4 w-4" /> {contentSaved ? "Saved Successfully ✓" : "Save Changes"}
          </button>
        </div>

        {/* Section Tabs Quick Navigation */}
        <div className="flex flex-wrap items-center gap-2 mb-6 bg-slate-200/70 p-1.5 rounded-xl border border-slate-200 max-w-5xl">
          {[
            { id: "all", label: "All Sections" },
            { id: "landing", label: "Landing Page" },
            { id: "dashboard", label: "Dashboard" },
            { id: "events", label: "Events Page" },
            { id: "profile", label: "Profile Page" },
            { id: "about", label: "About Us" },
            { id: "footer", label: "Footer Configuration ✨", highlight: true },
            { id: "team", label: "Team Page (Builders) 🧱", highlight: true },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setContentSubTab(tab.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : tab.highlight
                  ? "bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                  : "bg-white/80 text-slate-700 hover:bg-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="grid grid-cols-1 gap-8 max-w-5xl pb-10">
          
          {/* LANDING PAGE CONFIG */}
          {(activeTab === "all" || activeTab === "landing") && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h3 className="text-lg font-semibold text-slate-800">Landing Page</h3>
              <p className="text-xs text-slate-500 mt-1">These fields appear on the very first page before logging in.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {renderInput("Tagline", contentForm.landing.tagline, (v) => setContentForm((f) => f && ({ ...f, landing: { ...f.landing, tagline: v } })))}
              {renderInput("Theme / Subtitle", contentForm.landing.theme, (v) => setContentForm((f) => f && ({ ...f, landing: { ...f.landing, theme: v } })))}
              {renderInput("Date Pill Text", contentForm.landing.datePill, (v) => setContentForm((f) => f && ({ ...f, landing: { ...f.landing, datePill: v } })))}
              {renderInput(
                "Fest Start Date", 
                contentForm.landing.festStartDate || "2026-04-26T09:00:00", 
                (v) => setContentForm((f) => f && ({ ...f, landing: { ...f.landing, festStartDate: v } })),
                "",
                "datetime-local"
              )}
              <div className="text-[10px] text-slate-500 -mt-2">This is the target date/time for the countdown timers on the Dashboard and Hero.</div>
              {renderInput("Sponsors Section Title", contentForm.landing.sponsorsTitle, (v) => setContentForm((f) => f && ({ ...f, landing: { ...f.landing, sponsorsTitle: v } })))}

              {/* ── Sponsors Section On/Off Switch ── */}
              <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center transition-all shadow-sm",
                    contentForm.landing.sponsorsEnabled !== false 
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-300" 
                      : "bg-slate-200 text-slate-500 border border-slate-300"
                  )}>
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-800">Sponsors Section Display</h4>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                        contentForm.landing.sponsorsEnabled !== false 
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300" 
                          : "bg-slate-200 text-slate-600 border border-slate-300"
                      )}>
                        {contentForm.landing.sponsorsEnabled !== false ? "● ON (Visible on Home)" : "○ OFF (Hidden from Home)"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {contentForm.landing.sponsorsEnabled !== false
                        ? "The Sponsors Showcase section is currently enabled and visible to visitors on the home page."
                        : "The Sponsors Showcase section is currently turned off and completely hidden from the home page."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {savingSponsorsToggle ? (
                    <span className="text-xs font-bold text-blue-600 animate-pulse flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" /> Saving...
                    </span>
                  ) : sponsorsSavedToast ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-in fade-in">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Saved!
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-600">
                      {contentForm.landing.sponsorsEnabled !== false ? "Enabled" : "Disabled"}
                    </span>
                  )}

                  <button
                    type="button"
                    role="switch"
                    disabled={savingSponsorsToggle}
                    aria-checked={contentForm.landing.sponsorsEnabled !== false}
                    onClick={handleToggleSponsors}
                    className={cn(
                      "relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-inner disabled:opacity-50",
                      contentForm.landing.sponsorsEnabled !== false ? "bg-emerald-600" : "bg-slate-300"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                        contentForm.landing.sponsorsEnabled !== false ? "translate-x-6" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* ── Sponsor Management Panel ── */}
              <div className="lg:col-span-2 space-y-3">
                <label className="block text-sm font-medium text-slate-700 mb-2">Sponsors</label>
                {contentForm.landing.sponsors.map((sp, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2" style={{ borderLeft: `4px solid ${sp.color || '#C91A09'}` }}>
                    {/* Row 1: Name, URL, Color, Actions */}
                    <div className="flex items-center gap-2">
                      <input
                        value={sp.name}
                        onChange={(e) => {
                          const updated = [...contentForm.landing.sponsors];
                          updated[i] = { ...updated[i]!, name: e.target.value };
                          setContentForm((f) => f && ({ ...f, landing: { ...f.landing, sponsors: updated } }));
                        }}
                        placeholder="Sponsor name"
                        className="flex-1 min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                      <input
                        value={sp.url}
                        onChange={(e) => {
                          const updated = [...contentForm.landing.sponsors];
                          updated[i] = { ...updated[i]!, url: e.target.value };
                          setContentForm((f) => f && ({ ...f, landing: { ...f.landing, sponsors: updated } }));
                        }}
                        placeholder="https://sponsor-website.com"
                        className="flex-[1.2] min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: sp.color || '#C91A09' }} />
                        <select
                          value={sp.color || '#C91A09'}
                          onChange={(e) => {
                            const updated = [...contentForm.landing.sponsors];
                            updated[i] = { ...updated[i]!, color: e.target.value };
                            setContentForm((f) => f && ({ ...f, landing: { ...f.landing, sponsors: updated } }));
                          }}
                          className="w-24 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="#C91A09">Red</option>
                          <option value="#E8B800">Yellow</option>
                          <option value="#0055BF">Blue</option>
                          <option value="#1b1b1b">Black</option>
                        </select>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => { if (i === 0) return; const updated = [...contentForm.landing.sponsors]; [updated[i - 1], updated[i]] = [updated[i]!, updated[i - 1]!]; setContentForm((f) => f && ({ ...f, landing: { ...f.landing, sponsors: updated } })); }} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer" disabled={i === 0} title="Move up">↑</button>
                        <button type="button" onClick={() => { if (i >= contentForm.landing.sponsors.length - 1) return; const updated = [...contentForm.landing.sponsors]; [updated[i], updated[i + 1]] = [updated[i + 1]!, updated[i]!]; setContentForm((f) => f && ({ ...f, landing: { ...f.landing, sponsors: updated } })); }} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer" disabled={i >= contentForm.landing.sponsors.length - 1} title="Move down">↓</button>
                        <button type="button" onClick={() => { const updated = contentForm.landing.sponsors.filter((_, j) => j !== i); setContentForm((f) => f && ({ ...f, landing: { ...f.landing, sponsors: updated } })); }} className="rounded-md border border-red-300 bg-white px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 cursor-pointer" title="Remove">✕</button>
                      </div>
                    </div>
                    {/* Row 2: Description */}
                    <input
                      value={sp.desc || ""}
                      onChange={(e) => {
                        const updated = [...contentForm.landing.sponsors];
                        updated[i] = { ...updated[i]!, desc: e.target.value };
                        setContentForm((f) => f && ({ ...f, landing: { ...f.landing, sponsors: updated } }));
                      }}
                      placeholder="Short tagline or description (e.g. 'AI-powered solutions')"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const COLORS = ["#C91A09", "#E8B800", "#0055BF", "#1b1b1b"];
                    const newSponsor = { name: "New Sponsor", url: "", color: COLORS[contentForm.landing.sponsors.length % COLORS.length]!, desc: "" };
                    setContentForm((f) => f && ({ ...f, landing: { ...f.landing, sponsors: [...f.landing.sponsors, newSponsor] } }));
                  }}
                  className="rounded-lg border border-dashed border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  + Add Sponsor
                </button>
              </div>
            </div>
          </div>
          )}

          {/* DASHBOARD CONFIG */}
          {(activeTab === "all" || activeTab === "dashboard") && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h3 className="text-lg font-semibold text-slate-800">Dashboard Page</h3>
              <p className="text-xs text-slate-500 mt-1">These fields appear on the main dashboard after a user logs in.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ── Dashboard Explore Fest (What's On Your Build Plan) Toggle ── */}
              <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center transition-all shadow-sm shrink-0",
                    contentForm.dashboard.exploreEnabled !== false 
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-300" 
                      : "bg-slate-200 text-slate-500 border border-slate-300"
                  )}>
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-800">"What's On Your Build Plan?" Section Display</h4>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                        contentForm.dashboard.exploreEnabled !== false 
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300" 
                          : "bg-slate-200 text-slate-600 border border-slate-300"
                      )}>
                        {contentForm.dashboard.exploreEnabled !== false ? "● ON (Visible on Dashboard)" : "○ OFF (Hidden from Dashboard)"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {contentForm.dashboard.exploreEnabled !== false
                        ? 'The 4-pillar explore cards (Compete, Create, Collaborate, Conquer) are currently enabled and visible on the dashboard.'
                        : 'The "What\'s On Your Build Plan?" explore cards are currently turned off and completely hidden from the dashboard.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {savingExploreToggle ? (
                    <span className="text-xs font-bold text-blue-600 animate-pulse flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" /> Saving...
                    </span>
                  ) : exploreSavedToast ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-in fade-in">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Saved!
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-600">
                      {contentForm.dashboard.exploreEnabled !== false ? "Enabled" : "Disabled"}
                    </span>
                  )}

                  <button
                    type="button"
                    role="switch"
                    disabled={savingExploreToggle}
                    aria-checked={contentForm.dashboard.exploreEnabled !== false}
                    onClick={handleToggleDashboardExplore}
                    className={cn(
                      "relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-inner disabled:opacity-50",
                      contentForm.dashboard.exploreEnabled !== false ? "bg-emerald-600" : "bg-slate-300"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                        contentForm.dashboard.exploreEnabled !== false ? "translate-x-6" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>

              {renderInput("Dashboard Tagline", contentForm.dashboard.tagline, (v) => setContentForm((f) => f && ({ ...f, dashboard: { ...f.dashboard, tagline: v } })))}
              {renderInput("Build Box Title", contentForm.dashboard.buildBoxTitle, (v) => setContentForm((f) => f && ({ ...f, dashboard: { ...f.dashboard, buildBoxTitle: v } })))}
              
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Hero Description</label>
                <textarea value={contentForm.dashboard.heroDesc} onChange={(e) => setContentForm((f) => f && ({ ...f, dashboard: { ...f.dashboard, heroDesc: e.target.value } }))} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none h-20" />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Build Box Description</label>
                <textarea value={contentForm.dashboard.buildBoxDesc} onChange={(e) => setContentForm((f) => f && ({ ...f, dashboard: { ...f.dashboard, buildBoxDesc: e.target.value } }))} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none h-20" />
              </div>
              
              {renderInput("Explore Section Title (What's on your build plan?)", contentForm.dashboard.exploreTitle, (v) => setContentForm((f) => f && ({ ...f, dashboard: { ...f.dashboard, exploreTitle: v } })))}
            </div>
          </div>
          )}

          {/* EVENTS PAGE CONFIG */}
          {(activeTab === "all" || activeTab === "events") && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h3 className="text-lg font-semibold text-slate-800">Events Page</h3>
              <p className="text-xs text-slate-500 mt-1">These fields appear at the top of the Events page.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {renderInput("Page Title", contentForm.events.pageTitle, (v) => setContentForm((f) => f && ({ ...f, events: { ...f.events, pageTitle: v } })))}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Page Description</label>
                <textarea value={contentForm.events.pageDesc} onChange={(e) => setContentForm((f) => f && ({ ...f, events: { ...f.events, pageDesc: e.target.value } }))} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none h-20" />
              </div>
            </div>
          </div>
          )}

          {/* PROFILE PAGE CONFIG */}
          {(activeTab === "all" || activeTab === "profile") && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h3 className="text-lg font-semibold text-slate-800">Profile Page</h3>
              <p className="text-xs text-slate-500 mt-1">These fields appear at the top of the User Profile page.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {renderInput("Page Title", contentForm.profile.pageTitle, (v) => setContentForm((f) => f && ({ ...f, profile: { ...f.profile, pageTitle: v } })))}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Page Description</label>
                <textarea value={contentForm.profile.pageDesc} onChange={(e) => setContentForm((f) => f && ({ ...f, profile: { ...f.profile, pageDesc: e.target.value } }))} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none h-20" />
              </div>
            </div>
          </div>
          )}

          {/* ABOUT US PAGE CONFIG */}
          {(activeTab === "all" || activeTab === "about") && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h3 className="text-lg font-semibold text-slate-800">About Us Page</h3>
              <p className="text-xs text-slate-500 mt-1">Content and links for the About Us page.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {renderInput("Page Title", contentForm.about.pageTitle, (v) => setContentForm((f) => f && ({ ...f, about: { ...f.about, pageTitle: v } })))}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Page Description</label>
                <textarea value={contentForm.about.pageDesc} onChange={(e) => setContentForm((f) => f && ({ ...f, about: { ...f.about, pageDesc: e.target.value } }))} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none h-16" />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Paragraph 1</label>
                <textarea value={contentForm.about.paragraph1} onChange={(e) => setContentForm((f) => f && ({ ...f, about: { ...f.about, paragraph1: e.target.value } }))} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none h-20" />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Paragraph 2</label>
                <textarea value={contentForm.about.paragraph2} onChange={(e) => setContentForm((f) => f && ({ ...f, about: { ...f.about, paragraph2: e.target.value } }))} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none h-20" />
              </div>
              {renderInput("Instagram URL", contentForm.about.instagramUrl, (v) => setContentForm((f) => f && ({ ...f, about: { ...f.about, instagramUrl: v } })))}
              {renderInput("WhatsApp URL", contentForm.about.whatsappUrl, (v) => setContentForm((f) => f && ({ ...f, about: { ...f.about, whatsappUrl: v } })))}
            </div>
          </div>
          )}

          {/* FOOTER CONFIGURATION */}
          {(activeTab === "all" || activeTab === "footer") && (
          <div id="footer-configuration" className="bg-white rounded-xl shadow-sm border-2 border-blue-200/90 p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4 mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse" />
                  <h3 className="text-lg font-bold text-slate-800">Footer Configuration</h3>
                  <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">Site-Wide Footer</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Manage Head of Department, Faculty Coordinators, Student Heads, Instagram link, and designer credits displayed across all pages.
                </p>
              </div>
              <button onClick={handleSaveContent} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm cursor-pointer">
                <Save className="h-3.5 w-3.5" /> {contentSaved ? "Saved Successfully ✓" : "Save Footer"}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Head of Department */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Head of Department</h4>
                {renderInput(
                  "Section Title",
                  contentForm.footer?.hodTitle || "Head of Department",
                  (v) => setContentForm((f) => f && ({ ...f, footer: { ...(f.footer || DEFAULT_SITE_CONFIG.footer), hodTitle: v } }))
                )}
                {renderInput(
                  "HOD Name",
                  contentForm.footer?.hodName || "Dr. Vivaksha Jariwala",
                  (v) => setContentForm((f) => f && ({ ...f, footer: { ...(f.footer || DEFAULT_SITE_CONFIG.footer), hodName: v } }))
                )}
              </div>

              {/* Social Media - Instagram Only */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Social Media (Instagram Only)</h4>
                <p className="text-xs text-slate-500">Only Instagram link is displayed in the footer as requested.</p>
                {renderInput(
                  "Instagram URL",
                  contentForm.footer?.instagramUrl || "https://instagram.com",
                  (v) => setContentForm((f) => f && ({ ...f, footer: { ...(f.footer || DEFAULT_SITE_CONFIG.footer), instagramUrl: v } })),
                  "https://instagram.com/converse_scet"
                )}
              </div>

              {/* Faculty Coordinators */}
              <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Faculty Coordinators</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setContentForm((f) => {
                        if (!f) return f;
                        const currentFooter = f.footer || DEFAULT_SITE_CONFIG.footer;
                        return {
                          ...f,
                          footer: {
                            ...currentFooter,
                            facultyCoordinators: [...(currentFooter.facultyCoordinators || []), ""],
                          },
                        };
                      });
                    }}
                    className="rounded-md border border-blue-600 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    + Add Coordinator
                  </button>
                </div>
                {renderInput(
                  "Section Title",
                  contentForm.footer?.facultyTitle || "Faculty Coordinators",
                  (v) => setContentForm((f) => f && ({ ...f, footer: { ...(f.footer || DEFAULT_SITE_CONFIG.footer), facultyTitle: v } }))
                )}

                <div className="space-y-2 pt-1">
                  {(contentForm.footer?.facultyCoordinators || DEFAULT_SITE_CONFIG.footer.facultyCoordinators).map(
                    (coord, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={coord}
                          onChange={(e) => {
                            const currentFooter = contentForm.footer || DEFAULT_SITE_CONFIG.footer;
                            const list = [...(currentFooter.facultyCoordinators || [])];
                            list[idx] = e.target.value;
                            setContentForm((f) => f && ({ ...f, footer: { ...currentFooter, facultyCoordinators: list } }));
                          }}
                          placeholder="e.g. Prof. Faculty Name"
                          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const currentFooter = contentForm.footer || DEFAULT_SITE_CONFIG.footer;
                            const list = (currentFooter.facultyCoordinators || []).filter((_, i) => i !== idx);
                            setContentForm((f) => f && ({ ...f, footer: { ...currentFooter, facultyCoordinators: list } }));
                          }}
                          className="rounded-md border border-rose-300 bg-white px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="Remove coordinator"
                        >
                          ✕
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Student Heads */}
              <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Student Heads</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setContentForm((f) => {
                        if (!f) return f;
                        const currentFooter = f.footer || DEFAULT_SITE_CONFIG.footer;
                        return {
                          ...f,
                          footer: {
                            ...currentFooter,
                            studentHeads: [...(currentFooter.studentHeads || []), { name: "", phone: "" }],
                          },
                        };
                      });
                    }}
                    className="rounded-md border border-blue-600 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    + Add Student Head
                  </button>
                </div>
                {renderInput(
                  "Section Title",
                  contentForm.footer?.studentHeadsTitle || "Student Heads",
                  (v) => setContentForm((f) => f && ({ ...f, footer: { ...(f.footer || DEFAULT_SITE_CONFIG.footer), studentHeadsTitle: v } }))
                )}

                <div className="space-y-2 pt-1">
                  {(contentForm.footer?.studentHeads || DEFAULT_SITE_CONFIG.footer.studentHeads).map((sh, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        value={sh.name}
                        onChange={(e) => {
                          const currentFooter = contentForm.footer || DEFAULT_SITE_CONFIG.footer;
                          const list = [...(currentFooter.studentHeads || [])];
                          const existing = list[idx] || { name: "", phone: "" };
                          list[idx] = { name: e.target.value, phone: existing.phone };
                          setContentForm((f) => f && ({ ...f, footer: { ...currentFooter, studentHeads: list } }));
                        }}
                        placeholder="Student Name (e.g. Utsav Vachhani)"
                        className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                      <input
                        type="text"
                        value={sh.phone}
                        onChange={(e) => {
                          const currentFooter = contentForm.footer || DEFAULT_SITE_CONFIG.footer;
                          const list = [...(currentFooter.studentHeads || [])];
                          const existing = list[idx] || { name: "", phone: "" };
                          list[idx] = { name: existing.name, phone: e.target.value };
                          setContentForm((f) => f && ({ ...f, footer: { ...currentFooter, studentHeads: list } }));
                        }}
                        placeholder="Phone (e.g. (+91 9512655868))"
                        className="w-full sm:w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const currentFooter = contentForm.footer || DEFAULT_SITE_CONFIG.footer;
                          const list = (currentFooter.studentHeads || []).filter((_, i) => i !== idx);
                          setContentForm((f) => f && ({ ...f, footer: { ...currentFooter, studentHeads: list } }));
                        }}
                        className="rounded-md border border-rose-300 bg-white px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer self-end sm:self-auto"
                        title="Remove student head"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Credits & Copyright */}
              <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Credits & Copyright</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {renderInput(
                    "Designed & Developed By Text",
                    contentForm.footer?.designedByText || "Designed & Developed by Malhar Balar and Harsh Gajera",
                    (v) => setContentForm((f) => f && ({ ...f, footer: { ...(f.footer || DEFAULT_SITE_CONFIG.footer), designedByText: v } })),
                    "Designed & Developed by Malhar Balar and Harsh Gajera"
                  )}
                  {renderInput(
                    "Copyright Notice",
                    contentForm.footer?.copyrightText || "© Converse 2026. All Rights Reserved",
                    (v) => setContentForm((f) => f && ({ ...f, footer: { ...(f.footer || DEFAULT_SITE_CONFIG.footer), copyrightText: v } })),
                    "© Converse 2026. All Rights Reserved"
                  )}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* TEAM PAGE CONFIG */}
          {(activeTab === "all" || activeTab === "team") && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-blue-600" />
                    <h3 className="text-lg font-bold text-slate-800">Team Page (The Builders) 🧱</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage the hero text, call-to-action, committees, and individual members displayed on the /team page.
                  </p>
                </div>
              </div>

              {/* Hero & CTA Settings */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Page Header & Hero Banner</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderInput(
                    "Hero Eyebrow (Badge)",
                    contentForm.team?.heroEyebrow || DEFAULT_SITE_CONFIG.team!.heroEyebrow,
                    (v) => setContentForm((f) => f && ({ ...f, team: { ...(f.team || DEFAULT_SITE_CONFIG.team!), heroEyebrow: v } }))
                  )}
                  {renderInput(
                    "Hero Title",
                    contentForm.team?.heroTitle || DEFAULT_SITE_CONFIG.team!.heroTitle,
                    (v) => setContentForm((f) => f && ({ ...f, team: { ...(f.team || DEFAULT_SITE_CONFIG.team!), heroTitle: v } }))
                  )}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Hero Subtitle / Description</label>
                    <textarea
                      value={contentForm.team?.heroSubtitle || DEFAULT_SITE_CONFIG.team!.heroSubtitle}
                      onChange={(e) => setContentForm((f) => f && ({ ...f, team: { ...(f.team || DEFAULT_SITE_CONFIG.team!), heroSubtitle: e.target.value } }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none h-18"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      Closing Call to Action (Bottom of Page)
                    </h4>
                  </div>

                  {/* ── Closing CTA On/Off Switch & Button ── */}
                  <div className={cn(
                    "rounded-xl border p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm mb-4 transition-all",
                    contentForm.team?.ctaEnabled !== false 
                      ? "border-emerald-200 bg-white" 
                      : "border-slate-300 bg-slate-100/90"
                  )}>
                    <div className="flex items-center gap-3.5">
                      <div className={cn(
                        "h-11 w-11 rounded-xl flex items-center justify-center transition-all shadow-xs shrink-0",
                        contentForm.team?.ctaEnabled !== false 
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-300" 
                          : "bg-slate-200 text-slate-500 border border-slate-300"
                      )}>
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h5 className="text-sm font-bold text-slate-800">CTA Section Status</h5>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1",
                            contentForm.team?.ctaEnabled !== false 
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300" 
                              : "bg-rose-100 text-rose-800 border border-rose-200"
                          )}>
                            <span className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              contentForm.team?.ctaEnabled !== false ? "bg-emerald-600 animate-pulse" : "bg-rose-500"
                            )} />
                            {contentForm.team?.ctaEnabled !== false ? "ON (Visible on /team)" : "OFF (Hidden from /team)"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 max-w-lg leading-relaxed">
                          {contentForm.team?.ctaEnabled !== false
                            ? "The 'Want to help build the next one?' Call to Action card is currently visible at the bottom of the Team page."
                            : "The 'Want to help build the next one?' Call to Action card is currently turned OFF and completely hidden from visitors on the Team page."}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 sm:gap-3">
                      {savingTeamCtaToggle ? (
                        <span className="text-xs font-bold text-blue-600 animate-pulse flex items-center gap-1 mr-1">
                          <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" /> Saving...
                        </span>
                      ) : teamCtaSavedToast ? (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 mr-1 animate-in fade-in">
                          <CheckCircle2 className="h-4 w-4" /> Saved!
                        </span>
                      ) : null}

                      {/* Explicit Action Button */}
                      {contentForm.team?.ctaEnabled !== false ? (
                        <button
                          type="button"
                          onClick={handleToggleTeamCta}
                          disabled={savingTeamCtaToggle}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:border-rose-300 active:scale-95 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                          title="Click to Turn OFF and hide from /team"
                        >
                          <EyeOff className="h-3.5 w-3.5 text-rose-600" />
                          <span>Turn OFF</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleToggleTeamCta}
                          disabled={savingTeamCtaToggle}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                          title="Click to Turn ON and show on /team"
                        >
                          <Eye className="h-3.5 w-3.5 text-white" />
                          <span>Turn ON</span>
                        </button>
                      )}

                      {/* Toggle Switch Pill */}
                      <button
                        type="button"
                        onClick={handleToggleTeamCta}
                        disabled={savingTeamCtaToggle}
                        className={cn(
                          "relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50",
                          contentForm.team?.ctaEnabled !== false ? "bg-emerald-600" : "bg-slate-300"
                        )}
                        role="switch"
                        aria-checked={contentForm.team?.ctaEnabled !== false}
                        title={contentForm.team?.ctaEnabled !== false ? "Click to Turn OFF" : "Click to Turn ON"}
                      >
                        <span className="sr-only">Toggle Closing CTA Section</span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                            contentForm.team?.ctaEnabled !== false ? "translate-x-6" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                  </div>

                  {contentForm.team?.ctaEnabled === false && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800 flex items-center gap-2 mb-4">
                      <span className="text-base">⚠️</span>
                      <span>
                        <strong>Section is currently Turned OFF:</strong> The Call to Action card below will not appear to visitors on the live <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">/team</code> page. Turn it back ON anytime above.
                      </span>
                    </div>
                  )}

                  <div className={cn(
                    "grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity",
                    contentForm.team?.ctaEnabled === false && "opacity-45 pointer-events-none"
                  )}>
                    {renderInput(
                      "CTA Title",
                      contentForm.team?.ctaTitle || DEFAULT_SITE_CONFIG.team!.ctaTitle,
                      (v) => setContentForm((f) => f && ({ ...f, team: { ...(f.team || DEFAULT_SITE_CONFIG.team!), ctaTitle: v } }))
                    )}
                    {renderInput(
                      "CTA Button Text",
                      contentForm.team?.ctaButtonText || DEFAULT_SITE_CONFIG.team!.ctaButtonText,
                      (v) => setContentForm((f) => f && ({ ...f, team: { ...(f.team || DEFAULT_SITE_CONFIG.team!), ctaButtonText: v } }))
                    )}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">CTA Subtitle / Description</label>
                      <textarea
                        value={contentForm.team?.ctaSubtitle || DEFAULT_SITE_CONFIG.team!.ctaSubtitle}
                        onChange={(e) => setContentForm((f) => f && ({ ...f, team: { ...(f.team || DEFAULT_SITE_CONFIG.team!), ctaSubtitle: e.target.value } }))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none h-18"
                        placeholder="We're always looking for hands who care about doing things properly. No experience required — just show up."
                      />
                    </div>
                    <div className="sm:col-span-2">
                      {renderInput(
                        "CTA Button Link (e.g. WhatsApp Group Link)",
                        contentForm.team?.ctaButtonLink || DEFAULT_SITE_CONFIG.team!.ctaButtonLink,
                        (v) => setContentForm((f) => f && ({ ...f, team: { ...(f.team || DEFAULT_SITE_CONFIG.team!), ctaButtonLink: v } }))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Committees & Builders Manager */}
              <div className="space-y-6">
                {/* Team Import Toast Notification */}
                {teamImportToast && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <span className="text-sm font-semibold">{teamImportToast}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveTeamDirect}
                        disabled={teamDirectSaving}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {teamDirectSaving ? "Saving..." : "Save to Firestore Now"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTeamImportToast(null)}
                        className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-1.5 py-0.5 rounded hover:bg-emerald-100"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                {/* Team Roster Action Command Bar */}
                <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 p-5 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-300 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 tracking-wide uppercase">
                          CONVERSE 2K26 Roster Engine
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          • {((contentForm.team?.categories || DEFAULT_SITE_CONFIG.team!.categories) as TeamCategory[]).length} Categories Loaded
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 mt-1">Official Team & Committee Management</h4>
                      <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
                        All 16 committees and event tracks from the official roster (Faculty, Student Leads, Tech, Finance, Marketing, Codathon, Cyber Quiz, etc.) can be loaded with 1-click or imported from a JSON file, then saved to Firestore.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to="/team"
                        target="_blank"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-all shadow-xs"
                      >
                        Preview Live /team <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-blue-100">
                    <button
                      type="button"
                      onClick={handleLoadOfficialRoster}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-sm cursor-pointer"
                      title="Populate editor with all 16 official categories and 119 members"
                    >
                      <Sparkles className="h-4 w-4" /> Load Official 2K26 Form Roster
                    </button>

                    <input
                      type="file"
                      ref={teamFileInputRef}
                      onChange={handleImportTeamJson}
                      accept=".json"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => teamFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-xs cursor-pointer"
                      title="Upload and import a custom team-roster JSON file"
                    >
                      <FileUp className="h-4 w-4 text-slate-600" /> Upload / Import JSON
                    </button>

                    <button
                      type="button"
                      onClick={handleExportTeamJson}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-xs cursor-pointer"
                      title="Download current roster as a JSON file backup"
                    >
                      <FileDown className="h-4 w-4 text-slate-600" /> Export JSON
                    </button>

                    <a
                      href="/team-roster-2026.json"
                      download="team-roster-2026.json"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-white hover:text-blue-600 transition-all shadow-xs"
                      title="Download the bundled official template JSON"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Template
                    </a>

                    <button
                      type="button"
                      onClick={() => handleAddCategorySection("committee")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-600 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 active:scale-95 transition-all cursor-pointer shadow-xs"
                      title="Add a new Committee section (with Head & Member options)"
                    >
                      <Plus className="h-4 w-4" /> Add Committee Section
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddCategorySection("event")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 active:scale-95 transition-all cursor-pointer shadow-xs"
                      title="Add a new Event Track section (with Coordinator & Volunteer options)"
                    >
                      <Plus className="h-4 w-4" /> Add Event Track Section
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowSectionOrderModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-purple-600 bg-purple-50 px-3.5 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 active:scale-95 transition-all cursor-pointer shadow-xs"
                      title="Open Section Positions to drag and drop section names in order"
                    >
                      <ListOrdered className="h-4 w-4 text-purple-600" /> Position & Order
                    </button>

                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveTeamDirect}
                        disabled={teamDirectSaving}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {teamDirectSaving ? "Saving to Firestore..." : "Save Team Changes to Firestore"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div>
                    <h4 className="text-base font-bold text-slate-800">Committees & Builder Bricks</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Organized by committee bricks (Head of Dept, Faculty, Student Heads, Tech, Design, etc. followed by Event Tracks).
                    </p>
                  </div>
                </div>

                {/* Committees & Event Tracks List */}
                {(() => {
                  const allCategories = (contentForm.team?.categories || DEFAULT_SITE_CONFIG.team!.categories) as TeamCategory[];
                  return allCategories.map((cat, catIdx) => {
                    const catNameLower = (cat.name || "").toLowerCase();
                    const isLeadership = cat.id === "leadership-advisory" || catNameLower.includes("leadership") || catNameLower.includes("hod") || catNameLower.includes("faculty");
                    const isStudentLeads = cat.id === "student-heads" || catNameLower.includes("student head") || catNameLower.includes("student lead");
                    const isEvent = cat.id.startsWith("event-") || 
                      catNameLower.includes("event") || 
                      catNameLower.includes("codathon") || 
                      catNameLower.includes("arena") || 
                      catNameLower.includes("crafter") || 
                      catNameLower.includes("hunt") || 
                      catNameLower.includes("quiz") || 
                      catNameLower.includes("robot") || 
                      catNameLower.includes("clash") || 
                      catNameLower.includes("escape");

                    return (
                      <div
                        key={cat.id || catIdx}
                        className={cn(
                          "rounded-xl border p-4 sm:p-5 shadow-sm space-y-4 transition-all",
                          isEvent
                            ? "border-emerald-300 bg-gradient-to-b from-emerald-50/30 via-white to-white"
                            : isLeadership
                              ? "border-rose-300 bg-gradient-to-b from-rose-50/30 via-white to-white"
                              : isStudentLeads
                                ? "border-amber-300 bg-gradient-to-b from-amber-50/30 via-white to-white"
                                : "border-slate-300 bg-white"
                        )}
                      >
                        {/* Committee / Track Header Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                          <div className="flex flex-1 items-center gap-2.5 min-w-[260px]">
                            {/* Section Sequence & Type Badge */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="rounded-md bg-slate-800 text-white font-mono text-[11px] font-bold px-1.5 py-0.5" title="Section Order Index">
                                #{catIdx + 1}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border",
                                  isEvent
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                    : isLeadership
                                      ? "bg-rose-100 text-rose-800 border-rose-300"
                                      : isStudentLeads
                                        ? "bg-amber-100 text-amber-800 border-amber-300"
                                        : "bg-blue-100 text-blue-800 border-blue-300"
                                )}
                              >
                                {isEvent ? "EVENT TRACK" : isLeadership ? "LEADERSHIP" : isStudentLeads ? "STUDENT LEADS" : "COMMITTEE"}
                              </span>
                            </div>

                            {/* Section Type Switcher */}
                            <select
                              value={isEvent ? "event" : isLeadership ? "leadership" : isStudentLeads ? "student" : "committee"}
                              onChange={(e) => {
                                const newType = e.target.value;
                                setContentForm((f) => {
                                  if (!f) return f;
                                  const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                  const updatedCats = [...currentTeam.categories];
                                  const target = { ...updatedCats[catIdx]! };
                                  if (newType === "event") {
                                    if (!target.id.startsWith("event-")) target.id = `event-${target.id.replace(/^committee-/, "")}`;
                                  } else if (newType === "committee") {
                                    target.id = target.id.replace(/^event-/, "committee-");
                                  }
                                  updatedCats[catIdx] = target;
                                  return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                });
                              }}
                              className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 outline-none cursor-pointer"
                              title="Switch Section Type"
                            >
                              <option value="committee">🏛️ Committee</option>
                              <option value="event">🏆 Event Track</option>
                              <option value="student">🎓 Student Leads</option>
                              <option value="leadership">👑 Leadership</option>
                            </select>

                            {/* Color selector */}
                            <select
                              value={cat.color}
                              onChange={(e) => {
                                const colorVal = e.target.value as TeamCategory["color"];
                                setContentForm((f) => {
                                  if (!f) return f;
                                  const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                  const updatedCats = [...currentTeam.categories];
                                  updatedCats[catIdx] = { ...updatedCats[catIdx]!, color: colorVal };
                                  return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                });
                              }}
                              className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700 outline-none cursor-pointer shrink-0"
                              title="Lego Brick Accent Color"
                            >
                              <option value="red">🔴 Red</option>
                              <option value="yellow">🟡 Yellow</option>
                              <option value="blue">🔵 Blue</option>
                              <option value="black">⚫ Black</option>
                              <option value="purple">🟣 Purple</option>
                              <option value="emerald">🟢 Emerald</option>
                              <option value="gray">⚪ Gray</option>
                            </select>

                            {/* Section Name */}
                            <input
                              type="text"
                              value={cat.name}
                              onChange={(e) => {
                                const newName = e.target.value;
                                setContentForm((f) => {
                                  if (!f) return f;
                                  const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                  const updatedCats = [...currentTeam.categories];
                                  updatedCats[catIdx] = { ...updatedCats[catIdx]!, name: newName };
                                  return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                });
                              }}
                              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                              placeholder={isEvent ? "Event Name (e.g. Codathon, Web Crafters)" : "Committee Name (e.g. Website & Tech, Finance)"}
                            />
                          </div>

                          {/* Reorder & Delete Controls */}
                          <div className="flex items-center gap-1.5">
                            {/* Move Up / Move Down single step */}
                            <button
                              type="button"
                              disabled={catIdx === 0}
                              onClick={() => {
                                if (catIdx === 0) return;
                                setContentForm((f) => {
                                  if (!f) return f;
                                  const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                  const updatedCats = [...currentTeam.categories];
                                  [updatedCats[catIdx - 1], updatedCats[catIdx]] = [updatedCats[catIdx]!, updatedCats[catIdx - 1]!];
                                  return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                });
                              }}
                              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                              title="Move 1 Step Up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={catIdx === allCategories.length - 1}
                              onClick={() => {
                                setContentForm((f) => {
                                  if (!f) return f;
                                  const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                  const updatedCats = [...currentTeam.categories];
                                  if (catIdx >= updatedCats.length - 1) return f;
                                  [updatedCats[catIdx], updatedCats[catIdx + 1]] = [updatedCats[catIdx + 1]!, updatedCats[catIdx]!];
                                  return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                });
                              }}
                              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                              title="Move 1 Step Down"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!confirm(`Are you sure you want to delete "${cat.name}" and all its members?`)) return;
                                setContentForm((f) => {
                                  if (!f) return f;
                                  const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                  const updatedCats = currentTeam.categories.filter((_, i) => i !== catIdx);
                                  return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                });
                              }}
                              className="rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer ml-1"
                              title="Delete Section"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Optional Subtitle / Description */}
                        <div>
                          <input
                            type="text"
                            value={cat.description || ""}
                            onChange={(e) => {
                              const desc = e.target.value;
                              setContentForm((f) => {
                                if (!f) return f;
                                const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                const updatedCats = [...currentTeam.categories];
                                updatedCats[catIdx] = { ...updatedCats[catIdx]!, description: desc };
                                return { ...f, team: { ...currentTeam, categories: updatedCats } };
                              });
                            }}
                            placeholder="Short description or tagline (optional)"
                            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 outline-none"
                          />
                        </div>

                        {/* Members inside this Section */}
                        <div className="space-y-3 pt-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                {isEvent ? "Faculty, Coordinators & Volunteers" : "Heads & Members"} ({cat.members?.length || 0})
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                • {isEvent ? "Event Track" : isLeadership ? "Leadership" : isStudentLeads ? "Student Leads" : "Committee"}
                              </span>
                            </div>

                            {/* Differentiated Add Buttons */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {isEvent ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleAddMemberToCategory(catIdx, getFullRoleName(cat.name, "faculty", true))}
                                    className="inline-flex items-center gap-1 rounded-md border border-purple-300 bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700 hover:bg-purple-100 cursor-pointer shadow-xs transition-colors"
                                    title="Add an Event Faculty Coordinator / Advisor to this track"
                                  >
                                    <Plus className="h-3 w-3" /> Add Event Faculty
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddMemberToCategory(catIdx, getFullRoleName(cat.name, "coordinator", true))}
                                    className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer shadow-xs transition-colors"
                                    title="Add an Event Coordinator to this track"
                                  >
                                    <Plus className="h-3 w-3" /> Add Coordinator
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddMemberToCategory(catIdx, getFullRoleName(cat.name, "volunteer", true))}
                                    className="inline-flex items-center gap-1 rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100 cursor-pointer shadow-xs transition-colors"
                                    title="Add an Event Volunteer to this track"
                                  >
                                    <Plus className="h-3 w-3" /> Add Volunteer
                                  </button>
                                </>
                              ) : isLeadership ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleAddMemberToCategory(catIdx, "Head of Department")}
                                    className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 cursor-pointer shadow-xs transition-colors"
                                  >
                                    <Plus className="h-3 w-3" /> Add HOD / Principal
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddMemberToCategory(catIdx, "Faculty Coordinator")}
                                    className="inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer shadow-xs transition-colors"
                                  >
                                    <Plus className="h-3 w-3" /> Add Faculty
                                  </button>
                                </>
                              ) : isStudentLeads ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleAddMemberToCategory(catIdx, cat.name ? `${cat.name.trim()} Head` : "Student Head")}
                                    className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100 cursor-pointer shadow-xs transition-colors"
                                  >
                                    <Plus className="h-3 w-3" /> Add Student Head
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddMemberToCategory(catIdx, getFullRoleName(cat.name, "member", false))}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition-colors"
                                  >
                                    <Plus className="h-3 w-3" /> Add Member
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleAddMemberToCategory(catIdx, getFullRoleName(cat.name, "head", false))}
                                    className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 hover:bg-amber-100 cursor-pointer shadow-xs transition-colors"
                                    title="Add a Committee Head"
                                  >
                                    <Plus className="h-3 w-3" /> Add Committee Head
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddMemberToCategory(catIdx, getFullRoleName(cat.name, "member", false))}
                                    className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 cursor-pointer shadow-xs transition-colors"
                                    title="Add a Committee Member"
                                  >
                                    <Plus className="h-3 w-3" /> Add Committee Member
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() => handleAutoSortCategoryMembers(catIdx)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition-colors ml-1"
                                title="Automatically reorder this section so Heads and Coordinators appear on top"
                              >
                                <Sparkles className="h-3 w-3 text-amber-500" /> Sort Heads First
                              </button>
                            </div>
                          </div>

                          {/* Members Card Grid / List */}
                          <div className="space-y-3">
                          {(cat.members || []).map((mem, memIdx) => {
                            const isUploading = uploadingMemberPhotoId === mem.id;

                            return (
                              <div
                                key={mem.id || memIdx}
                                className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:p-4 space-y-3"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  {/* Avatar preview and file upload button */}
                                  <div className="flex items-center gap-3">
                                    <div className="relative h-12 w-12 shrink-0 rounded-full border-2 border-slate-300 bg-white overflow-hidden flex items-center justify-center font-bold text-slate-600">
                                      {mem.photo ? (
                                        <img src={mem.photo} alt={mem.name} className="h-full w-full object-cover" />
                                      ) : (
                                        <span className="text-xs font-bold uppercase">
                                          {mem.name ? mem.name.slice(0, 2) : "CV"}
                                        </span>
                                      )}
                                      {isUploading && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[9px] font-bold text-white">
                                          ...
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-col gap-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <label className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-xs">
                                          <Upload className="h-3 w-3" />
                                          <span>{mem.photo ? "Change Photo" : "Upload Photo"}</span>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={async (e) => {
                                              const file = e.target.files?.[0];
                                              if (!file) return;
                                              await handleUploadMemberPhoto(catIdx, memIdx, mem.id || `mem-${Date.now()}`, file);
                                            }}
                                          />
                                        </label>
                                        {(mem.role?.toLowerCase().includes("faculty") || mem.role?.toLowerCase().includes("prof") || mem.role?.toLowerCase().includes("dr.")) && (
                                          <span className="rounded bg-purple-100 text-purple-800 text-[10px] font-extrabold px-1.5 py-0.5 border border-purple-200 uppercase tracking-wide">
                                            Faculty
                                          </span>
                                        )}
                                        {uploadSuccessMemberId === mem.id && (
                                          <span className="text-[10px] font-bold text-emerald-600 animate-in fade-in">
                                            ✓ Successfully Uploaded
                                          </span>
                                        )}
                                        {uploadingMemberPhotoId === mem.id && (
                                          <span className="text-[10px] font-bold text-blue-600 animate-pulse">
                                            Uploading...
                                          </span>
                                        )}
                                      </div>
                                      {mem.photo && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setContentForm((f) => {
                                              if (!f) return f;
                                              const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                              const updatedCats = [...currentTeam.categories];
                                              const targetCat = { ...updatedCats[catIdx]! };
                                              const updatedMems = [...targetCat.members];
                                              updatedMems[memIdx] = { ...updatedMems[memIdx]!, photo: "" };
                                              targetCat.members = updatedMems;
                                              updatedCats[catIdx] = targetCat;
                                              return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                            });
                                          }}
                                          className="text-[10px] text-rose-600 hover:underline text-left cursor-pointer"
                                        >
                                          Remove photo
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Reorder and Delete Member */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={memIdx === 0}
                                      onClick={() => {
                                        if (memIdx === 0) return;
                                        setContentForm((f) => {
                                          if (!f) return f;
                                          const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                          const updatedCats = [...currentTeam.categories];
                                          const targetCat = { ...updatedCats[catIdx]! };
                                          const updatedMems = [...targetCat.members];
                                          [updatedMems[memIdx - 1], updatedMems[memIdx]] = [updatedMems[memIdx]!, updatedMems[memIdx - 1]!];
                                          targetCat.members = updatedMems;
                                          updatedCats[catIdx] = targetCat;
                                          return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                        });
                                      }}
                                      className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                      title="Move Up"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      type="button"
                                      disabled={memIdx === cat.members.length - 1}
                                      onClick={() => {
                                        setContentForm((f) => {
                                          if (!f) return f;
                                          const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                          const updatedCats = [...currentTeam.categories];
                                          const targetCat = { ...updatedCats[catIdx]! };
                                          const updatedMems = [...targetCat.members];
                                          if (memIdx >= updatedMems.length - 1) return f;
                                          [updatedMems[memIdx], updatedMems[memIdx + 1]] = [updatedMems[memIdx + 1]!, updatedMems[memIdx]!];
                                          targetCat.members = updatedMems;
                                          updatedCats[catIdx] = targetCat;
                                          return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                        });
                                      }}
                                      className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                      title="Move Down"
                                    >
                                      ↓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setContentForm((f) => {
                                          if (!f) return f;
                                          const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                          const updatedCats = [...currentTeam.categories];
                                          const targetCat = { ...updatedCats[catIdx]! };
                                          targetCat.members = targetCat.members.filter((_, i) => i !== memIdx);
                                          updatedCats[catIdx] = targetCat;
                                          return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                        });
                                      }}
                                      className="rounded border border-rose-200 bg-white px-2 py-0.5 text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                                      title="Delete Member"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>

                                {/* Form fields for this Member */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  <input
                                    type="text"
                                    value={mem.name}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setContentForm((f) => {
                                        if (!f) return f;
                                        const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                        const updatedCats = [...currentTeam.categories];
                                        const targetCat = { ...updatedCats[catIdx]! };
                                        const updatedMems = [...targetCat.members];
                                        updatedMems[memIdx] = { ...updatedMems[memIdx]!, name: val };
                                        targetCat.members = updatedMems;
                                        updatedCats[catIdx] = targetCat;
                                        return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                      });
                                    }}
                                    placeholder="Builder Name (e.g. Dr. Mita Parikh / Malhar Balar)"
                                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                                  />

                                  <div className="space-y-1 sm:col-span-1">
                                     <input
                                       type="text"
                                       value={mem.role}
                                       onChange={(e) => {
                                         const val = e.target.value;
                                         setContentForm((f) => {
                                           if (!f) return f;
                                           const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                           const updatedCats = [...currentTeam.categories];
                                           const targetCat = { ...updatedCats[catIdx]! };
                                           const updatedMems = [...targetCat.members];
                                           updatedMems[memIdx] = { ...updatedMems[memIdx]!, role: val };
                                           targetCat.members = updatedMems;
                                           updatedCats[catIdx] = targetCat;
                                           return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                         });
                                       }}
                                       placeholder={isEvent ? "Role (e.g. Faculty Coordinator / Event Coordinator / Volunteer)" : "Role (e.g. Committee Head / Member)"}
                                       className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                                     />
                                     {/* Quick Role Toggle Pills */}
                                     <div className="flex flex-wrap items-center gap-1">
                                       <span className="text-[10px] text-slate-400 font-medium mr-0.5">Quick:</span>
                                       {isEvent ? (
                                         <>
                                           <button
                                             type="button"
                                             onClick={() => {
                                               const targetRole = getFullRoleName(cat.name, "faculty", true);
                                               setContentForm((f) => {
                                                 if (!f) return f;
                                                 const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                                 const updatedCats = [...currentTeam.categories];
                                                 const targetCat = { ...updatedCats[catIdx]! };
                                                 const updatedMems = [...targetCat.members];
                                                 updatedMems[memIdx] = { ...updatedMems[memIdx]!, role: targetRole };
                                                 targetCat.members = updatedMems;
                                                 updatedCats[catIdx] = targetCat;
                                                 return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                               });
                                             }}
                                             className={cn(
                                               "rounded px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer",
                                               mem.role.toLowerCase().includes("faculty") || mem.role.toLowerCase().includes("prof") || mem.role.toLowerCase().includes("dr.")
                                                 ? "bg-purple-600 text-white shadow-xs"
                                                 : "border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100"
                                             )}
                                           >
                                             Faculty
                                           </button>
                                           <button
                                             type="button"
                                             onClick={() => {
                                               const targetRole = getFullRoleName(cat.name, "coordinator", true);
                                               setContentForm((f) => {
                                                 if (!f) return f;
                                                 const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                                 const updatedCats = [...currentTeam.categories];
                                                 const targetCat = { ...updatedCats[catIdx]! };
                                                 const updatedMems = [...targetCat.members];
                                                 updatedMems[memIdx] = { ...updatedMems[memIdx]!, role: targetRole };
                                                 targetCat.members = updatedMems;
                                                 updatedCats[catIdx] = targetCat;
                                                 return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                               });
                                             }}
                                             className={cn(
                                               "rounded px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer",
                                               mem.role.toLowerCase().includes("coordinator") && !mem.role.toLowerCase().includes("faculty")
                                                 ? "bg-emerald-600 text-white shadow-xs"
                                                 : "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                             )}
                                           >
                                             Coordinator
                                           </button>
                                           <button
                                             type="button"
                                             onClick={() => {
                                               const targetRole = getFullRoleName(cat.name, "volunteer", true);
                                               setContentForm((f) => {
                                                 if (!f) return f;
                                                 const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                                 const updatedCats = [...currentTeam.categories];
                                                 const targetCat = { ...updatedCats[catIdx]! };
                                                 const updatedMems = [...targetCat.members];
                                                 updatedMems[memIdx] = { ...updatedMems[memIdx]!, role: targetRole };
                                                 targetCat.members = updatedMems;
                                                 updatedCats[catIdx] = targetCat;
                                                 return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                               });
                                             }}
                                             className={cn(
                                               "rounded px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer",
                                               mem.role.toLowerCase().includes("volunteer")
                                                 ? "bg-teal-600 text-white shadow-xs"
                                                 : "border border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100"
                                             )}
                                           >
                                             Volunteer
                                           </button>
                                         </>
                                       ) : isLeadership ? (
                                         <>
                                           <button
                                             type="button"
                                             onClick={() => {
                                               setContentForm((f) => {
                                                 if (!f) return f;
                                                 const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                                 const updatedCats = [...currentTeam.categories];
                                                 const targetCat = { ...updatedCats[catIdx]! };
                                                 const updatedMems = [...targetCat.members];
                                                 updatedMems[memIdx] = { ...updatedMems[memIdx]!, role: "Head of Department" };
                                                 targetCat.members = updatedMems;
                                                 updatedCats[catIdx] = targetCat;
                                                 return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                               });
                                             }}
                                             className={cn(
                                               "rounded px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer",
                                               mem.role.toLowerCase().includes("head of department") || mem.role.toLowerCase().includes("hod")
                                                 ? "bg-rose-600 text-white shadow-xs"
                                                 : "border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                             )}
                                           >
                                             HOD
                                           </button>
                                           <button
                                             type="button"
                                             onClick={() => {
                                               setContentForm((f) => {
                                                 if (!f) return f;
                                                 const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                                 const updatedCats = [...currentTeam.categories];
                                                 const targetCat = { ...updatedCats[catIdx]! };
                                                 const updatedMems = [...targetCat.members];
                                                 updatedMems[memIdx] = { ...updatedMems[memIdx]!, role: "Faculty Coordinator" };
                                                 targetCat.members = updatedMems;
                                                 updatedCats[catIdx] = targetCat;
                                                 return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                               });
                                             }}
                                             className={cn(
                                               "rounded px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer",
                                               mem.role.toLowerCase().includes("faculty")
                                                 ? "bg-indigo-600 text-white shadow-xs"
                                                 : "border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                             )}
                                           >
                                             Faculty
                                           </button>
                                         </>
                                       ) : isStudentLeads ? (
                                         <>
                                           <button
                                             type="button"
                                             onClick={() => {
                                               const targetRole = cat.name ? `${cat.name.trim()} Head` : "Student Head";
                                               setContentForm((f) => {
                                                 if (!f) return f;
                                                 const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                                 const updatedCats = [...currentTeam.categories];
                                                 const targetCat = { ...updatedCats[catIdx]! };
                                                 const updatedMems = [...targetCat.members];
                                                 updatedMems[memIdx] = { ...updatedMems[memIdx]!, role: targetRole };
                                                 targetCat.members = updatedMems;
                                                 updatedCats[catIdx] = targetCat;
                                                 return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                               });
                                             }}
                                             className={cn(
                                               "rounded px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer",
                                               mem.role.toLowerCase().includes("student head") || mem.role.toLowerCase().includes("lead")
                                                 ? "bg-amber-600 text-white shadow-xs"
                                                 : "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                             )}
                                           >
                                             Student Head
                                           </button>
                                           <button
                                             type="button"
                                             onClick={() => {
                                               const targetRole = getFullRoleName(cat.name, "member", false);
                                               setContentForm((f) => {
                                                 if (!f) return f;
                                                 const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                                 const updatedCats = [...currentTeam.categories];
                                                 const targetCat = { ...updatedCats[catIdx]! };
                                                 const updatedMems = [...targetCat.members];
                                                 updatedMems[memIdx] = { ...updatedMems[memIdx]!, role: targetRole };
                                                 targetCat.members = updatedMems;
                                                 updatedCats[catIdx] = targetCat;
                                                 return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                               });
                                             }}
                                             className={cn(
                                               "rounded px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer",
                                               mem.role.toLowerCase().includes("member")
                                                 ? "bg-blue-600 text-white shadow-xs"
                                                 : "border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                                             )}
                                           >
                                             Member
                                           </button>
                                         </>
                                       ) : (
                                         <>
                                           <button
                                             type="button"
                                             onClick={() => {
                                               const targetRole = getFullRoleName(cat.name, "head", false);
                                               setContentForm((f) => {
                                                 if (!f) return f;
                                                 const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                                 const updatedCats = [...currentTeam.categories];
                                                 const targetCat = { ...updatedCats[catIdx]! };
                                                 const updatedMems = [...targetCat.members];
                                                 updatedMems[memIdx] = { ...updatedMems[memIdx]!, role: targetRole };
                                                 targetCat.members = updatedMems;
                                                 updatedCats[catIdx] = targetCat;
                                                 return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                               });
                                             }}
                                             className={cn(
                                               "rounded px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer",
                                               mem.role.toLowerCase().includes("head")
                                                 ? "bg-amber-600 text-white shadow-xs"
                                                 : "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                             )}
                                           >
                                             Head
                                           </button>
                                           <button
                                             type="button"
                                             onClick={() => {
                                               const targetRole = getFullRoleName(cat.name, "member", false);
                                               setContentForm((f) => {
                                                 if (!f) return f;
                                                 const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                                 const updatedCats = [...currentTeam.categories];
                                                 const targetCat = { ...updatedCats[catIdx]! };
                                                 const updatedMems = [...targetCat.members];
                                                 updatedMems[memIdx] = { ...updatedMems[memIdx]!, role: targetRole };
                                                 targetCat.members = updatedMems;
                                                 updatedCats[catIdx] = targetCat;
                                                 return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                               });
                                             }}
                                             className={cn(
                                               "rounded px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer",
                                               mem.role.toLowerCase().includes("member")
                                                 ? "bg-blue-600 text-white shadow-xs"
                                                 : "border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                             )}
                                           >
                                             Member
                                           </button>
                                         </>
                                       )}
                                     </div>
                                   </div>

                                  <input
                                    type="text"
                                    value={mem.photo || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setContentForm((f) => {
                                        if (!f) return f;
                                        const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                        const updatedCats = [...currentTeam.categories];
                                        const targetCat = { ...updatedCats[catIdx]! };
                                        const updatedMems = [...targetCat.members];
                                        updatedMems[memIdx] = { ...updatedMems[memIdx]!, photo: val };
                                        targetCat.members = updatedMems;
                                        updatedCats[catIdx] = targetCat;
                                        return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                      });
                                    }}
                                    placeholder="Photo URL (optional direct image URL)"
                                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500 sm:col-span-2"
                                  />

                                  <input
                                    type="text"
                                    value={mem.bio || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setContentForm((f) => {
                                        if (!f) return f;
                                        const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                        const updatedCats = [...currentTeam.categories];
                                        const targetCat = { ...updatedCats[catIdx]! };
                                        const updatedMems = [...targetCat.members];
                                        updatedMems[memIdx] = { ...updatedMems[memIdx]!, bio: val };
                                        targetCat.members = updatedMems;
                                        updatedCats[catIdx] = targetCat;
                                        return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                      });
                                    }}
                                    placeholder="Short Bio / Contribution to fest"
                                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500 sm:col-span-2"
                                  />

                                  <input
                                    type="text"
                                    value={mem.fact || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setContentForm((f) => {
                                        if (!f) return f;
                                        const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                        const updatedCats = [...currentTeam.categories];
                                        const targetCat = { ...updatedCats[catIdx]! };
                                        const updatedMems = [...targetCat.members];
                                        updatedMems[memIdx] = { ...updatedMems[memIdx]!, fact: val };
                                        targetCat.members = updatedMems;
                                        updatedCats[catIdx] = targetCat;
                                        return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                      });
                                    }}
                                    placeholder="💡 Fun Fact (e.g. Debugs best at 2am / Built the scanner in a weekend)"
                                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500 sm:col-span-2"
                                  />

                                  {/* Academic Standing & Profile (Shown on Profile Click) */}
                                  <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                                        🎓 Academic Standing & Profile (Shown on /team click)
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-medium">
                                        Enrollment • Email • Standing
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                          Enrollment No.
                                        </label>
                                        <input
                                          type="text"
                                          value={mem.enrollment || ""}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setContentForm((f) => {
                                              if (!f) return f;
                                              const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                              const updatedCats = [...currentTeam.categories];
                                              const targetCat = { ...updatedCats[catIdx]! };
                                              const updatedMems = [...targetCat.members];
                                              updatedMems[memIdx] = { ...updatedMems[memIdx]!, enrollment: val };
                                              targetCat.members = updatedMems;
                                              updatedCats[catIdx] = targetCat;
                                              return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                            });
                                          }}
                                          placeholder="e.g. ET23BTIT124"
                                          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                          College Email
                                        </label>
                                        <input
                                          type="email"
                                          value={mem.email || ""}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setContentForm((f) => {
                                              if (!f) return f;
                                              const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                              const updatedCats = [...currentTeam.categories];
                                              const targetCat = { ...updatedCats[catIdx]! };
                                              const updatedMems = [...targetCat.members];
                                              updatedMems[memIdx] = { ...updatedMems[memIdx]!, email: val };
                                              targetCat.members = updatedMems;
                                              updatedCats[catIdx] = targetCat;
                                              return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                            });
                                          }}
                                          placeholder="e.g. name@scet.ac.in"
                                          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-blue-500"
                                        />
                                      </div>

                                      <div className="sm:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                          Academic Standing
                                        </label>
                                        <input
                                          type="text"
                                          value={mem.standing || ""}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setContentForm((f) => {
                                              if (!f) return f;
                                              const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                              const updatedCats = [...currentTeam.categories];
                                              const targetCat = { ...updatedCats[catIdx]! };
                                              const updatedMems = [...targetCat.members];
                                              updatedMems[memIdx] = { ...updatedMems[memIdx]!, standing: val };
                                              targetCat.members = updatedMems;
                                              updatedCats[catIdx] = targetCat;
                                              return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                            });
                                          }}
                                          placeholder="e.g. 3rd Year IT-B"
                                          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-blue-500"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Social contacts */}
                                  <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                    <input
                                      type="text"
                                      value={mem.phone || ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setContentForm((f) => {
                                          if (!f) return f;
                                          const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                          const updatedCats = [...currentTeam.categories];
                                          const targetCat = { ...updatedCats[catIdx]! };
                                          const updatedMems = [...targetCat.members];
                                          updatedMems[memIdx] = { ...updatedMems[memIdx]!, phone: val };
                                          targetCat.members = updatedMems;
                                          updatedCats[catIdx] = targetCat;
                                          return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                        });
                                      }}
                                      placeholder="Phone"
                                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none"
                                    />
                                    <input
                                      type="text"
                                      value={mem.linkedin || ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setContentForm((f) => {
                                          if (!f) return f;
                                          const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                          const updatedCats = [...currentTeam.categories];
                                          const targetCat = { ...updatedCats[catIdx]! };
                                          const updatedMems = [...targetCat.members];
                                          updatedMems[memIdx] = { ...updatedMems[memIdx]!, linkedin: val };
                                          targetCat.members = updatedMems;
                                          updatedCats[catIdx] = targetCat;
                                          return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                        });
                                      }}
                                      placeholder="LinkedIn URL"
                                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none"
                                    />
                                    <input
                                      type="text"
                                      value={mem.instagram || ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setContentForm((f) => {
                                          if (!f) return f;
                                          const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                          const updatedCats = [...currentTeam.categories];
                                          const targetCat = { ...updatedCats[catIdx]! };
                                          const updatedMems = [...targetCat.members];
                                          updatedMems[memIdx] = { ...updatedMems[memIdx]!, instagram: val };
                                          targetCat.members = updatedMems;
                                          updatedCats[catIdx] = targetCat;
                                          return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                        });
                                      }}
                                      placeholder="Instagram URL"
                                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none"
                                    />
                                    <input
                                      type="text"
                                      value={mem.github || ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setContentForm((f) => {
                                          if (!f) return f;
                                          const currentTeam = f.team || DEFAULT_SITE_CONFIG.team!;
                                          const updatedCats = [...currentTeam.categories];
                                          const targetCat = { ...updatedCats[catIdx]! };
                                          const updatedMems = [...targetCat.members];
                                          updatedMems[memIdx] = { ...updatedMems[memIdx]!, github: val };
                                          targetCat.members = updatedMems;
                                          updatedCats[catIdx] = targetCat;
                                          return { ...f, team: { ...currentTeam, categories: updatedCats } };
                                        });
                                      }}
                                      placeholder="GitHub URL"
                                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
              </div>
            </div>
          )}
          
        </div>
      </section>
    );
  }

  /* ─── Sub-Admins Section ─── */
  function renderSubAdmins() {
    const targetSelectedUser = (allUsers || []).find(
      (u) => u.email?.toLowerCase().trim() === subAdminEmail.toLowerCase().trim()
    );

    return (
      <section className="animate-in fade-in duration-300">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Sub-Admins & Coordinators</h2>
            <p className="text-slate-500 text-sm mt-1">
              Assign registered Google accounts as event coordinators. They can view, filter, and export attendee registrations strictly for their assigned event.
            </p>
          </div>
        </div>

        {/* ── Existing Sub-Admins List ── */}
        <div className="mb-8 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Active Coordinators ({subAdmins.length})</h3>
            <span className="text-xs text-slate-400">All coordinators log in via standard Google Account</span>
          </div>
          {subAdminsLoading ? (
            <div className="px-6 py-8 text-center text-sm text-slate-400">Loading coordinators...</div>
          ) : subAdmins.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-400">
              No sub-admins assigned yet. Search a registered Google user below to assign one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 bg-slate-50/60">
                    <th className="px-6 py-3">Coordinator Name</th>
                    <th className="px-6 py-3">Google Account</th>
                    <th className="px-6 py-3">Assigned Event</th>
                    <th className="px-6 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subAdmins.map((sa) => {
                    const assignedEvent = masterEvents.find((e) => e.id === sa.assignedEventId);
                    return (
                      <tr key={sa.uid} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 font-medium text-slate-800">{sa.name}</td>
                        <td className="px-6 py-3 font-mono text-xs text-slate-600 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" title="Active Google User" />
                          {sa.email}
                        </td>
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200/60">
                            {assignedEvent ? assignedEvent.title : (sa.assignedEventTitle || sa.assignedEventId)}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <button
                            onClick={async () => {
                              if (confirm(`Are you sure you want to revoke sub-admin role for "${sa.name}" (${sa.email})? They will return to standard participant status.`)) {
                                try {
                                  await revokeSubAdmin(sa.uid);
                                } catch (err) {
                                  console.error("Failed to revoke sub-admin:", err);
                                  alert("Failed to revoke sub-admin access.");
                                }
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors shadow-sm cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Revoke Access
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* ── Assign New Sub-Admin ── */}
        <div className="max-w-xl bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-1">Assign Event Coordinator</h3>
          <p className="text-xs text-slate-500 mb-5 border-b border-slate-100 pb-3">
            Search a registered user by Gmail or name, confirm their name, and assign an event. No passwords needed.
          </p>
          
          <div className="space-y-4">
            {/* Search Gmail from users */}
            <div className="relative flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                <span>Google Account (Gmail)</span>
                <span className="text-[11px] font-normal text-slate-400">Searches registered accounts</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={subAdminEmail}
                  onChange={(e) => {
                    setSubAdminEmail(e.target.value);
                    setSubAdminSearchOpen(true);
                  }}
                  onFocus={() => setSubAdminSearchOpen(true)}
                  onBlur={() => {
                    setTimeout(() => setSubAdminSearchOpen(false), 250);
                  }}
                  placeholder="Type to search user's Gmail or name..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              {/* Suggestions Dropdown */}
              {subAdminSearchOpen && subAdminSuggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                  {subAdminSuggestions.map((u) => (
                    <button
                      key={u.uid}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSubAdminEmail(u.email || "");
                        setSubAdminName(u.name || "");
                        setSubAdminSearchOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-b-0 cursor-pointer"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">{u.name || "Participant"}</div>
                        <div className="font-mono text-xs text-slate-500">{u.email}</div>
                      </div>
                      <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/50">
                        {u.branch || u.role || "User"}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Found user indicator */}
              {targetSelectedUser && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Found registered user: <strong>{targetSelectedUser.name || targetSelectedUser.email}</strong></span>
                </div>
              )}
            </div>

            {/* Coordinator Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Coordinator Name</label>
              <input
                type="text"
                value={subAdminName}
                onChange={(e) => setSubAdminName(e.target.value)}
                placeholder="Full Name (auto-filled from user profile)"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
            
            {/* Assigned Event */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Assigned Event</label>
              <select
                value={subAdminEventId}
                onChange={(e) => setSubAdminEventId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              >
                <option value="" disabled>Select an event to assign...</option>
                {masterEvents.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.title} ({evt.track})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                The coordinator will strictly see and manage registrations only for this event.
              </p>
            </div>
            
            <button
              onClick={handleAssignSubAdmin}
              disabled={subAdminStatus === "loading" || !subAdminEmail.trim() || !subAdminEventId}
              className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              {subAdminStatus === "loading" ? "Assigning Sub-Admin..." : "Assign as Sub-Admin"}
            </button>
            
            {subAdminStatus === "success" && (
              <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-3 text-center text-sm font-medium text-green-700 flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> {subAdminMsg}
              </div>
            )}
            {subAdminStatus === "error" && (
              <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-center text-sm font-medium text-rose-700">
                {subAdminMsg}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  /* ─── Export Section ─── */
  function renderExport() {
    return (
      <section className="animate-in fade-in duration-300">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Export Vault</h2>
            <p className="text-slate-500 text-sm mt-1">Download platform data for offline coordination.</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-slate-800">All Registrations</h3>
            <p className="text-slate-500 text-sm mt-1 mb-6">{registrations.length} Total Records</p>
            
            <button onClick={exportCsv} disabled={isExporting} className="w-full flex items-center justify-center gap-2 rounded-lg bg-white border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50">
              <Download className={cn("h-4 w-4", isExporting && "animate-pulse")} /> {isExporting ? "Downloading..." : "Download CSV"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* ─── Users Section ─── */
  function renderUsers() {
    const participants = (allUsers || []).filter(u => u && (u.role === "participant" || !u.role));
    const masterAdmins = (allUsers || []).filter(u => u && u.role === "master");

    const handlePromoteToMaster = async () => {
      if (!promoteEmail.trim()) return;
      setPromoteStatus("loading");
      setPromoteMsg("");

      // Find the user by email in allUsers
      const targetUser = allUsers.find(u => u.email?.toLowerCase() === promoteEmail.trim().toLowerCase());
      if (!targetUser) {
        setPromoteStatus("error");
        setPromoteMsg(`No user found with email "${promoteEmail}". The user must sign in at least once first.`);
        setTimeout(() => setPromoteStatus("idle"), 4000);
        return;
      }
      if (targetUser.role === "master") {
        setPromoteStatus("error");
        setPromoteMsg(`${targetUser.email} is already a master admin.`);
        setTimeout(() => setPromoteStatus("idle"), 3000);
        return;
      }

      try {
        await updateDoc(doc(db, "users", targetUser.uid), { role: "master", onboarded: true });
        setPromoteStatus("success");
        setPromoteMsg(`${targetUser.email} has been promoted to Master Admin!`);
        setPromoteEmail("");
        setTimeout(() => setPromoteStatus("idle"), 3000);
      } catch (err: any) {
        console.error("Failed to promote user:", err);
        setPromoteStatus("error");
        setPromoteMsg(`Failed to promote: ${err.message || "Unknown error"}`);
        setTimeout(() => setPromoteStatus("idle"), 4000);
      }
    };

    const handleDemoteFromMaster = async (targetUid: string, targetEmail: string) => {
      if (targetUid === user?.uid) {
        alert("You cannot remove your own master admin access.");
        return;
      }
      if (!confirm(`Are you sure you want to remove master admin access from ${targetEmail}? They will become a regular participant.`)) return;

      try {
        await updateDoc(doc(db, "users", targetUid), { role: "participant" });
      } catch (err: any) {
        console.error("Failed to demote user:", err);
        alert(`Failed to demote: ${err.message || "Unknown error"}`);
      }
    };

    const handleToggleRequired = (fieldKey: keyof NonNullable<SiteConfig["onboarding"]>["fields"]) => {
      if (!contentForm?.onboarding?.fields) return;
      const current = contentForm.onboarding.fields[fieldKey]?.required;
      setContentForm({
        ...contentForm,
        onboarding: {
          ...contentForm.onboarding,
          fields: {
            ...contentForm.onboarding.fields,
            [fieldKey]: { ...contentForm.onboarding.fields[fieldKey], required: !current }
          }
        }
      });
    };

    const handleChangeLabel = (fieldKey: keyof NonNullable<SiteConfig["onboarding"]>["fields"], label: string) => {
      if (!contentForm?.onboarding?.fields) return;
      setContentForm({
        ...contentForm,
        onboarding: {
          ...contentForm.onboarding,
          fields: {
            ...contentForm.onboarding.fields,
            [fieldKey]: { ...contentForm.onboarding.fields[fieldKey], label }
          }
        }
      });
    };

    const handleAddCollege = () => {
      const trimmed = newCollegeInput.trim();
      if (!trimmed || !contentForm) return;
      const currentList = contentForm.onboarding?.collegeOptions || ["SCET", "Other"];
      if (currentList.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())) {
        alert(`"${trimmed}" is already in the college list.`);
        return;
      }
      setContentForm({
        ...contentForm,
        onboarding: {
          ...contentForm.onboarding,
          collegeOptions: [...currentList, trimmed],
        },
      });
      setNewCollegeInput("");
    };

    const handleAddBranch = () => {
      const trimmed = newBranchInput.trim();
      if (!trimmed || !contentForm) return;
      const currentList = contentForm.onboarding?.branchOptions || ["IT", "AIDS", "MCA", "ROBOTICS", "CO", "EC", "MECH", "CIVIL", "CHEM", "IC", "TT"];
      if (currentList.includes(trimmed)) {
        setNewBranchInput("");
        return;
      }
      setContentForm({
        ...contentForm,
        onboarding: {
          ...contentForm.onboarding,
          branchOptions: [...currentList, trimmed],
        },
      });
      setNewBranchInput("");
    };

    // Compute unique users who have at least 1 registration
    const registeredUserIds = new Set(registrations.map(r => r.userId));
    const uniqueRegisteredUsers = participants.filter(u => registeredUserIds.has(u.uid)).length;
    const onboardedOnly = participants.length - uniqueRegisteredUsers;

    return (
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Users / Onboarded Profiles</h2>
            <p className="text-slate-500 text-sm mt-1">{participants.length} total participants</p>
          </div>
        </div>

        {/* ── User Stats Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{participants.length}</p>
                <p className="text-xs text-slate-500">Total Onboarded</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Users who completed the onboarding form</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{uniqueRegisteredUsers}</p>
                <p className="text-xs text-slate-500">Registered for Events</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Unique users with ≥1 event registration</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{onboardedOnly}</p>
                <p className="text-xs text-slate-500">Onboarded Only</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Filled form but haven't registered for any event</p>
          </div>
        </div>
        {/* ── Master Admin Accounts ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Master Admin Accounts</h3>
              <p className="text-xs text-slate-500">All accounts listed here have full admin access to this panel.</p>
            </div>
          </div>

          {/* Current Master Admins List */}
          {masterAdmins.length > 0 && (
            <div className="mb-5 border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-2 font-semibold text-slate-600">Email</th>
                    <th className="px-4 py-2 font-semibold text-slate-600 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {masterAdmins.map((ma) => (
                    <tr key={ma.uid} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800 flex items-center gap-2">
                        {ma.name || "—"}
                        {ma.uid === user?.uid && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">YOU</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{ma.email || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        {ma.uid === user?.uid ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <button
                            onClick={() => handleDemoteFromMaster(ma.uid, ma.email || "")}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors shadow-sm"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove Admin
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Promote User to Master Admin */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">Add New Admin (by email)</label>
              <input
                type="email"
                value={promoteEmail}
                onChange={(e) => {
                  setPromoteEmail(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder="e.g. newadmin@gmail.com"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setShowSuggestions(false);
                    handlePromoteToMaster();
                  }
                }}
              />
              <p className="text-[11px] text-slate-400 mt-1">The user must have signed in with Google at least once before you can promote them.</p>

              {/* Suggestions Dropdown */}
              {showSuggestions && emailSuggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                  {emailSuggestions.map((u) => (
                    <button
                      key={u.uid}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setPromoteEmail(u.email || "");
                        setShowSuggestions(false);
                      }}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-purple-50 transition-colors border-b border-slate-100 last:border-b-0 cursor-pointer"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">{u.name || "Participant"}</span>
                        <span className="ml-2 font-mono text-xs text-slate-500">{u.email}</span>
                      </div>
                      <span className="text-[11px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/50">
                        {u.branch || "User"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setShowSuggestions(false);
                  handlePromoteToMaster();
                }}
                disabled={promoteStatus === "loading" || !promoteEmail.trim()}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
              >
                <Shield className="h-4 w-4" />
                {promoteStatus === "loading" ? "Promoting..." : "Promote to Admin"}
              </button>
            </div>
          </div>

          {promoteStatus === "success" && (
            <div className="mt-3 rounded-lg bg-green-50 border border-green-200 p-3 text-center text-sm font-medium text-green-700 flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> {promoteMsg}
            </div>
          )}
          {promoteStatus === "error" && (
            <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-center text-sm font-medium text-rose-700">
              {promoteMsg}
            </div>
          )}
        </div>

        {/* Onboarding Config */}
        {contentForm?.onboarding?.fields && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Onboarding Form Settings</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPreviewModal(true)}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Preview Form
                </button>
                <button
                  onClick={handleSaveContent}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {contentSaved ? "Saved ✓" : "Save Config"}
                </button>
              </div>
            </div>
            
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Form Page Title</label>
                <input
                  type="text"
                  value={contentForm.onboarding.pageTitle}
                  onChange={(e) => setContentForm({
                    ...contentForm, 
                    onboarding: { ...contentForm.onboarding, pageTitle: e.target.value }
                  })}
                  className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Important Note</label>
                <textarea
                  value={contentForm.onboarding.importantNote || ""}
                  onChange={(e) => setContentForm({
                    ...contentForm, 
                    onboarding: { ...contentForm.onboarding, importantNote: e.target.value }
                  })}
                  rows={2}
                  className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Please add details safely as the name will be exactly same in the certificate"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-slate-600">Field</th>
                    <th className="px-4 py-2 font-semibold text-slate-600">Display Label</th>
                    <th className="px-4 py-2 font-semibold text-slate-600 text-center">Compulsory?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(Object.keys(contentForm.onboarding.fields) as Array<keyof NonNullable<SiteConfig["onboarding"]>["fields"]>).map(key => (
                    <tr key={key} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                      <td className="px-4 py-3">
                        <input 
                          type="text"
                          value={contentForm.onboarding.fields[key].label}
                          onChange={(e) => handleChangeLabel(key, e.target.value)}
                          className="w-full max-w-[200px] rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleRequired(key)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            contentForm.onboarding.fields[key].required ? "bg-blue-600" : "bg-slate-300"
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            contentForm.onboarding.fields[key].required ? "translate-x-4" : "translate-x-1"
                          }`} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* College Options Management */}
            <div className="mt-6 border-t border-slate-200 pt-5">
              <label className="block text-sm font-bold text-slate-800 mb-1">
                College Name Options (Dropdown Choices)
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Students select from these college options during registration/onboarding. You can add or delete options here. Remember to click "Save Config" above after changing.
              </p>

              {/* Current college chips */}
              <div className="flex flex-wrap gap-2 mb-4">
                {(contentForm.onboarding.collegeOptions || ["SCET", "Other"]).map((college, idx) => (
                  <span
                    key={`${college}-${idx}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
                  >
                    {college}
                    <button
                      type="button"
                      onClick={() => {
                        const currentList = contentForm.onboarding.collegeOptions || ["SCET", "Other"];
                        const updated = currentList.filter((_, i) => i !== idx);
                        setContentForm({
                          ...contentForm,
                          onboarding: {
                            ...contentForm.onboarding,
                            collegeOptions: updated,
                          },
                        });
                      }}
                      className="ml-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title={`Delete ${college}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add college input */}
              <div className="flex gap-2 max-w-md">
                <input
                  type="text"
                  value={newCollegeInput}
                  onChange={(e) => setNewCollegeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCollege();
                    }
                  }}
                  placeholder="e.g. SCET, CKPCET, SVNIT..."
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddCollege}
                  disabled={!newCollegeInput.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add College
                </button>
              </div>
            </div>

            {/* Branch Options (Dropdown Choices) */}
            <div className="mt-8 rounded border border-slate-200 bg-white p-4 shadow-sm">
              <label className="mb-2 block text-sm font-bold text-slate-800">
                Branch Options (Dropdown Choices)
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Students select from these branch options during registration/onboarding. You can add or delete options here. Remember to click "Save Config" above after changing.
              </p>

              {/* Current branch chips */}
              <div className="flex flex-wrap gap-2 mb-4">
                {(contentForm.onboarding.branchOptions || ["IT", "AIDS", "MCA", "ROBOTICS", "CO", "EC", "MECH", "CIVIL", "CHEM", "IC", "TT"]).map((branch, idx) => (
                  <span
                    key={`${branch}-${idx}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
                  >
                    {branch}
                    <button
                      type="button"
                      onClick={() => {
                        const currentList = contentForm.onboarding.branchOptions || ["IT", "AIDS", "MCA", "ROBOTICS", "CO", "EC", "MECH", "CIVIL", "CHEM", "IC", "TT"];
                        const updated = currentList.filter((_, i) => i !== idx);
                        setContentForm({
                          ...contentForm,
                          onboarding: {
                            ...contentForm.onboarding,
                            branchOptions: updated,
                          },
                        });
                      }}
                      className="ml-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title={`Delete ${branch}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add branch input */}
              <div className="flex gap-2 max-w-md">
                <input
                  type="text"
                  value={newBranchInput}
                  onChange={(e) => setNewBranchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddBranch();
                    }
                  }}
                  placeholder="e.g. CE, EE..."
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddBranch}
                  disabled={!newBranchInput.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Branch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {usersLoading ? (
            <div className="flex h-32 items-center justify-center text-slate-400">Loading users...</div>
          ) : participants.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-slate-400">No participants found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 font-semibold text-slate-600">Name</th>
                    <th className="px-5 py-3 font-semibold text-slate-600">Email</th>
                    <th className="px-5 py-3 font-semibold text-slate-600">Phone</th>
                    <th className="px-5 py-3 font-semibold text-slate-600">College</th>
                    <th className="px-5 py-3 font-semibold text-slate-600">Branch</th>
                    <th className="px-5 py-3 font-semibold text-slate-600">Year</th>
                    <th className="px-5 py-3 font-semibold text-slate-600">Sem</th>
                    <th className="px-5 py-3 font-semibold text-slate-600">Enrollment</th>
                    <th className="px-5 py-3 font-semibold text-slate-600 text-center">Onboarded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {participants.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-800">{u.name || "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{u.email || "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{u.phone || "—"}</td>
                      <td className="px-5 py-3 text-slate-600 font-medium">{u.collegeName || "—"}</td>
                      <td className="px-5 py-3">
                        {u.branch ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.branch === "IT" ? "bg-yellow-100 text-yellow-800" : "bg-blue-100 text-blue-800"}`}>{u.branch}</span>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{u.year ? `${u.year}yr` : "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{u.semester || "—"}</td>
                      <td className="px-5 py-3 text-slate-600 font-mono text-xs">{u.enrollmentNumber || "—"}</td>
                      <td className="px-5 py-3 text-center">
                        {u.onboarded ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700"><CheckCircle2 className="w-3 h-3" /> Yes</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700"><Clock className="w-3 h-3" /> No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    );
  }

  /* ─── Email Campaigns Section ─── */
  function renderEmails() {
    const variables = ["Participant Name", "College Name", "Branch", "Year", "Semester", "Enrollment", "Participated Events", "WhatsApp Links", "My Events", "Event Name", "Event Date", "Event Time", "Event Venue", "Google Form URL"];
    return (
      <section className="animate-in fade-in duration-300">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-800">Email Campaigns</h2>
          <p className="text-slate-500 text-sm mt-1">Send custom broadcast emails to participants and specific groups.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target Audience</label>
              <select
                value={emailCampaignTarget}
                onChange={(e) => setEmailCampaignTarget(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Participants (Registered on Site)</option>
                <option value="onboarded">Onboarded Participants Only</option>
                <option value="not_onboarded">Not Onboarded (Incomplete Profiles)</option>
                <option value="all_events">All Event Registrants</option>
                <option value="specific">Specific Emails Only</option>
                <optgroup label="Specific Events">
                  {masterEvents.map(e => (
                    <option key={e.id} value={`event_${e.id}`}>{e.title}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Specific Emails — Autocomplete Search + Chips */}
            {emailCampaignTarget === "specific" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Search & Select Users</label>
                
                {/* Selected user chips */}
                {emailSelectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    {emailSelectedUsers.map((u, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-800">
                        {u.name || u.email}
                        <button
                          onClick={() => setEmailSelectedUsers(prev => prev.filter((_, idx) => idx !== i))}
                          className="ml-0.5 text-blue-500 hover:text-red-500 transition-colors font-bold cursor-pointer"
                        >×</button>
                      </span>
                    ))}
                    <button
                      onClick={() => setEmailSelectedUsers([])}
                      className="text-[10px] text-red-500 hover:text-red-700 font-semibold ml-1 cursor-pointer"
                    >Clear all</button>
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <input
                    type="text"
                    value={emailSearchQuery}
                    onChange={(e) => setEmailSearchQuery(e.target.value)}
                    onFocus={() => setEmailSearchFocused(true)}
                    onBlur={() => setTimeout(() => setEmailSearchFocused(false), 200)}
                    placeholder="Type name or email to search..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />

                  {/* Autocomplete dropdown */}
                  {emailSearchFocused && emailSearchQuery.length >= 2 && (() => {
                    const query = emailSearchQuery.toLowerCase();
                    const selectedEmails = new Set(emailSelectedUsers.map(u => u.email.toLowerCase()));
                    const matches = (allUsers || []).filter(u => 
                      u && u.email && !selectedEmails.has(u.email.toLowerCase()) &&
                      ((u.name && u.name.toLowerCase().includes(query)) || u.email.toLowerCase().includes(query))
                    ).slice(0, 8);
                    
                    if (matches.length === 0) return (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm text-slate-400">No users found</div>
                    );
                    
                    return (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-[250px] overflow-y-auto">
                        {matches.map((u: any) => (
                          <button
                            key={u.uid || u.email}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setEmailSelectedUsers(prev => [...prev, { email: u.email, name: u.name || "" }]);
                              setEmailSearchQuery("");
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors flex items-center justify-between border-b border-slate-50 last:border-0 cursor-pointer"
                          >
                            <div>
                              <p className="text-sm font-medium text-slate-800">{u.name || "—"}</p>
                              <p className="text-xs text-slate-400">{u.email}</p>
                            </div>
                            <span className="text-[10px] text-slate-400">{u.branch || ""} {u.year ? `${u.year}yr` : ""}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <p className="text-xs text-slate-400 mt-1">{emailSelectedUsers.length} user(s) selected</p>
              </div>
            )}
            
            {renderInput("Email Subject", emailCampaignSubject, setEmailCampaignSubject)}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Content (HTML / Text)</label>
              <textarea
                ref={emailTextareaRef}
                value={emailCampaignTemplate}
                onChange={(e) => setEmailCampaignTemplate(e.target.value)}
                placeholder="Hello [Participant Name], welcome to CONVERSE 2K26! ..."
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-y min-h-[300px] font-mono"
              />
            </div>

            {/* Email Progress Bar */}
            {emailProgress && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-blue-800">
                    {emailProgress.status === "starting" ? "Preparing emails..." :
                     emailProgress.status === "done" ? "✅ All emails sent!" :
                     `Sending emails... ${emailProgress.sent} / ${emailProgress.total}`}
                  </span>
                  <span className="text-xs font-bold text-blue-600">
                    {emailProgress.total > 0 ? Math.round((emailProgress.sent / emailProgress.total) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${emailProgress.total > 0 ? (emailProgress.sent / emailProgress.total) * 100 : 0}%`,
                      background: emailProgress.status === "done"
                        ? "linear-gradient(90deg, #22c55e, #16a34a)"
                        : "linear-gradient(90deg, #3b82f6, #2563eb)",
                    }}
                  />
                </div>
                {emailProgress.status !== "done" && emailProgress.total > 0 && (
                  <p className="text-[11px] text-blue-500 mt-1.5">
                    Estimated time remaining: ~{Math.max(1, Math.round(((emailProgress.total - emailProgress.sent) * 1) / 60))} min
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSendEmailCampaign}
                disabled={emailCampaignSending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {emailCampaignSending ? "Sending / Queuing..." : "Send Email Campaign"}
              </button>
            </div>
          </div>

          {/* Sidebar for Variables */}
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Available Variables</h3>
            <p className="text-xs text-slate-500 mb-4">
              Click any chip to insert it into the email template at your cursor position. These variables will be dynamically replaced when sending.
            </p>
            <div className="flex flex-wrap gap-2">
              {variables.map(variable => (
                <button
                  key={variable}
                  onClick={() => insertEmailVariable(variable)}
                  className="inline-flex items-center rounded-md bg-white border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer shadow-xs active:scale-95"
                  title={`Insert [${variable}]`}
                >
                  {variable}
                </button>
              ))}
            </div>
            <div className="mt-6 rounded-lg bg-amber-50 p-3 border border-amber-200 text-xs text-amber-800">
              <strong>Note:</strong> Event-specific variables (like Event Name, Google Form URL) will only work if the Target Audience is set to a specific event!
            </div>
          </div>
        </div>
      </section>
    );
  }
}

/* ─── Shared form helpers ─── */
function renderInput(label: string, value: string, onChange: (v: string) => void, placeholder?: string, type: string = "text") {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  );
}

function renderFilter(
  label: string,
  value: string,
  onChange: (v: string) => void,
  options: (string | { value: string; label: string })[]
) {
  return (
    <div className="flex flex-col gap-1.5 min-w-[150px]">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      >
        {options.map((o) => {
          const val = typeof o === "string" ? o : o.value;
          const lab = typeof o === "string" ? o : o.label;
          return (
            <option key={val} value={val}>
              {lab}
            </option>
          );
        })}
      </select>
    </div>
  );
}

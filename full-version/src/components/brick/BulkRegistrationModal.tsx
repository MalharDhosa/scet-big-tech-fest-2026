import { useState, useRef, useMemo } from "react";
import {
  parseSpreadsheetText,
  detectColumnMapping,
  analyzeRegistrationRows,
  executeBulkImport,
  downloadSampleCsvTemplate,
  type ParsedRegistrationRow,
  type ImportStats,
} from "@/lib/csv-registration-importer";
import { type FestEvent } from "@/lib/fest-state";
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Loader2,
  FileText,
  ClipboardCopy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type BulkRegistrationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  eventsList: FestEvent[];
  defaultEventId?: string;
  onSuccess?: (stats: { count: number }) => void;
};

export function BulkRegistrationModal({
  isOpen,
  onClose,
  eventsList,
  defaultEventId,
  onSuccess,
}: BulkRegistrationModalProps) {
  const [activeTab, setActiveTab] = useState<"file" | "paste">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [selectedDefaultEvent, setSelectedDefaultEvent] = useState<string>(defaultEventId || "");
  const [isDragging, setIsDragging] = useState(false);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [analyzedRows, setAnalyzedRows] = useState<ParsedRegistrationRow[] | null>(null);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [filterView, setFilterView] = useState<"all" | "valid" | "duplicate" | "invalid">("all");

  // Execution State
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{
    successCount: number;
    errorCount: number;
    errors: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset modal state
  const handleReset = () => {
    setSelectedFile(null);
    setPastedText("");
    setParsedHeaders([]);
    setAnalyzedRows(null);
    setImportStats(null);
    setImportResult(null);
    setFilterView("all");
    setIsImporting(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  // Process text or file into analyzed rows
  const handleAnalyze = async (rawContent: string) => {
    if (!rawContent.trim()) {
      alert("Please upload a CSV file or paste spreadsheet rows first.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const { headers, rows } = parseSpreadsheetText(rawContent);
      if (headers.length === 0 || rows.length === 0) {
        alert("Could not detect any valid data rows in the spreadsheet text.");
        setIsAnalyzing(false);
        return;
      }

      setParsedHeaders(headers);
      const mapping = detectColumnMapping(headers);
      const { analyzedRows: analyzed, stats } = await analyzeRegistrationRows(
        rows,
        mapping,
        eventsList,
        selectedDefaultEvent
      );

      setAnalyzedRows(analyzed);
      setImportStats(stats);
    } catch (err: any) {
      console.error("Error analyzing spreadsheet:", err);
      alert("Failed to analyze spreadsheet: " + (err.message || "Unknown error"));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      handleAnalyze(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handlePasteSubmit = () => {
    handleAnalyze(pastedText);
  };

  // Perform actual import of valid rows
  const handleExecuteImport = async () => {
    if (!analyzedRows) return;
    const validRows = analyzedRows.filter((r) => r.status === "valid");
    if (validRows.length === 0) {
      alert("No valid rows available to import.");
      return;
    }

    if (
      !confirm(
        `Import ${validRows.length} participant(s) into Firestore? Each participant will receive an official QR Pass and 6-character Entry Code.`
      )
    ) {
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: validRows.length });

    try {
      const result = await executeBulkImport(validRows, (current, total) => {
        setImportProgress({ current, total });
      });
      setImportResult(result);
      if (onSuccess) {
        onSuccess({ count: result.successCount });
      }
    } catch (err: any) {
      console.error("Import execution failed:", err);
      alert("Import execution encountered an error: " + (err.message || "Unknown error"));
    } finally {
      setIsImporting(false);
    }
  };

  const filteredPreviewRows = (analyzedRows || []).filter((r) => {
    if (filterView === "valid") return r.status === "valid";
    if (filterView === "duplicate") return r.status === "duplicate";
    if (filterView === "invalid") return r.status === "invalid";
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-4xl bg-gradient-to-b from-[#092257] to-[#041233] text-white rounded-2xl border-2 border-white/15 shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 sm:px-6 py-4 bg-[#001d5c]/90">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#FFD700] text-[#001d5c] flex items-center justify-center shrink-0 shadow-md">
              <FileSpreadsheet className="h-5 w-5 font-bold" />
            </div>
            <div>
              <h3 className="font-display text-base sm:text-lg font-black uppercase tracking-wide text-white">
                Bulk Register from Google Sheets / CSV
              </h3>
              <p className="text-xs text-[#a9b8e0] font-medium">
                Import offline registrations & generate official QR Gate Passes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* Default Event Selector & Sample Template Download Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
              <label className="text-xs font-bold uppercase tracking-wider text-[#FFD700] whitespace-nowrap">
                Default Event:
              </label>
              <select
                value={selectedDefaultEvent}
                onChange={(e) => setSelectedDefaultEvent(e.target.value)}
                className="w-full rounded-lg bg-[#001d5c] border border-white/20 px-3 py-1.5 text-xs text-white outline-none focus:border-[#FFD700]"
              >
                <option value="">-- Detect from &quot;Event Name&quot; column --</option>
                {eventsList.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} ({ev.track} Track)
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={downloadSampleCsvTemplate}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5 text-[#FFD700]" /> Download Sample CSV
            </button>
          </div>

          {/* STEP 1: Upload or Paste (Visible when no analyzed rows yet) */}
          {!analyzedRows && !importResult && (
            <div className="space-y-4">
              {/* Input Type Tabs */}
              <div className="flex border-b border-white/10 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("file")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-xs font-display font-bold uppercase tracking-wider transition-all border-b-2",
                    activeTab === "file"
                      ? "border-[#FFD700] text-[#FFD700]"
                      : "border-transparent text-white/60 hover:text-white"
                  )}
                >
                  <Upload className="h-3.5 w-3.5" /> Upload CSV File
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("paste")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-xs font-display font-bold uppercase tracking-wider transition-all border-b-2",
                    activeTab === "paste"
                      ? "border-[#FFD700] text-[#FFD700]"
                      : "border-transparent text-white/60 hover:text-white"
                  )}
                >
                  <ClipboardCopy className="h-3.5 w-3.5" /> Copy-Paste from Google Sheets
                </button>
              </div>

              {activeTab === "file" ? (
                /* Drag and drop file area */
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3",
                    isDragging
                      ? "border-[#FFD700] bg-[#FFD700]/10 scale-[0.99]"
                      : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="h-14 w-14 rounded-2xl bg-[#001d5c] border border-white/20 flex items-center justify-center text-[#FFD700] shadow-lg">
                    {isAnalyzing ? (
                      <Loader2 className="h-7 w-7 animate-spin" />
                    ) : (
                      <Upload className="h-7 w-7" />
                    )}
                  </div>
                  <div>
                    <p className="font-display font-bold text-sm text-white">
                      {selectedFile ? selectedFile.name : "Drag & Drop CSV file here, or click to browse"}
                    </p>
                    <p className="text-xs text-[#a9b8e0] mt-1">
                      Supports .csv or .tsv downloaded directly from Google Sheets or Excel
                    </p>
                  </div>
                </div>
              ) : (
                /* Paste textarea */
                <div className="space-y-3">
                  <p className="text-xs text-[#a9b8e0]">
                    Select rows in Google Sheets, copy (Ctrl+C / Cmd+C), and paste directly below:
                  </p>
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Full Name&#9;Student Email&#9;Phone Number&#9;Department&#9;Event Name&#10;Sagar Isamaliya&#9;sagar@scet.ac.in&#9;9876543210&#9;IT&#9;PY-IT"
                    className="w-full rounded-xl bg-black/40 border border-white/20 p-3 text-xs font-mono text-white placeholder:text-white/30 focus:border-[#FFD700] outline-none"
                  />
                  <button
                    type="button"
                    disabled={isAnalyzing || !pastedText.trim()}
                    onClick={handlePasteSubmit}
                    className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-[#FFD700] font-display text-xs font-black uppercase tracking-wider text-[#001d5c] hover:bg-[#ffdf33] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Analyzing Rows...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" /> Analyze &amp; Preview Rows
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Pre-Import Dry-Run Preview Table */}
          {analyzedRows && !importResult && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Stats & Filter Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => setFilterView("all")}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all cursor-pointer",
                    filterView === "all"
                      ? "bg-white/15 border-white/40 shadow-sm"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  )}
                >
                  <span className="text-[10px] font-display font-bold uppercase tracking-wider text-[#a9b8e0] block">
                    Total Rows
                  </span>
                  <span className="text-xl font-bold text-white mt-0.5 block">
                    {importStats?.totalRows || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterView("valid")}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all cursor-pointer",
                    filterView === "valid"
                      ? "bg-emerald-500/20 border-emerald-400 shadow-sm"
                      : "bg-emerald-950/30 border-emerald-500/20 hover:bg-emerald-950/50"
                  )}
                >
                  <span className="text-[10px] font-display font-bold uppercase tracking-wider text-emerald-300 block flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Ready to Import
                  </span>
                  <span className="text-xl font-bold text-emerald-400 mt-0.5 block">
                    {importStats?.validRows || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterView("duplicate")}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all cursor-pointer",
                    filterView === "duplicate"
                      ? "bg-amber-500/20 border-amber-400 shadow-sm"
                      : "bg-amber-950/30 border-amber-500/20 hover:bg-amber-950/50"
                  )}
                >
                  <span className="text-[10px] font-display font-bold uppercase tracking-wider text-amber-300 block flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Duplicate (Will Skip)
                  </span>
                  <span className="text-xl font-bold text-amber-400 mt-0.5 block">
                    {importStats?.duplicateRows || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterView("invalid")}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all cursor-pointer",
                    filterView === "invalid"
                      ? "bg-rose-500/20 border-rose-400 shadow-sm"
                      : "bg-rose-950/30 border-rose-500/20 hover:bg-rose-950/50"
                  )}
                >
                  <span className="text-[10px] font-display font-bold uppercase tracking-wider text-rose-300 block flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Invalid (Error)
                  </span>
                  <span className="text-xl font-bold text-rose-400 mt-0.5 block">
                    {importStats?.invalidRows || 0}
                  </span>
                </button>
              </div>

              {/* Preview Table */}
              <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
                <div className="max-h-64 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left text-xs text-white/90">
                    <thead className="bg-[#001d5c] text-[10px] font-display font-bold uppercase tracking-wider text-[#a9b8e0] sticky top-0 z-10 border-b border-white/10">
                      <tr>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Student Name</th>
                        <th className="px-3 py-2.5">Email</th>
                        <th className="px-3 py-2.5">Phone</th>
                        <th className="px-3 py-2.5">Dept</th>
                        <th className="px-3 py-2.5">Event</th>
                        <th className="px-3 py-2.5">Team</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredPreviewRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-white/50">
                            No records match the selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredPreviewRows.map((r, i) => (
                          <tr key={i} className="hover:bg-white/5">
                            <td className="px-3 py-2 whitespace-nowrap">
                              {r.status === "valid" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold">
                                  <CheckCircle2 className="h-3 w-3" /> Ready
                                </span>
                              )}
                              {r.status === "duplicate" && (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold"
                                  title={r.statusReason}
                                >
                                  <AlertTriangle className="h-3 w-3" /> Duplicate
                                </span>
                              )}
                              {r.status === "invalid" && (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 text-[10px] font-bold"
                                  title={r.statusReason}
                                >
                                  <XCircle className="h-3 w-3" /> Error
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-semibold text-white truncate max-w-[140px]">
                              {r.name || <span className="text-rose-400 italic">Empty</span>}
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-white/80 truncate max-w-[160px]">
                              {r.email || <span className="text-rose-400 italic">Empty</span>}
                            </td>
                            <td className="px-3 py-2 text-white/70">{r.phone || "-"}</td>
                            <td className="px-3 py-2 text-white/70">{r.dept || "-"}</td>
                            <td className="px-3 py-2 font-bold text-[#FFD700] truncate max-w-[120px]">
                              {r.matchedEvent ? r.matchedEvent.title : <span className="text-rose-400 italic">{r.eventTitle || "Unmatched"}</span>}
                            </td>
                            <td className="px-3 py-2 text-white/70 truncate max-w-[120px]">
                              {r.teamName || (r.teammatesRaw ? "Team" : "-")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Progress bar when importing */}
              {isImporting && (
                <div className="space-y-2 rounded-xl bg-black/40 border border-white/10 p-4">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#FFD700] flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Writing to Firestore &amp; Generating QR Passes...
                    </span>
                    <span className="font-mono text-white">
                      {importProgress.current} / {importProgress.total}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[#FFD700] transition-all duration-150"
                      style={{
                        width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl bg-white/10 font-display text-xs font-bold uppercase text-white hover:bg-white/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  Choose Different File
                </button>
                <button
                  type="button"
                  disabled={isImporting || (importStats?.validRows || 0) === 0}
                  onClick={handleExecuteImport}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#FFD700] font-display text-xs font-black uppercase tracking-wider text-[#001d5c] hover:bg-[#ffdf33] active:scale-[0.98] transition-all cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="h-4 w-4" />
                  Import {importStats?.validRows || 0} Participants
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Completion Result Screen */}
          {importResult && (
            <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-4 animate-in zoom-in-95">
              <div className="h-16 w-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h4 className="font-display text-xl font-black uppercase tracking-wide text-white">
                  Bulk Registration Complete!
                </h4>
                <p className="text-sm text-emerald-200 mt-1 max-w-md mx-auto">
                  Successfully imported <strong>{importResult.successCount}</strong> participants into Firestore with official cryptographic QR Code passes and entry codes.
                </p>
              </div>

              {importResult.errorCount > 0 && (
                <div className="rounded-xl bg-rose-950/50 border border-rose-500/30 p-3 text-left max-h-36 overflow-y-auto">
                  <p className="text-xs font-bold text-rose-300 mb-1">Errors encountered ({importResult.errorCount}):</p>
                  <ul className="text-[11px] text-rose-200 space-y-0.5 list-disc pl-4">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-xl bg-[#FFD700] font-display text-xs font-black uppercase tracking-wider text-[#001d5c] hover:bg-[#ffdf33] transition-all cursor-pointer shadow-md"
                >
                  Done &amp; View Registrations
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

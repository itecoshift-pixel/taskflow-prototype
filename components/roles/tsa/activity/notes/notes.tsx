"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/utils/supabase";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Check, Trash, Pen, Plus, FileText, Loader2,
  Clock, Search, Filter, TrendingUp, AlertCircle,
} from "lucide-react";
import { type DateRange } from "react-day-picker";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationPrevious, PaginationNext,
} from "@/components/ui/pagination";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NoteItem {
  id: string;
  referenceid: string;
  tsm: string;
  manager: string;
  type_activity: string;
  remarks: string;
  start_date: string;
  end_date: string;
  date_created: string;
}

interface NotesProps {
  referenceid: string;
  tsm: string;
  manager: string;
  dateCreatedFilterRange?: DateRange;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const truncate = (text: string, len = 40) =>
  text.length > len ? text.slice(0, len) + "…" : text;

const toLocalDateTimeInput = (utc: string): string => {
  if (!utc) return "";
  const d = new Date(utc);
  if (isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

const getDurationHMS = (start: string, end: string): string => {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return "0:00:00";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-PH", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

const notify = {
  success: (msg: string) =>
    sileo.success({ title: "Success", description: msg, duration: 3000, position: "top-right" }),
  error: (msg: string) =>
    sileo.error({ title: "Error", description: msg, duration: 4000, position: "top-right" }),
};

const ACTIVITY_TYPES = [
  "Documentation",
  "Admin - Supplier Accreditation",
  "Admin - Credit Terms Application",
  "Accounting Concerns",
  "After Sales Refunds",
  "After Sales Repair / Replacement",
  "Bidding Preparations",
  "Customer Orders",
  "Delivery Concern",
  "Follow Up",
  "Sample Requests",
  "Technical Concerns",
];

const activityDurations: Record<string, number> = {
  "Documentation": 30,
  "Admin - Supplier Accreditation": 45,
  "Admin - Credit Terms Application": 45,
  "Accounting Concerns": 30,
  "After Sales Refunds": 30,
  "After Sales Repair / Replacement": 45,
  "Bidding Preparations": 60,
  "Customer Orders": 30,
  "Delivery Concern": 20,
  "Follow Up": 15,
  "Sample Requests": 20,
  "Technical Concerns": 45,
};

const suggestActivityType = (remarks: string): string => {
  const r = remarks.toLowerCase();
  if (r.includes("supplier") || r.includes("accreditation")) return "Admin - Supplier Accreditation";
  if (r.includes("credit terms") || r.includes("credit application")) return "Admin - Credit Terms Application";
  if (r.includes("accounting") || r.includes("billing") || r.includes("invoice") || r.includes("payment issue")) return "Accounting Concerns";
  if (r.includes("refund")) return "After Sales Refunds";
  if (r.includes("repair") || r.includes("replacement") || r.includes("warranty")) return "After Sales Repair / Replacement";
  if (r.includes("bidding") || r.includes("bid prep") || r.includes("tender")) return "Bidding Preparations";
  if (r.includes("order") || r.includes("purchase order") || r.includes("po ")) return "Customer Orders";
  if (r.includes("delivery") || r.includes("shipment") || r.includes("shipping")) return "Delivery Concern";
  if (r.includes("follow up") || r.includes("follow-up") || r.includes("followup")) return "Follow Up";
  if (r.includes("sample")) return "Sample Requests";
  if (r.includes("technical") || r.includes("troubleshoot") || r.includes("specification")) return "Technical Concerns";
  return "Documentation";
};

// ─── Delete Dialog ────────────────────────────────────────────────────────────

interface NoteDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: NoteItem | null;
  onConfirmDelete: () => Promise<void>;
}

const NoteDeleteDialog: React.FC<NoteDeleteDialogProps> = ({
  open, onOpenChange, note, onConfirmDelete,
}) => {
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  useEffect(() => () => clearTimer(), []);
  useEffect(() => { if (!open) { clearTimer(); setProgress(0); } }, [open]);

  const startHold = () => {
    if (loading || !note) return;
    clearTimer();
    setProgress(0);
    intervalRef.current = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev + 2;
        if (next >= 100) { clearTimer(); triggerDelete(); return 100; }
        return next;
      });
    }, 20);
  };

  const cancelHold = () => { clearTimer(); setProgress(0); };

  const triggerDelete = async () => {
    setLoading(true);
    try {
      await onConfirmDelete();
      onOpenChange(false);
    } catch {
      notify.error("Failed to delete note");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none max-w-sm p-0 overflow-hidden">
        <div className="bg-red-600 px-5 py-4">
          <DialogTitle className="text-white text-sm font-black uppercase tracking-widest">Delete Note</DialogTitle>
          <DialogDescription className="text-red-200 text-[11px] mt-0.5">This action cannot be undone.</DialogDescription>
        </div>
        {note && (
          <div className="px-5 py-3 bg-red-50 border-b border-red-100">
            <p className="text-[11px] font-bold text-red-700 uppercase tracking-wide mb-0.5">{note.type_activity}</p>
            <p className="text-[11px] text-red-600 italic truncate">{note.remarks || "No remarks"}</p>
          </div>
        )}
        <DialogFooter className="flex flex-col gap-2 px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}
            className="rounded-none h-9 text-xs uppercase font-bold tracking-wider">
            Cancel
          </Button>
          <div className="relative overflow-hidden rounded-none">
            <Button variant="destructive"
              onMouseDown={startHold} onMouseUp={cancelHold} onMouseLeave={cancelHold}
              onTouchStart={startHold} onTouchEnd={cancelHold}
              disabled={loading}
              className="relative w-full rounded-none h-9 text-xs uppercase font-black tracking-wider z-10">
              {loading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Deleting…</>
                : progress > 0 ? `Hold… ${Math.round(progress)}%` : "Hold to delete"}
            </Button>
            <div className="absolute inset-0 bg-red-900/30 pointer-events-none transition-none"
              style={{ width: `${progress}%` }} />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Section label ────────────────────────────────────────────────────────────

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">{children}</p>
);

// ─── Notes Component ──────────────────────────────────────────────────────────

export const Notes: React.FC<NotesProps> = ({
  referenceid, tsm, manager, dateCreatedFilterRange,
}) => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [deleteNote, setDeleteNote] = useState<NoteItem | null>(null);

  // Search & filter
  const [searchInput, setSearchInput] = useState("");   // controlled input
  const [searchQuery, setSearchQuery] = useState("");   // committed query (on Search click / Enter)
  const [filterType, setFilterType] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  // Form state
  const [typeActivity, setTypeActivity] = useState("Documentation");
  const [remarks, setRemarks] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [tableStyles, setTableStyles] = useState({
    th_bg: "#f9fafb",
    layout: "datatable",
    td_text: "#111827",
    th_text: "#374151",
    table_bg: "#ffffff",
    tfoot_bg: "#ffffff",
    td_border: "#f3f4f6",
    th_border: "#e5e7eb",
    tr_border: "#f3f4f6",
    td_padding: "12",
    tfoot_text: "#6b7280",
    th_padding: "12",
    toolbar_bg: "#f9fafb",
    tr_hover_bg: "#f9fafb",
    table_border: "#e5e7eb",
    table_shadow: "0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 15px -3px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)",
    td_font_size: "13",
    tfoot_border: "#e5e7eb",
    th_font_size: "12",
    pagination_bg: "#ffffff",
    tfoot_padding: "12",
    th_font_weight: "600",
    toolbar_border: "#e5e7eb",
    toolbar_btn_bg: "#ffffff",
    pagination_text: "#374151",
    tfoot_font_size: "12",
    toolbar_btn_text: "#374151",
    toolbar_input_bg: "#ffffff",
    pagination_border: "#d1d5db",
    pagination_radius: "8",
    table_font_family: "'Inter', 'Segoe UI', Arial, sans-serif",
    th_letter_spacing: "0.01em",
    toolbar_btn_border: "#d1d5db",
    toolbar_input_text: "#374151",
    table_border_radius: "16",
    pagination_active_bg: "#3b82f6",
    toolbar_input_border: "#d1d5db",
    pagination_active_text: "#ffffff"

  });

  useEffect(() => {
    fetch("/api/table-styles")
      .then((r) => r.json())
      .then((d) => { if (d?.table_styles) setTableStyles(d.table_styles); })
      .catch(() => { });
  }, []);

  // ── Fetch (server-side search + filter + pagination) ───────────────────────

  const fetchNotes = useCallback(async (targetPage = 1) => {
    if (!referenceid) return;
    setLoading(true);
    try {
      const url = new URL("/api/activity/tsa/documentation/fetch", window.location.origin);
      url.searchParams.append("referenceid", referenceid);
      url.searchParams.append("page", String(targetPage));
      url.searchParams.append("limit", String(PAGE_SIZE));
      if (searchQuery.trim()) url.searchParams.append("search", searchQuery.trim());
      if (filterType !== "all") url.searchParams.append("type", filterType);
      if (dateCreatedFilterRange?.from)
        url.searchParams.append("from", dateCreatedFilterRange.from.toISOString());
      if (dateCreatedFilterRange?.to)
        url.searchParams.append("to", dateCreatedFilterRange.to.toISOString());

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch notes");
      const data = await res.json();

      setNotes(data.notes || []);
      setTotalCount(data.totalCount || 0);
      setPage(targetPage);
    } catch (err: any) {
      notify.error(err.message || "Failed to fetch notes");
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [referenceid, searchQuery, filterType, dateCreatedFilterRange]);

  // Re-fetch when committed filters / date range change
  useEffect(() => { fetchNotes(1); }, [fetchNotes]);

  // Commit search on button click or Enter
  const handleSearch = () => {
    setSearchQuery(searchInput);
  };

  // Time tracking
  const { totalHours, overlappingEntries } = useMemo(() => {
    let total = 0;
    const overlaps: string[] = [];
    notes.forEach((note, i) => {
      total += new Date(note.end_date).getTime() - new Date(note.start_date).getTime();
      notes.forEach((other, j) => {
        if (i !== j) {
          const s1 = new Date(note.start_date).getTime(), e1 = new Date(note.end_date).getTime();
          const s2 = new Date(other.start_date).getTime(), e2 = new Date(other.end_date).getTime();
          if (s1 < e2 && e1 > s2)
            overlaps.push(`${note.type_activity} overlaps with ${other.type_activity}`);
        }
      });
    });
    return { totalHours: total / 3600000, overlappingEntries: [...new Set(overlaps)] };
  }, [notes]);

  // ── Form helpers ───────────────────────────────────────────────────────────

  const autoFillCurrentTime = () => {
    const now = new Date();
    setStartDate(toLocalDateTimeInput(now.toISOString()));
    setEndDate(toLocalDateTimeInput(new Date(now.getTime() + 60 * 60 * 1000).toISOString()));
  };

  const resetForm = () => {
    setSelectedNote(null);
    setTypeActivity("Documentation");
    setRemarks("");
    setStartDate("");
    setEndDate("");
  };

  const loadIntoForm = (n: NoteItem) => {
    setSelectedNote(n);
    setTypeActivity(n.type_activity);
    setRemarks(n.remarks);
    setStartDate(toLocalDateTimeInput(n.start_date));
    setEndDate(toLocalDateTimeInput(n.end_date));
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const saveNote = async () => {
    if (!startDate || !endDate) { notify.error("Start and End date are required"); return; }
    const start = new Date(startDate), end = new Date(endDate);
    if (end < start) { notify.error("End date cannot be earlier than start date"); return; }

    setIsSubmitting(true);
    const payload = {
      referenceid, tsm, manager,
      type_activity: typeActivity,
      remarks: remarks.trim() || "No remarks",
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    };

    try {
      const { error } = selectedNote
        ? await supabase.from("documentation").update(payload).eq("id", selectedNote.id)
        : await supabase.from("documentation").insert(payload);
      if (error) throw error;
      notify.success(selectedNote ? "Note updated" : "Note saved");
      resetForm();
      await fetchNotes(page);
    } catch { notify.error("Failed to save note"); }
    finally { setIsSubmitting(false); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteNote) return;
    const { error } = await supabase.from("documentation").delete().eq("id", deleteNote.id);
    if (error) throw error;
    notify.success("Note deleted");
    if (selectedNote?.id === deleteNote.id) resetForm();
    setDeleteNote(null);
    await fetchNotes(page);
  };

  // ── Shared cell style ──────────────────────────────────────────────────────

  const tdStyle: React.CSSProperties = {
    color: tableStyles.td_text,
    fontSize: `${tableStyles.td_font_size}px`,
    padding: `${tableStyles.td_padding}px 12px`,
    borderColor: tableStyles.td_border,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-5 items-start">

      {/* ── Left: Table ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden border" style={{ borderColor: tableStyles.table_border }}>

        {/* Toolbar */}
        <div
          className="flex flex-wrap items-center gap-3 px-3 py-2.5 border-b"
          style={{ backgroundColor: tableStyles.toolbar_bg, borderColor: tableStyles.toolbar_border }}
        >
          {/* Icon + title */}
          <div className="flex items-center gap-2 shrink-0">
            <FileText className="w-3.5 h-3.5" style={{ color: tableStyles.toolbar_btn_text }} />
            <span
              className="text-[11px] font-black uppercase tracking-widest"
              style={{ color: tableStyles.toolbar_btn_text }}
            >
              Documentation
            </span>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-sm flex gap-2">
            <div className="relative flex-1">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-50"
                style={{ color: tableStyles.toolbar_input_text }}
              />
              <Input
                placeholder="Search type, remarks..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                className="h-8 text-[10px] rounded-none pl-8 uppercase tracking-widest border-0 focus-visible:ring-0"
                style={{
                  color: tableStyles.toolbar_input_text,
                  fontSize: `${tableStyles.th_font_size}px`,
                  backgroundColor: tableStyles.toolbar_input_bg,
                  borderColor: tableStyles.toolbar_input_border,
                }}
              />
            </div>
            <button
              onClick={handleSearch}
              className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest border transition-colors"
              style={{
                color: tableStyles.toolbar_btn_text,
                borderColor: tableStyles.toolbar_btn_border,
                backgroundColor: tableStyles.toolbar_btn_bg,
              }}
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Search"}
            </button>
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest border flex items-center gap-1.5 transition-colors"
            style={{
              color: tableStyles.toolbar_btn_text,
              borderColor: tableStyles.toolbar_btn_border,
              backgroundColor: showFilters ? tableStyles.toolbar_btn_border : tableStyles.toolbar_btn_bg,
            }}
          >
            <Filter className="w-3 h-3" />
            Filter
          </button>

          {/* Record count */}
          {totalCount > 0 && (
            <div
              className="ml-auto flex items-center gap-2 px-3 py-1 border text-[10px] font-bold uppercase tracking-widest"
              style={{
                color: tableStyles.toolbar_btn_text,
                borderColor: tableStyles.toolbar_btn_border,
                backgroundColor: tableStyles.toolbar_btn_bg,
              }}
            >
              {totalCount} record{totalCount !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div
            className="flex flex-wrap items-center gap-3 px-3 py-2.5 border-b"
            style={{ backgroundColor: tableStyles.toolbar_bg, borderColor: tableStyles.toolbar_border }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: tableStyles.toolbar_btn_text }}
            >
              Type:
            </span>
            <Select
              value={filterType}
              onValueChange={(v) => { setFilterType(v); }}
            >
              <SelectTrigger
                className="rounded-none h-7 text-[10px] border-0 focus:ring-0 w-56 uppercase tracking-widest font-bold"
                style={{
                  color: tableStyles.toolbar_input_text,
                  backgroundColor: tableStyles.toolbar_input_bg,
                  borderColor: tableStyles.toolbar_input_border,
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all" className="text-xs">All Types</SelectItem>
                {ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Time tracking summary */}
        {(totalHours > 0 || overlappingEntries.length > 0) && (
          <div
            className="flex items-center justify-between px-4 py-2 border-b"
            style={{ backgroundColor: tableStyles.toolbar_bg, borderColor: tableStyles.toolbar_border }}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" style={{ color: tableStyles.toolbar_btn_text }} />
                <span className="text-[10px] font-bold" style={{ color: tableStyles.toolbar_btn_text }}>
                  Total: {totalHours.toFixed(1)} hrs
                </span>
              </div>
              {overlappingEntries.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-400">
                    {overlappingEntries.length} overlaps
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div
            className="flex justify-center items-center h-40 text-xs font-mono gap-2"
            style={{ color: tableStyles.td_text, backgroundColor: tableStyles.table_bg }}
          >
            <Loader2 className="w-4 h-4 animate-spin" /> Loading records...
          </div>
        ) : notes.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-40 gap-2"
            style={{ backgroundColor: tableStyles.table_bg }}
          >
            <FileText className="w-8 h-8 opacity-20" style={{ color: tableStyles.td_text }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: tableStyles.td_text }}>
              No records found
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ backgroundColor: tableStyles.table_bg }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: tableStyles.th_bg, borderColor: tableStyles.tr_border }}>
                  {["Type", "Remarks", "Start", "End", "Duration", ""].map((h) => (
                    <TableHead
                      key={h}
                      className="uppercase font-black whitespace-nowrap"
                      style={{
                        color: tableStyles.th_text,
                        fontSize: `${tableStyles.th_font_size}px`,
                        padding: `${tableStyles.th_padding}px 12px`,
                        borderColor: tableStyles.th_border,
                        backgroundColor: tableStyles.th_bg,
                      }}
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.map((n) => {
                  const isSelected = selectedNote?.id === n.id;
                  return (
                    <TableRow
                      key={n.id}
                      style={{
                        borderColor: tableStyles.tr_border,
                        backgroundColor: tableStyles.table_bg,
                        borderLeft: isSelected ? `4px solid ${tableStyles.th_bg}` : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected)
                          (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.tr_hover_bg;
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected)
                          (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.table_bg;
                      }}
                    >
                      <TableCell style={tdStyle} className="font-bold">{n.type_activity}</TableCell>
                      <TableCell style={tdStyle} className="italic truncate max-w-[180px]" title={n.remarks}>
                        {truncate(n.remarks)}
                      </TableCell>
                      <TableCell style={tdStyle} className="font-mono whitespace-nowrap">{fmtDateTime(n.start_date)}</TableCell>
                      <TableCell style={tdStyle} className="font-mono whitespace-nowrap">{fmtDateTime(n.end_date)}</TableCell>
                      <TableCell style={tdStyle}>
                        <span className="inline-flex items-center gap-1 font-mono text-[10px]" style={{ color: tableStyles.td_text }}>
                          <Clock className="w-3 h-3 opacity-50 shrink-0" />
                          {getDurationHMS(n.start_date, n.end_date)}
                        </span>
                      </TableCell>
                      <TableCell style={tdStyle}>
                        <div className="flex items-center gap-1">
                          <button
                            title="Edit"
                            onClick={() => loadIntoForm(n)}
                            className="p-1.5 border transition-colors"
                            style={{ borderColor: tableStyles.td_border, color: tableStyles.td_text }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.color = "#2563eb";
                              (e.currentTarget as HTMLElement).style.borderColor = "#bfdbfe";
                              (e.currentTarget as HTMLElement).style.backgroundColor = "#eff6ff";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.color = tableStyles.td_text;
                              (e.currentTarget as HTMLElement).style.borderColor = tableStyles.td_border;
                              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                            }}
                          >
                            <Pen className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Delete"
                            onClick={() => setDeleteNote(n)}
                            className="p-1.5 border transition-colors"
                            style={{ borderColor: tableStyles.td_border, color: tableStyles.td_text }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.color = "#dc2626";
                              (e.currentTarget as HTMLElement).style.borderColor = "#fecaca";
                              (e.currentTarget as HTMLElement).style.backgroundColor = "#fef2f2";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.color = tableStyles.td_text;
                              (e.currentTarget as HTMLElement).style.borderColor = tableStyles.td_border;
                              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                            }}
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

              <tfoot>
                <TableRow style={{ backgroundColor: tableStyles.tfoot_bg, borderColor: tableStyles.tfoot_border }}>
                  <TableCell
                    colSpan={6}
                    className="uppercase tracking-wider"
                    style={{
                      color: tableStyles.tfoot_text,
                      fontSize: `${tableStyles.tfoot_font_size}px`,
                      padding: `${tableStyles.tfoot_padding}px 12px`,
                    }}
                  >
                    {totalCount} record{totalCount !== 1 ? "s" : ""} total
                  </TableCell>
                </TableRow>
              </tfoot>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {pageCount > 1 && (
          <div
            className="flex items-center justify-center border-t"
            style={{ backgroundColor: tableStyles.pagination_bg, borderColor: tableStyles.toolbar_border }}
          >
            <Pagination style={{ color: tableStyles.pagination_text, padding: `${tableStyles.tfoot_padding}px 12px` }}>
              <PaginationContent className="flex items-center gap-4 justify-center text-xs">
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); if (page > 1) fetchNotes(page - 1); }}
                    aria-disabled={page === 1}
                    className={`rounded-none h-8 px-3 text-[10px] font-bold uppercase tracking-widest transition-all ${page === 1 ? "pointer-events-none opacity-30" : ""}`}
                  />
                </PaginationItem>
                <span
                  className="font-mono text-[11px] font-bold select-none px-3 py-1 border"
                  style={{ color: tableStyles.pagination_text, borderColor: tableStyles.toolbar_btn_border }}
                >
                  {page} / {pageCount}
                </span>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => { e.preventDefault(); if (page < pageCount) fetchNotes(page + 1); }}
                    aria-disabled={page === pageCount}
                    className={`rounded-none h-8 px-3 text-[10px] font-bold uppercase tracking-widest transition-all ${page === pageCount ? "pointer-events-none opacity-30" : ""}`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* ── Right: Form ─────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 border border-zinc-200 bg-white overflow-hidden shadow-sm">
        {/* Form header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ backgroundColor: tableStyles.th_bg, borderColor: tableStyles.tr_border }}
        >
          <div className="flex items-center gap-2">
            {selectedNote
              ? <Pen className="w-3.5 h-3.5" style={{ color: tableStyles.th_text }} />
              : <Plus className="w-3.5 h-3.5" style={{ color: tableStyles.th_text }} />}
            <span
              className="text-[11px] font-black uppercase tracking-widest"
              style={{ color: tableStyles.th_text }}
            >
              {selectedNote ? "Edit Record" : "New Record"}
            </span>
          </div>
          {selectedNote && (
            <button
              onClick={resetForm}
              className="text-[10px] font-bold uppercase tracking-widest transition-colors"
              style={{ color: tableStyles.th_text, opacity: 0.6 }}
            >
              Clear
            </button>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); saveNote(); }} className="p-4 space-y-5">
          {/* Type of activity */}
          <div>
            <SectionLabel>Type of Activity</SectionLabel>
            <Select value={typeActivity} onValueChange={setTypeActivity}>
              <SelectTrigger className="rounded-none h-9 text-xs border-zinc-200 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                {ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {remarks && suggestActivityType(remarks) !== typeActivity && (
              <p className="text-[9px] text-blue-600 mt-1">
                💡 Suggested: {suggestActivityType(remarks)}
              </p>
            )}
          </div>

          {/* Remarks */}
          <div>
            <SectionLabel>Remarks</SectionLabel>
            <Textarea
              className="rounded-none text-xs resize-none min-h-[100px] border-zinc-200 focus:ring-0"
              placeholder="Add notes or remarks…"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          {/* Dates */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <SectionLabel>Start Date & Time</SectionLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={autoFillCurrentTime}
                  className="rounded-none h-6 text-[9px] border-zinc-200 px-2"
                >
                  Now
                </Button>
              </div>
              <Input
                type="datetime-local"
                className="rounded-none h-9 text-xs border-zinc-200 focus:ring-0"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <SectionLabel>End Date & Time</SectionLabel>
              <Input
                type="datetime-local"
                className="rounded-none h-9 text-xs border-zinc-200 focus:ring-0"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
              {startDate && endDate && (
                <p className="text-[9px] text-zinc-500 mt-1">
                  ⏱️ Suggested for {typeActivity}: {activityDurations[typeActivity] ?? 30} min
                </p>
              )}
            </div>
          </div>

          {/* Duration preview */}
          {startDate && endDate &&
            !isNaN(new Date(startDate).getTime()) &&
            !isNaN(new Date(endDate).getTime()) &&
            new Date(endDate) >= new Date(startDate) && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-zinc-50 border border-zinc-100">
                <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="text-[11px] font-mono font-bold text-zinc-600">
                  {getDurationHMS(new Date(startDate).toISOString(), new Date(endDate).toISOString())}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-tighter text-zinc-400">duration</span>
              </div>
            )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className={`w-full rounded-none h-10 text-[11px] font-bold uppercase tracking-widest gap-2 ${selectedNote ? "bg-zinc-800 hover:bg-zinc-900" : "bg-zinc-900 hover:bg-zinc-800"
              }`}
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
            ) : selectedNote ? (
              <><Check className="w-4 h-4" />Update Record</>
            ) : (
              <><Plus className="w-4 h-4" />Add Record</>
            )}
          </Button>
        </form>
      </div>

      {/* Delete Dialog */}
      <NoteDeleteDialog
        open={!!deleteNote}
        onOpenChange={(open) => { if (!open) setDeleteNote(null); }}
        note={deleteNote}
        onConfirmDelete={confirmDelete}
      />
    </div>
  );
};
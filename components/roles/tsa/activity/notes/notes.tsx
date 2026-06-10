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
      <DialogContent className="rounded-2xl max-w-sm p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-red-500 px-6 py-6">
          <DialogTitle className="text-white text-sm font-bold tracking-tight">Delete Note</DialogTitle>
          <DialogDescription className="text-red-100 text-xs mt-1 font-medium">This action cannot be undone.</DialogDescription>
        </div>
        {note && (
          <div className="px-6 py-4 bg-white border-b border-zinc-100">
            <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest mb-1">{note.type_activity}</p>
            <p className="text-xs text-zinc-500 italic truncate font-medium">{note.remarks || "No remarks"}</p>
          </div>
        )}
        <DialogFooter className="flex flex-col gap-3 px-6 py-6 bg-zinc-50/50">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}
            className="rounded-full h-11 text-xs font-bold text-zinc-500 hover:bg-zinc-100">
            Cancel
          </Button>
          <div className="relative overflow-hidden rounded-full">
            <Button variant="destructive"
              onMouseDown={startHold} onMouseUp={cancelHold} onMouseLeave={cancelHold}
              onTouchStart={startHold} onTouchEnd={cancelHold}
              disabled={loading}
              className="relative w-full rounded-full h-11 text-xs font-bold shadow-lg shadow-red-200 z-10">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Deleting…</>
                : progress > 0 ? `Hold… ${Math.round(progress)}%` : "Hold to delete"}
            </Button>
            <div className="absolute inset-0 bg-red-900/20 pointer-events-none transition-none"
              style={{ width: `${progress}%` }} />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Section label ────────────────────────────────────────────────────────────

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 ml-1">{children}</p>
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-6 items-start">

      {/* ── Left: Table ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden border border-zinc-200 rounded-2xl bg-white shadow-sm">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-4 px-4 py-4 border-b bg-white border-zinc-100">
          {/* Icon + title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="bg-zinc-900 rounded-full p-2">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="text-[12px] font-bold tracking-tight text-zinc-900">
              Documentation
            </span>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                placeholder="Search type, remarks..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                className="h-10 text-[11px] rounded-full pl-10 border-zinc-200 bg-zinc-50/50 focus-visible:ring-zinc-200 transition-all"
              />
            </div>
            <button
              onClick={handleSearch}
              className="h-10 px-5 text-[11px] font-bold rounded-full bg-zinc-900 text-white hover:bg-zinc-800 transition-all shadow-sm active:scale-95 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Search"}
            </button>
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`h-10 px-5 text-[11px] font-bold rounded-full border flex items-center gap-2 transition-all active:scale-95 ${
              showFilters ? "bg-zinc-100 border-zinc-200 text-zinc-900" : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>

          {/* Record count */}
          {totalCount > 0 && (
            <div className="ml-auto flex items-center gap-2 px-4 py-2 border border-zinc-100 bg-zinc-50/50 text-[10px] font-bold rounded-full text-zinc-500 shadow-sm">
              {totalCount} record{totalCount !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-b bg-zinc-50/30 border-zinc-100">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              Type
            </span>
            <Select
              value={filterType}
              onValueChange={(v) => { setFilterType(v); }}
            >
              <SelectTrigger className="rounded-full h-8 text-[10px] border border-zinc-200 focus:ring-0 w-64 font-bold bg-white text-zinc-700 shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
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
          <div className="flex items-center justify-between px-6 py-3 border-b bg-zinc-50/50 border-zinc-100">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-zinc-600">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span className="text-[11px] font-bold">
                  Total: {totalHours.toFixed(1)} hrs
                </span>
              </div>
              {overlappingEntries.length > 0 && (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-[11px] font-bold">
                    {overlappingEntries.length} overlaps
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex flex-col justify-center items-center py-24 gap-4 bg-white">
            <div className="bg-zinc-50 rounded-full p-4">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Loading records...</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white">
            <div className="bg-zinc-50 rounded-full p-4">
              <FileText className="w-10 h-10 text-zinc-200" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              No records found
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-white border-zinc-100 hover:bg-white">
                  {["Type", "Remarks", "Start", "End", "Duration", ""].map((h) => (
                    <TableHead
                      key={h}
                      className="uppercase font-bold text-zinc-400 text-[10px] tracking-widest py-4 px-6 bg-zinc-50/50 border-none"
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
                      className={`border-zinc-50 transition-colors ${isSelected ? "bg-zinc-50" : "bg-white hover:bg-zinc-50/30"}`}
                    >
                      <TableCell className="text-xs text-zinc-900 py-4 px-6 font-bold">{n.type_activity}</TableCell>
                      <TableCell className="text-xs text-zinc-500 py-4 px-6 font-medium italic truncate max-w-[200px]" title={n.remarks}>
                        {truncate(n.remarks)}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500 py-4 px-6 font-mono whitespace-nowrap font-medium">{fmtDateTime(n.start_date)}</TableCell>
                      <TableCell className="text-xs text-zinc-500 py-4 px-6 font-mono whitespace-nowrap font-medium">{fmtDateTime(n.end_date)}</TableCell>
                      <TableCell className="text-xs text-zinc-500 py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          {getDurationHMS(n.start_date, n.end_date)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500 py-4 px-6">
                        <div className="flex items-center gap-1.5">
                          <button
                            title="Edit"
                            onClick={() => loadIntoForm(n)}
                            className="h-8 w-8 flex items-center justify-center bg-white border border-zinc-200 text-zinc-400 hover:text-zinc-900 hover:border-zinc-900 hover:shadow-sm transition-all rounded-full"
                          >
                            <Pen className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Delete"
                            onClick={() => setDeleteNote(n)}
                            className="h-8 w-8 flex items-center justify-center bg-white border border-zinc-200 text-zinc-400 hover:text-red-500 hover:border-red-500 hover:shadow-sm transition-all rounded-full"
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
                <TableRow className="bg-zinc-50/50 border-t border-zinc-100">
                  <TableCell
                    colSpan={6}
                    className="text-zinc-400 text-[10px] font-bold py-5 px-6 uppercase tracking-widest"
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
          <div className="flex items-center justify-center border-t border-zinc-100 bg-white py-4">
            <Pagination className="text-zinc-600">
              <PaginationContent className="flex items-center gap-4 justify-center">
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); if (page > 1) fetchNotes(page - 1); }}
                    aria-disabled={page === 1}
                    className={`rounded-xl h-9 px-5 text-[11px] font-bold uppercase transition-all border-zinc-200 ${page === 1 ? "pointer-events-none opacity-30 bg-zinc-50" : "hover:bg-zinc-50 active:scale-95 shadow-sm"}`}
                  />
                </PaginationItem>
                <span className="font-mono text-[12px] font-bold select-none px-4 py-1.5 rounded-full border border-zinc-100 text-zinc-900 bg-zinc-50/50">
                  {page} / {pageCount}
                </span>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => { e.preventDefault(); if (page < pageCount) fetchNotes(page + 1); }}
                    aria-disabled={page === pageCount}
                    className={`rounded-xl h-9 px-5 text-[11px] font-bold uppercase transition-all border-zinc-200 ${page === pageCount ? "pointer-events-none opacity-30 bg-zinc-50" : "hover:bg-zinc-50 active:scale-95 shadow-sm"}`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* ── Right: Form ─────────────────────────────────────────────────── */}
      <div className="w-80 shrink-0 border border-zinc-200 bg-white overflow-hidden shadow-sm rounded-2xl">
        {/* Form header */}
        <div className="flex items-center justify-between px-6 py-5 border-b bg-zinc-900 text-white border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="bg-white/10 rounded-full p-1.5">
              {selectedNote
                ? <Pen className="w-3.5 h-3.5 text-blue-400" />
                : <Plus className="w-3.5 h-3.5 text-emerald-400" />}
            </div>
            <span className="text-[12px] font-bold tracking-tight">
              {selectedNote ? "Edit Record" : "New Record"}
            </span>
          </div>
          {selectedNote && (
            <button
              onClick={resetForm}
              className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); saveNote(); }} className="p-6 space-y-6 bg-white">
          {/* Type of activity */}
          <div>
            <SectionLabel>Type of Activity</SectionLabel>
            <Select value={typeActivity} onValueChange={setTypeActivity}>
              <SelectTrigger className="rounded-full h-11 text-xs border-zinc-200 bg-zinc-50/50 focus:ring-zinc-200 font-medium transition-all">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {ACTIVITY_TYPES.map((t) => (
                  <SelectItem value={t} key={t} className="text-xs font-medium">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {remarks && suggestActivityType(remarks) !== typeActivity && (
              <div className="flex items-center gap-1.5 mt-2 ml-1">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <p className="text-[10px] text-blue-600 font-bold italic">
                  Suggested: {suggestActivityType(remarks)}
                </p>
              </div>
            )}
          </div>

          {/* Remarks */}
          <div>
            <SectionLabel>Remarks</SectionLabel>
            <Textarea
              className="rounded-2xl text-xs resize-none min-h-[120px] border-zinc-200 bg-zinc-50/50 focus-visible:ring-zinc-200 transition-all p-4"
              placeholder="Add notes or remarks…"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          {/* Dates */}
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Start Date & Time</SectionLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={autoFillCurrentTime}
                  className="rounded-full h-6 text-[10px] bg-zinc-100 text-zinc-600 px-3 font-bold hover:bg-zinc-200 active:scale-95 transition-all"
                >
                  Set Now
                </Button>
              </div>
              <Input
                type="datetime-local"
                className="rounded-full h-11 text-xs border-zinc-200 bg-zinc-50/50 focus-visible:ring-zinc-200 font-medium"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <SectionLabel>End Date & Time</SectionLabel>
              <Input
                type="datetime-local"
                className="rounded-full h-11 text-xs border-zinc-200 bg-zinc-50/50 focus-visible:ring-zinc-200 font-medium"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
              {startDate && endDate && (
                <div className="flex items-center gap-1.5 mt-2 ml-1 text-zinc-400">
                  <Clock className="w-3 h-3" />
                  <p className="text-[10px] font-medium italic">
                    Duration for {typeActivity}: {activityDurations[typeActivity] ?? 30} min
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Duration preview */}
          {startDate && endDate &&
            !isNaN(new Date(startDate).getTime()) &&
            !isNaN(new Date(endDate).getTime()) &&
            new Date(endDate) >= new Date(startDate) && (
              <div className="flex items-center gap-3 px-4 py-4 bg-zinc-50/50 border border-zinc-100 rounded-xl shadow-inner">
                <div className="bg-white rounded-full p-2 shadow-sm">
                  <Clock className="w-4 h-4 text-zinc-900 shrink-0" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[12px] font-mono font-bold text-zinc-900">
                    {getDurationHMS(new Date(startDate).toISOString(), new Date(endDate).toISOString())}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">calculated duration</span>
                </div>
              </div>
            )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className={`w-full rounded-full h-12 text-[12px] font-bold tracking-tight gap-2 shadow-lg transition-all active:scale-[0.98] ${selectedNote ? "bg-zinc-800 hover:bg-zinc-900 shadow-zinc-200" : "bg-zinc-900 hover:bg-zinc-800 shadow-zinc-300"
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
"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  PenIcon,
  Undo,
  Trash2,
  Search,
  Clock,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  Filter,
  ListFilter,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";

const QUOTATION_STATUS_OPTIONS = {
  "Pending Client Approval": ["For Bidding", "Nego", "Waiting for Approval"],
  "Order Complete": [],
  "Convert to SO": [],
  "Decline": [
    "Loss Price is Too High", "Lead Time Issue", "Insufficient Stock",
    "Lost Bid", "Canvass Only", "Did not Meet the Specs", "Declined / Dissaproved",
  ],
};

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationPrevious, PaginationNext,
} from "@/components/ui/pagination";
import { sileo } from "sileo";
import { TaskListDialog } from "./dialog/filter";
import TaskListEditDialog from "./dialog/edit";
import { AccountsActiveDeleteDialog } from "../../activity/planner/dialog/delete";
import { getTableStyles, DEFAULT_TABLE_STYLES, type TableStyles } from "@/lib/table-styles";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Completed {
  id: number;
  activity_reference_number: string;
  referenceid: string;
  tsm: string;
  manager: string;
  type_client: string;
  project_name?: string;
  product_category?: string;
  project_type?: string;
  source?: string;
  target_quota?: number;
  type_activity?: string;
  callback?: string;
  call_status?: string;
  call_type?: string;
  quotation_number?: string;
  quotation_amount?: number;
  quotation_status?: string;
  quotation_status_sub?: string;
  so_number?: string;
  so_amount?: number;
  actual_sales?: number;
  delivery_date?: string;
  dr_number?: string;
  ticket_reference_number?: string;
  remarks?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  date_followup: string;
  date_site_visit: string;
  date_created: string;
  date_updated?: string;
  company_name: string;
  contact_number: string;
  contact_person?: string;
  email_address?: string;
  payment_terms?: string;
  scheduled_status?: string;
}

interface CompletedProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const displayValue = (v: any): string =>
  v === null || v === undefined || String(v).trim() === "" ? "-" : String(v);

function formatTimeWithAmPm(time24: string): string {
  const [hourStr, minute] = time24.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${ampm}`;
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return "-";
  const s = new Date(start), e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "-";
  let diff = Math.max(0, Math.floor((e.getTime() - s.getTime()) / 1000));
  const hours = Math.floor(diff / 3600); diff %= 3600;
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

function toDatetimeLocal(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Password Gate Dialog ─────────────────────────────────────────────────────

interface PasswordGateDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function PasswordGateDialog({ open, onClose, onSuccess }: PasswordGateDialogProps) {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPassword(""); setShowPw(false); setError(false); setShake(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSubmit = async () => {
    if (!password.trim()) {
      setError(true); setShake(true); setPassword("");
      setTimeout(() => setShake(false), 500);
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    try {
      const res = await fetch("/api/auth/verify-edit-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Authentication failed");
      }
      setError(false);
      onSuccess();
      onClose();
    } catch {
      setError(true); setShake(true); setPassword("");
      setTimeout(() => setShake(false), 500);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-xs rounded-none p-0 overflow-hidden gap-0">
        <div className="bg-zinc-900 px-6 pt-5 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-white/10 rounded-full p-1.5">
                <Lock className="h-4 w-4 text-yellow-400" />
              </div>
              <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">
                Authentication Required
              </DialogTitle>
            </div>
            <p className="text-zinc-400 text-xs mt-1">Enter the password to edit timestamp data.</p>
          </DialogHeader>
        </div>
        <div className={`px-6 py-5 space-y-4 ${shake ? "animate-shake" : ""}`}>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Password</label>
            <div className="relative">
              <Input
                ref={inputRef}
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                placeholder="Enter password"
                className={`rounded-none text-sm pr-9 ${error ? "border-red-400 focus-visible:ring-red-300" : ""}`}
              />
              <button type="button" tabIndex={-1} onClick={() => setShowPw((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            {error && <p className="text-[11px] text-red-500 font-medium">Incorrect password. Please try again.</p>}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-zinc-100 flex gap-2">
          <Button variant="outline" className="rounded-none flex-1 text-xs h-10" onClick={onClose}>Cancel</Button>
          <Button className="rounded-none flex-1 text-xs h-10 bg-zinc-900 hover:bg-zinc-800 gap-1.5"
            onClick={handleSubmit} disabled={!password}>
            <ShieldCheck className="h-3.5 w-3.5" />Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Time Dialog ─────────────────────────────────────────────────────────

interface EditTimeDialogProps {
  open: boolean;
  onClose: () => void;
  item: Completed | null;
  onSaved: () => void;
  onAutoUpdateStatus?: (item: Completed, trigger: "quotation" | "so" | "delivery") => Promise<void>;
}

function EditTimeDialog({ open, onClose, item, onSaved, onAutoUpdateStatus }: EditTimeDialogProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) { setStartDate(toDatetimeLocal(item.start_date)); setEndDate(toDatetimeLocal(item.end_date)); setError(null); }
  }, [item, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSave = async () => {
    if (!item) return;
    if (!startDate?.trim() || !endDate?.trim()) { setError("Both start and end date are required."); return; }
    let start: Date, end: Date;
    try {
      start = new Date(startDate + ":00");
      end = new Date(endDate + ":00");
      if (isNaN(start.getTime()) || isNaN(end.getTime())) { setError("Invalid date format."); return; }
      if (end <= start) { setError("End date must be after start date."); return; }
    } catch { setError("Invalid date format."); return; }

    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/activity/tsa/historical/update-history-time", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({ id: item.id, start_date: start.toISOString(), end_date: end.toISOString() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to update time");
      }
      onSaved();
      if (onAutoUpdateStatus) await onAutoUpdateStatus(item, "quotation");
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !item) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-none p-0 overflow-hidden gap-0">
        <div className="bg-zinc-900 px-6 pt-5 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-white/10 rounded-full p-1.5"><Clock className="h-4 w-4 text-blue-400" /></div>
              <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">Edit Time</DialogTitle>
            </div>
            <p className="text-zinc-400 text-xs font-mono mt-1">{item.company_name}</p>
            {item.type_activity && <p className="text-zinc-500 text-[10px] uppercase tracking-wider mt-0.5">{item.type_activity}</p>}
          </DialogHeader>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Start Date &amp; Time</label>
            <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-none text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">End Date &amp; Time</label>
            <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-none text-sm" />
          </div>
          {startDate && endDate && (() => {
            const s = new Date(startDate), e = new Date(endDate);
            if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e > s) {
              return (
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 border border-zinc-200 text-xs text-zinc-600">
                  <Clock className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Duration: <strong className="text-zinc-800">{formatDuration(s.toISOString(), e.toISOString())}</strong></span>
                </div>
              );
            }
            return null;
          })()}
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-zinc-100 flex gap-2">
          <Button variant="outline" className="rounded-none flex-1 text-xs h-10" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="rounded-none flex-1 text-xs h-10 bg-zinc-900 hover:bg-zinc-800" onClick={handleSave} disabled={saving || !startDate || !endDate}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TaskList: React.FC<CompletedProps> = ({
  referenceid, target_quota, dateCreatedFilterRange, setDateCreatedFilterRangeAction,
}) => {
  const [activities, setActivities] = useState<Completed[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTypeActivity, setFilterTypeActivity] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterTypeClient, setFilterTypeClient] = useState("all");
  const [filterCallStatus, setFilterCallStatus] = useState("all");
  const [filterQuotationStatus, setFilterQuotationStatus] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const [editItem, setEditItem] = useState<Completed | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [removeRemarks, setRemoveRemarks] = useState("");

  const [reSoOpen, setReSoOpen] = useState(false);
  const [reSoItem, setReSoItem] = useState<Completed | null>(null);
  const [editSoNumber, setEditSoNumber] = useState("");
  const [editSoAmount, setEditSoAmount] = useState<number | "">("");
  const [isEditingSo, setIsEditingSo] = useState(false);
  const [savingSo, setSavingSo] = useState(false);

  const [editTimeOpen, setEditTimeOpen] = useState(false);
  const [editTimeItem, setEditTimeItem] = useState<Completed | null>(null);
  const [showEditTimeBtn, setShowEditTimeBtn] = useState(false);

  const [pwGateOpen, setPwGateOpen] = useState(false);
  const [pendingTimeItem, setPendingTimeItem] = useState<Completed | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const pageCount = Math.ceil(totalCount / itemsPerPage);

  const [tableStyles, setTableStyles] = useState<TableStyles>(DEFAULT_TABLE_STYLES);

  useEffect(() => {
    getTableStyles().then(setTableStyles);
  }, []);

  // ── Status Progression Automation ─────────────────────────────────────────

  const autoUpdateStatus = async (item: Completed, trigger: "quotation" | "so" | "delivery") => {
    try {
      let newStatus: string | null = null;
      let reason = "";
      switch (trigger) {
        case "quotation":
          if (item.quotation_status === "Convert to SO" && item.quotation_number && item.quotation_amount) {
            newStatus = "Quote-Done"; reason = "Quotation marked for SO conversion";
          }
          break;
        case "so":
          if (item.so_number && item.so_amount && item.status === "Quote-Done") {
            newStatus = "SO-Done"; reason = "Sales Order created";
          }
          break;
        case "delivery":
          if (item.dr_number && item.delivery_date && item.status === "SO-Done") {
            newStatus = "Delivered"; reason = "Delivery recorded";
          }
          break;
      }
      if (newStatus && newStatus !== item.status) {
        const res = await fetch("/api/activity/tsa/historical/auto-update-status", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
          body: JSON.stringify({ id: item.id, newStatus, previousStatus: item.status, trigger, reason, autoUpdate: true }),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData?.error || "Failed to auto-update status");
        }
        sileo.success({ title: "Status Auto-Updated", description: `${item.company_name} status changed to ${newStatus.replace("-", " ")}`, duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
        fetchActivities(page);
      }
    } catch (error: any) {
      sileo.error({ title: "Auto-Update Failed", description: error?.message || "Could not auto-update status", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    }
  };

  // ── Alt+Ctrl+T shortcut ───────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.ctrlKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setShowEditTimeBtn((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleEditTimeClick = (item: Completed) => { setPendingTimeItem(item); setPwGateOpen(true); };
  const handlePasswordSuccess = () => {
    if (pendingTimeItem) { setEditTimeItem(pendingTimeItem); setEditTimeOpen(true); }
    setPendingTimeItem(null);
  };

  // ── Inline Update ──────────────────────────────────────────────────────────

  const handleInlineUpdate = async (id: number, field: string, value: any) => {
    if (!id || !field?.trim()) return;
    const sanitizedValue = typeof value === "string" ? value.trim() : value;
    try {
      const res = await fetch(`/api/activity/tsa/historical/update?id=${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({ [field]: sanitizedValue }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || "Failed to update"); }
      sileo.success({ title: "Updated", description: `${field.replace(/_/g, " ")} updated.`, duration: 2000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      fetchActivities(page);
    } catch (error: any) {
      sileo.error({ title: "Update Failed", description: error?.message || "Could not update.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    }
  };

  const handleQuotationStatusUpdate = async (id: number, main: string, sub: string) => {
    if (!id || !main?.trim()) return;
    try {
      const res = await fetch("/api/activity/tsa/historical/update-quotation-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({ id, quotation_status: main.trim(), quotation_status_sub: sub?.trim() || "" }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || "Failed to update"); }
      const updatedItem = activities.find((item) => item?.id === id);
      if (updatedItem) await autoUpdateStatus({ ...updatedItem, quotation_status: main.trim() }, "quotation");
      sileo.success({ title: "Updated", description: "Quotation status updated.", duration: 2000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      fetchActivities(page);
    } catch (error: any) {
      sileo.error({ title: "Update Failed", description: error?.message || "Could not update.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    }
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchActivities = useCallback(async (targetPage = 1) => {
    if (!referenceid?.trim()) { setActivities([]); setTotalCount(0); return; }
    setLoading(true); setError(null);
    try {
      const from = dateCreatedFilterRange?.from ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10) : null;
      const to = dateCreatedFilterRange?.to ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10) : null;

      const url = new URL("/api/activity/tsa/historical/fetch", window.location.origin);
      url.searchParams.append("referenceid", encodeURIComponent(referenceid.trim()));
      url.searchParams.append("page", String(targetPage));
      url.searchParams.append("limit", String(itemsPerPage));
      if (searchTerm.trim()) url.searchParams.append("search", searchTerm.trim());
      if (filterStatus !== "all") url.searchParams.append("status", filterStatus);
      if (filterTypeActivity !== "all") url.searchParams.append("type_activity", filterTypeActivity);
      if (filterSource !== "all") url.searchParams.append("source", filterSource);
      if (filterTypeClient !== "all") url.searchParams.append("type_client", filterTypeClient);
      if (filterCallStatus !== "all") url.searchParams.append("call_status", filterCallStatus);
      if (filterQuotationStatus !== "all") url.searchParams.append("quotation_status", filterQuotationStatus);
      if (from && to) { url.searchParams.append("from", from); url.searchParams.append("to", to); }

      const res = await fetch(url.toString(), { headers: { "X-CSRF-Protection": "1" } });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || "Failed to fetch"); }
      const data = await res.json();
      setActivities(Array.isArray(data.activities) ? data.activities : []);
      setTotalCount(data.pagination?.total_count ?? 0);
      setPage(targetPage);
    } catch (err: any) {
      setError(err.message || "Failed to fetch activities");
      setActivities([]); setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [referenceid, dateCreatedFilterRange, itemsPerPage, searchTerm, filterStatus, filterTypeActivity, filterSource, filterTypeClient, filterCallStatus, filterQuotationStatus]);

  // Re-fetch on filter/date change
  useEffect(() => { fetchActivities(1); }, [fetchActivities]);

  // Realtime
  useEffect(() => {
    if (!referenceid?.trim()) return;
    let mounted = true;
    const channel = supabase
      .channel(`history-${referenceid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "history", filter: `referenceid=eq.${referenceid}` }, () => { if (mounted) fetchActivities(page); })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(channel).catch(() => { }); };
  }, [referenceid, fetchActivities]);

  // Commit search
  const handleSearch = () => setSearchTerm(searchInput);

  // Unique filter options derived from current page data
  const statusOptions = useMemo(() => [...new Set(activities.map((a) => a.status).filter(Boolean))].sort() as string[], [activities]);
  const typeActivityOptions = useMemo(() => [...new Set(activities.map((a) => a.type_activity).filter(Boolean))].sort() as string[], [activities]);
  const sourceOptions = useMemo(() => [...new Set(activities.map((a) => a.source).filter(Boolean))].sort() as string[], [activities]);
  const typeClientOptions = useMemo(() => [...new Set(activities.map((a) => a.type_client).filter(Boolean))].sort() as string[], [activities]);
  const callStatusOptions = useMemo(() => [...new Set(activities.map((a) => a.call_status).filter(Boolean))].sort() as string[], [activities]);
  const quotationStatusOptions = useMemo(() => [...new Set(activities.map((a) => a.quotation_status).filter(Boolean))].sort() as string[], [activities]);

  // ── Selection ──────────────────────────────────────────────────────────────

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);

  const allCurrentSelected = useMemo(() =>
    activities.length > 0 && activities.every((item) => item?.id !== undefined && selectedIds.has(item.id)),
    [activities, selectedIds]);

  const toggleSelectAll = useCallback(() => {
    if (allCurrentSelected) {
      setSelectedIds((prev) => { const next = new Set(prev); activities.forEach((item) => { if (item?.id !== undefined) next.delete(item.id); }); return next; });
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); activities.forEach((item) => { if (item?.id !== undefined) next.add(item.id); }); return next; });
    }
  }, [allCurrentSelected, activities]);

  // ── Delete ─────────────────────────────────────────────────────────────────

  const onConfirmRemove = async () => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch("/api/act-delete-history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({ ids: Array.from(selectedIds), remarks: removeRemarks?.trim() || "" }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || "Failed to delete"); }
      setDeleteDialogOpen(false); setSelectedIds(new Set()); setRemoveRemarks("");
      fetchActivities(page);
      sileo.success({ title: "Deleted", description: "Selected items deleted.", duration: 2000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch (err: any) {
      sileo.error({ title: "Delete Failed", description: err?.message || "Could not delete.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    }
  };

  // ── SO Update ──────────────────────────────────────────────────────────────

  const handleSaveSo = async () => {
    if (!reSoItem?.id || !editSoNumber?.trim() || editSoAmount === "") return;
    setSavingSo(true);
    try {
      const res = await fetch("/api/act-update-so", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({ id: reSoItem.id, so_number: editSoNumber.trim().toUpperCase(), so_amount: Number(editSoAmount) }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || "Failed to update SO"); }
      setIsEditingSo(false); setReSoOpen(false);
      await autoUpdateStatus(reSoItem, "so");
      sileo.success({ title: "Updated", description: "Sales Order updated.", duration: 2000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch (err: any) {
      sileo.error({ title: "Update Failed", description: err?.message || "Could not update.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally { setSavingSo(false); }
  };

  // ── Shared cell style ──────────────────────────────────────────────────────

  const tdStyle: React.CSSProperties = {
    color: tableStyles.td_text,
    fontSize: `${tableStyles.td_font_size}px`,
    padding: `${tableStyles.td_padding}px 12px`,
    borderColor: tableStyles.td_border,
  };

  const thStyle: React.CSSProperties = {
    color: tableStyles.th_text,
    fontSize: `${tableStyles.th_font_size}px`,
    padding: `${tableStyles.th_padding}px 12px`,
    borderColor: tableStyles.th_border,
    backgroundColor: tableStyles.th_bg,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes rq-highlight-pulse {
          0%   { background-color: rgb(254 249 195); }
          50%  { background-color: rgb(253 224 71);  }
          100% { background-color: rgb(254 249 195); }
        }
        .rq-highlight-row { animation: rq-highlight-pulse 0.8s ease-in-out 3; outline: 2px solid rgb(234 179 8); outline-offset: -2px; }
      `}</style>

      <PasswordGateDialog
        open={pwGateOpen}
        onClose={() => { setPwGateOpen(false); setPendingTimeItem(null); }}
        onSuccess={handlePasswordSuccess}
      />
      <EditTimeDialog
        open={editTimeOpen}
        onClose={() => { setEditTimeOpen(false); setEditTimeItem(null); }}
        item={editTimeItem}
        onSaved={() => fetchActivities(page)}
        onAutoUpdateStatus={autoUpdateStatus}
      />

      {/* ── Unified table container ── */}
      <div
        className="overflow-hidden border"
        style={{ borderColor: tableStyles.table_border, borderRadius: `${tableStyles.table_border_radius}px` }}
      >

        {/* ── Toolbar ── */}
        <div
          className="flex flex-wrap items-center gap-3 px-3 py-2.5 border-b"
          style={{ backgroundColor: tableStyles.toolbar_bg, borderColor: tableStyles.toolbar_border }}
        >
          {/* Title */}
          <div className="flex items-center gap-2 shrink-0">
            <ListFilter className="w-3.5 h-3.5" style={{ color: tableStyles.toolbar_btn_text }} />
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: tableStyles.toolbar_btn_text }}>
              Historical Records
            </span>
          </div>

          {/* Search input */}
          <div className="relative flex-1 min-w-[180px] max-w-sm flex gap-2">
            <div className="relative flex-1">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-50"
                style={{ color: tableStyles.toolbar_input_text }}
              />
              <Input
                placeholder="Search records..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                className="h-8 text-[10px] rounded-none pl-8 uppercase tracking-widest border-0 focus-visible:ring-0"
                style={{
                  color: tableStyles.toolbar_input_text,
                  fontSize: `${tableStyles.th_font_size}px`,
                  backgroundColor: tableStyles.toolbar_input_bg,
                  borderColor: tableStyles.toolbar_input_border,
                  borderRadius: `${tableStyles.table_border_radius}px`,
                }}
              />
            </div>
            <button
              onClick={handleSearch}
              className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest border transition-colors"
              style={{ color: tableStyles.toolbar_btn_text, borderColor: tableStyles.toolbar_btn_border, backgroundColor: tableStyles.toolbar_btn_bg, borderRadius: `${tableStyles.table_border_radius}px`, }}
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Search"}
            </button>
          </div>

          {/* Edit Time mode badge */}
          {showEditTimeBtn && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest border"
              style={{ color: "#60a5fa", borderColor: "#1d4ed8", backgroundColor: "rgba(29,78,216,0.15)" }}
            >
              <Clock className="w-3 h-3" />
              Edit Time Mode
            </span>
          )}

          {/* Right side actions */}
          <div className="ml-auto flex items-center gap-2">
            {/* Advanced filters dialog (existing) */}
            <TaskListDialog
              filterStatus={filterStatus}
              filterTypeActivity={filterTypeActivity}
              filterSource={filterSource}
              filterTypeClient={filterTypeClient}
              filterCallStatus={filterCallStatus}
              filterQuotationStatus={filterQuotationStatus}
              setFilterStatus={setFilterStatus}
              setFilterTypeActivity={setFilterTypeActivity}
              setFilterSource={setFilterSource}
              setFilterTypeClient={setFilterTypeClient}
              setFilterCallStatus={setFilterCallStatus}
              setFilterQuotationStatus={setFilterQuotationStatus}
              statusOptions={statusOptions}
              typeActivityOptions={typeActivityOptions}
              sourceOptions={sourceOptions}
              typeClientOptions={typeClientOptions}
              callStatusOptions={callStatusOptions}
              quotationStatusOptions={quotationStatusOptions}
              itemsPerPage={itemsPerPage}
              setItemsPerPage={setItemsPerPage}
              setCurrentPage={setPage}
            />

            {/* Delete selected */}
            {selectedIds.size > 0 && (
              <button
                className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors bg-red-600 border-red-700 text-white hover:bg-red-700"
                style={{
                  borderRadius: `${tableStyles.table_border_radius}px`,
                }}
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-3 h-3" />
                Delete ({selectedIds.size})
              </button>
            )}

            {/* Record count */}
            {totalCount > 0 && (
              <div
                className="flex items-center gap-2 px-3 py-1 border text-[10px] font-bold uppercase tracking-widest"
                style={{ color: tableStyles.toolbar_btn_text, borderColor: tableStyles.toolbar_btn_border, backgroundColor: tableStyles.toolbar_btn_bg, borderRadius: `${tableStyles.table_border_radius}px`, }}
              >
                <span className="border-r pr-2" style={{ borderColor: tableStyles.toolbar_btn_border }}>
                  {totalCount} records
                </span>
                <span className="font-mono">
                  {Math.min((page - 1) * itemsPerPage + 1, totalCount)}–{Math.min(page * itemsPerPage, totalCount)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Quick filter panel ── */}
        {showFilters && (
          <div
            className="flex flex-wrap items-center gap-3 px-3 py-2.5 border-b"
            style={{ backgroundColor: tableStyles.toolbar_bg, borderColor: tableStyles.toolbar_border }}
          >
            {[
              { label: "Status", value: filterStatus, setter: setFilterStatus, options: statusOptions },
              { label: "Activity", value: filterTypeActivity, setter: setFilterTypeActivity, options: typeActivityOptions },
              { label: "Source", value: filterSource, setter: setFilterSource, options: sourceOptions },
              { label: "Client Type", value: filterTypeClient, setter: setFilterTypeClient, options: typeClientOptions },
              { label: "Call Status", value: filterCallStatus, setter: setFilterCallStatus, options: callStatusOptions },
              { label: "Quotation", value: filterQuotationStatus, setter: setFilterQuotationStatus, options: quotationStatusOptions },
            ].map(({ label, value, setter, options }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: tableStyles.toolbar_btn_text }}>
                  {label}:
                </span>
                <Select value={value} onValueChange={(v) => { setter(v); fetchActivities(1); }}>
                  <SelectTrigger
                    className="rounded-none h-7 text-[10px] border-0 focus:ring-0 w-36 uppercase tracking-widest font-bold"
                    style={{ color: tableStyles.toolbar_input_text, backgroundColor: tableStyles.toolbar_input_bg }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="all" className="text-xs">All</SelectItem>
                    {options.map((o) => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="p-4" style={{ backgroundColor: tableStyles.table_bg }}>
            <Alert variant="destructive" className="rounded-none border-red-200 bg-red-50">
              <AlertCircleIcon className="h-5 w-5 text-red-600" />
              <AlertTitle className="text-sm font-bold text-red-900">Sync Error</AlertTitle>
              <AlertDescription className="text-xs text-red-700">
                Could not retrieve historical data. Please try again.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && activities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3"
            style={{ backgroundColor: tableStyles.table_bg }}>
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: tableStyles.td_text, opacity: 0.4 }} />
            <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: tableStyles.td_text, opacity: 0.5 }}>
              Retrieving Records...
            </p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && activities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2"
            style={{ backgroundColor: tableStyles.table_bg }}>
            <CheckCircle2Icon className="h-10 w-10 opacity-20" style={{ color: tableStyles.td_text }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: tableStyles.td_text, opacity: 0.5 }}>
              No historical records found
            </p>
          </div>
        )}

        {/* ── Table ── */}
        {activities.length > 0 && (
          <div className="overflow-x-auto" style={{ backgroundColor: tableStyles.table_bg }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: tableStyles.th_bg, borderColor: tableStyles.tr_border }}>
                  <TableHead style={thStyle} className="uppercase font-black">
                    <Checkbox
                      checked={allCurrentSelected}
                      onCheckedChange={toggleSelectAll}
                      className="h-4 w-4"
                      style={{
                        borderRadius: `${tableStyles.table_border_radius}px`,
                      }} />
                  </TableHead>
                  <TableHead style={thStyle} className="uppercase font-black">Edit</TableHead>
                  {[
                    "Date", "Quotation #", "Duration", "Company", "Status", "Quotation Status",
                    "Quotation Remarks", "Contact #", "Type Client", "Project Name", "Project Type",
                    "Source", "Target Quota", "Activity Type", "Callback", "Call Status", "Call Type",
                    "Quotation Amount", "SO #", "SO Amount", "Actual Sales", "Delivery Date",
                    "DR #", "Ticket Ref #", "Remarks", "Date Followup", "Payment Terms",
                  ].map((h) => (
                    <TableHead key={h} style={thStyle} className="uppercase font-black whitespace-nowrap">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {activities.map((item) => {
                  if (!item || item.id === undefined) return null;
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <TableRow
                      key={item.id}
                      style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.table_bg }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.tr_hover_bg; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.table_bg; }}
                    >
                      <TableCell style={tdStyle}>
                        <Checkbox
                          className="h-4 w-4" checked={isSelected}
                          onCheckedChange={() => toggleSelect(item.id)}
                          style={{
                            borderRadius: `${tableStyles.table_border_radius}px`,
                          }} />
                      </TableCell>
                      <TableCell style={tdStyle}>
                        <div className="flex items-center gap-1">
                          <button
                            title="Edit"
                            onClick={() => { setEditItem(item); setEditOpen(true); }}
                            className="h-7 w-7 flex items-center justify-center border transition-colors"
                            style={{ borderColor: tableStyles.td_border, color: tableStyles.td_text, borderRadius: `${tableStyles.table_border_radius}px`, }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#eff6ff"; (e.currentTarget as HTMLElement).style.color = "#2563eb"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = tableStyles.td_text; }}
                          >
                            <PenIcon className="h-3.5 w-3.5" />
                          </button>
                          {item.type_activity === "Sales Order Preparation" && (
                            <button
                              title="RE-SO"
                              onClick={() => { setReSoItem(item); setEditSoNumber(item.so_number || ""); setEditSoAmount(item.so_amount ?? ""); setIsEditingSo(false); setReSoOpen(true); }}
                              className="h-7 w-7 flex items-center justify-center border transition-colors"
                              style={{ borderColor: tableStyles.td_border, color: tableStyles.td_text, borderRadius: `${tableStyles.table_border_radius}px`, }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#fffbeb"; (e.currentTarget as HTMLElement).style.color = "#d97706"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = tableStyles.td_text; }}
                            >
                              <Undo className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {showEditTimeBtn && (
                            <button
                              title="Edit Timestamp"
                              onClick={() => handleEditTimeClick(item)}
                              className="h-7 w-7 flex items-center justify-center border transition-colors"
                              style={{ borderColor: tableStyles.td_border, color: tableStyles.td_text, borderRadius: `${tableStyles.table_border_radius}px`, }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#ecfdf5"; (e.currentTarget as HTMLElement).style.color = "#059669"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = tableStyles.td_text; }}
                            >
                              <Clock className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </TableCell>

                      <TableCell style={tdStyle}>
                        {new Date(item.date_updated ?? item.date_created).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </TableCell>
                      <TableCell style={tdStyle}>{displayValue(item.quotation_number)}</TableCell>
                      <TableCell style={tdStyle}>{formatDuration(item.start_date, item.end_date)}</TableCell>
                      <TableCell style={{ ...tdStyle }} className="font-bold">{item.company_name}</TableCell>
                      <TableCell style={tdStyle}>
                        {item.status && (
                          <Badge variant="outline"
                            className={`text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 border-transparent ${item.status === "Delivered" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                              item.status === "Quote-Done" ? "bg-blue-50 text-blue-700 border-blue-100" :
                                item.status === "SO-Done" ? "bg-amber-50 text-amber-700 border-amber-100" :
                                  item.status === "On Progress" || item.status === "Assisted" ? "bg-orange-50 text-orange-700 border-orange-100" :
                                    item.status === "Cancelled" ? "bg-red-50 text-red-700 border-red-100" :
                                      "bg-zinc-100 text-zinc-600 border-zinc-200"
                              }`}
                            style={{
                              borderRadius: `${tableStyles.table_border_radius}px`,
                            }}>
                            {item.status.replace("-", " ")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell style={tdStyle}>
                        {item.status === "Quote-Done" ? (
                          <Select
                            value={`${item.quotation_status || ""}__${item.quotation_status_sub || ""}`}
                            onValueChange={(val) => { const [main, sub] = val.split("__"); handleQuotationStatusUpdate(item.id, main, sub || ""); }}
                          >
                            <SelectTrigger
                              className="h-7 text-[10px] w-[140px] border-zinc-200 bg-white hover:bg-zinc-50 font-bold uppercase tracking-tight"
                              style={{
                                borderRadius: `${tableStyles.table_border_radius}px`,
                              }}>
                              <SelectValue asChild><span>{item.quotation_status || "Select status"}</span></SelectValue>
                            </SelectTrigger>
                            <SelectContent style={{ borderRadius: tableStyles.table_border_radius, }}>
                              {Object.entries(QUOTATION_STATUS_OPTIONS).map(([main, subs]) => (
                                <SelectGroup key={main}>
                                  <SelectItem value={main} className="text-[10px] uppercase font-semibold">{main}</SelectItem>
                                  {subs.map((sub) => (
                                    <SelectItem key={sub} value={`${main}__${sub}`} className="text-[10px] pl-8">{sub}</SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span style={{ color: tableStyles.td_text }}>{displayValue(item.quotation_status)}</span>
                        )}
                      </TableCell>
                      <TableCell style={tdStyle}>{displayValue(item.quotation_status_sub)}</TableCell>
                      <TableCell style={tdStyle}>{displayValue(item.contact_number)}</TableCell>
                      <TableCell style={tdStyle}>
                        <Badge variant="secondary"
                          className="font-normal text-[10px] uppercase tracking-wider bg-zinc-100 text-zinc-600"
                          style={{
                            borderRadius: `${tableStyles.table_border_radius}px`,
                          }}>
                          {displayValue(item.type_client)}
                        </Badge>
                      </TableCell>
                      <TableCell style={tdStyle}>{displayValue(item.project_name)}</TableCell>
                      <TableCell style={tdStyle}>{displayValue(item.project_type)}</TableCell>
                      <TableCell style={tdStyle}>{displayValue(item.source)}</TableCell>
                      <TableCell style={tdStyle}>{displayValue(item.target_quota)}</TableCell>
                      <TableCell style={tdStyle}>{displayValue(item.type_activity)}</TableCell>
                      <TableCell style={tdStyle}>
                        {item.callback ? `${new Date(item.callback).toLocaleDateString()} ${formatTimeWithAmPm(item.callback.substring(11, 16))}` : "-"}
                      </TableCell>
                      <TableCell style={tdStyle}>
                        {item.type_activity === "Outbound Calls" ? (
                          <Select value={item.call_status || ""} onValueChange={(val) => handleInlineUpdate(item.id, "call_status", val)}>
                            <SelectTrigger className="h-7 text-[10px] w-[110px] rounded-none border-zinc-200 bg-white hover:bg-zinc-50">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="Successful" className="text-[10px]">Successful</SelectItem>
                                <SelectItem value="Unsuccessful" className="text-[10px]">Unsuccessful</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        ) : displayValue(item.call_status)}
                      </TableCell>
                      <TableCell style={tdStyle}>{displayValue(item.call_type)}</TableCell>
                      <TableCell style={tdStyle}>
                        {item.quotation_amount != null ? item.quotation_amount.toLocaleString("en-PH", { style: "currency", currency: "PHP" }) : "-"}
                      </TableCell>
                      <TableCell style={tdStyle}>
                        <div className="flex items-center gap-1">
                          {displayValue(item.so_number)}
                          {item.so_number && item.status === "Quote-Done" && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium bg-blue-100 text-blue-800">AUTO</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell style={tdStyle}>
                        {item.so_amount != null ? item.so_amount.toLocaleString("en-PH", { style: "currency", currency: "PHP" }) : "-"}
                      </TableCell>
                      <TableCell style={tdStyle}>
                        {item.actual_sales != null ? item.actual_sales.toLocaleString("en-PH", { style: "currency", currency: "PHP" }) : "-"}
                      </TableCell>
                      <TableCell style={tdStyle}>{item.delivery_date ? new Date(item.delivery_date).toLocaleDateString() : "-"}</TableCell>
                      <TableCell style={tdStyle}>
                        <div className="flex items-center gap-1">
                          {displayValue(item.dr_number)}
                          {item.dr_number && item.status === "SO-Done" && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium bg-green-100 text-green-800">AUTO</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell style={tdStyle}>{displayValue(item.ticket_reference_number)}</TableCell>
                      <TableCell style={tdStyle}>
                        <span className="block truncate max-w-[180px]" title={item.remarks ?? ""}>{displayValue(item.remarks)}</span>
                      </TableCell>
                      <TableCell style={tdStyle}>
                        {item.date_followup && !isNaN(new Date(item.date_followup).getTime()) ? new Date(item.date_followup).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell style={tdStyle}>{displayValue(item.payment_terms)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

              <tfoot>
                <TableRow style={{ backgroundColor: tableStyles.tfoot_bg, borderColor: tableStyles.tfoot_border }}>
                  <TableCell
                    colSpan={29}
                    className="uppercase tracking-wider"
                    style={{ color: tableStyles.tfoot_text, fontSize: `${tableStyles.tfoot_font_size}px`, padding: `${tableStyles.tfoot_padding}px 12px` }}
                  >
                    {totalCount} record{totalCount !== 1 ? "s" : ""} total
                  </TableCell>
                </TableRow>
              </tfoot>
            </Table>
          </div>
        )}

        {/* ── Pagination ── */}
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
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 1) fetchActivities(page - 1);
                    }}
                    aria-disabled={page === 1}
                    className={`text-[10px] border font-bold uppercase tracking-widest transition-all ${page === 1 ? "pointer-events-none opacity-30" : ""}`}
                    style={{ color: tableStyles.pagination_text, borderColor: tableStyles.pagination_border, borderRadius: tableStyles.pagination_radius }}
                  />
                </PaginationItem>
                <span
                  style={{ color: tableStyles.pagination_text, borderColor: tableStyles.pagination_border, borderRadius: tableStyles.pagination_radius }}
                >
                  {page} / {pageCount}
                </span>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page < pageCount) fetchActivities(page + 1);
                    }}
                    aria-disabled={page === pageCount}
                    className={`text-[10px] border font-bold uppercase tracking-widest transition-all ${page === pageCount ? "pointer-events-none opacity-30" : ""}`}
                    style={{ color: tableStyles.pagination_text, borderColor: tableStyles.pagination_border, borderRadius: tableStyles.pagination_radius }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* ── RE-SO Dialog ── */}
      <Dialog open={reSoOpen} onOpenChange={(v) => { if (!v) { setReSoOpen(false); setIsEditingSo(false); } }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden"
          style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
        >
          <div className="px-6 pt-5 pb-4"
            style={{
              color: tableStyles.th_text,
              backgroundColor: tableStyles.th_bg,
            }}>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-white/10 rounded-full p-1.5"><Undo className="h-4 w-4 text-red-400" /></div>
                <DialogTitle className="text-sm font-bold tracking-wide uppercase">Sales Order Info</DialogTitle>
              </div>
              {reSoItem && <p className="text-zinc-400 text-xs font-mono mt-1">{reSoItem.company_name}</p>}
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">SO Number</label>
              {!isEditingSo ? (
                <div
                  className="border border-zinc-200 px-3 py-2 bg-zinc-50 text-sm font-mono uppercase text-zinc-700">
                  {reSoItem?.so_number || <span className="text-zinc-400 italic normal-case">Not set</span>}
                </div>
              ) : (
                <Input
                  value={editSoNumber}
                  onChange={(e) => setEditSoNumber(e.target.value.toUpperCase())}
                  placeholder="Enter SO Number"
                  className="text-sm"
                  style={{ borderRadius: tableStyles.pagination_radius }}
                  autoFocus />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">SO Amount</label>
              {!isEditingSo ? (
                <div className="border border-zinc-200 px-3 py-2 bg-zinc-50 text-sm font-mono text-zinc-700">
                  {reSoItem?.so_amount != null ? Number(reSoItem.so_amount).toLocaleString("en-PH", { style: "currency", currency: "PHP" }) : <span className="text-zinc-400 italic">Not set</span>}
                </div>
              ) : (
                <Input
                  type="number"
                  value={editSoAmount}
                  onChange={(e) => setEditSoAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Enter SO Amount"
                  className="text-sm"
                  style={{ borderRadius: tableStyles.pagination_radius }}
                />
              )}
            </div>
          </div>
          <div className="px-6 py-4 border-t border-zinc-100 flex gap-2">
            <Button variant="outline" className="flex-1 text-xs h-10" style={{ borderRadius: tableStyles.pagination_radius }}
              onClick={() => { if (isEditingSo) { setIsEditingSo(false); setEditSoNumber(reSoItem?.so_number || ""); setEditSoAmount(reSoItem?.so_amount ?? ""); } else setReSoOpen(false); }}>
              {isEditingSo ? "Cancel" : "Close"}
            </Button>
            {!isEditingSo ? (
              <Button className="flex-1 text-xs h-10 bg-zinc-900 hover:bg-zinc-800" style={{ borderRadius: tableStyles.pagination_radius }}
                onClick={() => { setEditSoNumber(""); setEditSoAmount(""); setIsEditingSo(true); }}>
                Update SO
              </Button>
            ) : (
              <Button className="flex-1 text-xs h-10 bg-zinc-900 hover:bg-zinc-800" style={{ borderRadius: tableStyles.pagination_radius }}
                onClick={handleSaveSo} disabled={!editSoNumber || editSoAmount === "" || savingSo}>
                {savingSo ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      {editOpen && editItem && (
        <TaskListEditDialog
          item={editItem}
          onClose={() => { setEditOpen(false); setEditItem(null); }}
          onSave={() => { fetchActivities(page); setEditOpen(false); setEditItem(null); }}
        />
      )}

      {/* ── Delete Dialog ── */}
      <AccountsActiveDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        removeRemarks={removeRemarks}
        setRemoveRemarks={setRemoveRemarks}
        onConfirmRemove={onConfirmRemove}
        selectedCount={selectedIds.size}
      />
    </>
  );
};
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
      <DialogContent className="sm:max-w-xs rounded-2xl p-0 overflow-hidden gap-0 border-none shadow-2xl">
        <div className="bg-white px-6 pt-6 pb-4 border-b border-zinc-100">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-zinc-100 rounded-full p-2">
                <Lock className="h-4 w-4 text-zinc-900" />
              </div>
              <DialogTitle className="text-zinc-900 text-sm font-bold tracking-tight">
                Authentication Required
              </DialogTitle>
            </div>
            <p className="text-zinc-500 text-xs mt-1">Enter the password to edit timestamp data.</p>
          </DialogHeader>
        </div>
        <div className={`px-6 py-6 space-y-4 ${shake ? "animate-shake" : ""}`}>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <Input
                ref={inputRef}
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                placeholder="Enter password"
                className={`rounded-full h-11 text-sm pr-10 border-zinc-200 bg-zinc-50/50 focus-visible:ring-zinc-200 ${error ? "border-red-400 focus-visible:ring-red-300" : ""}`}
              />
              <button type="button" tabIndex={-1} onClick={() => setShowPw((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <p className="text-[11px] text-red-500 font-medium ml-1">Incorrect password. Please try again.</p>}
          </div>
        </div>
        <div className="px-6 py-5 border-t border-zinc-100 flex gap-3 bg-zinc-50/50">
          <Button variant="ghost" className="rounded-full flex-1 text-xs h-11 font-bold text-zinc-500 hover:bg-zinc-100" onClick={onClose}>Cancel</Button>
          <Button className="rounded-full flex-1 text-xs h-11 bg-zinc-900 hover:bg-zinc-800 font-bold text-white shadow-lg shadow-zinc-200 gap-2"
            onClick={handleSubmit} disabled={!password}>
            <ShieldCheck className="h-4 w-4" />Confirm
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
      <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden gap-0 border-none shadow-2xl">
        <div className="bg-white px-6 pt-6 pb-4 border-b border-zinc-100">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-blue-50 rounded-full p-2"><Clock className="h-4 w-4 text-blue-600" /></div>
              <DialogTitle className="text-zinc-900 text-sm font-bold tracking-tight">Edit Time</DialogTitle>
            </div>
            <p className="text-zinc-500 text-xs font-medium mt-1">{item.company_name}</p>
            {item.type_activity && <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mt-1">{item.type_activity}</p>}
          </DialogHeader>
        </div>
        <div className="px-6 py-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Start Date &amp; Time</label>
            <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-full h-11 text-sm border-zinc-200 bg-zinc-50/50 focus-visible:ring-zinc-200" />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest ml-1">End Date &amp; Time</label>
            <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-full h-11 text-sm border-zinc-200 bg-zinc-50/50 focus-visible:ring-zinc-200" />
          </div>
          {startDate && endDate && (() => {
            const s = new Date(startDate), e = new Date(endDate);
            if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e > s) {
              return (
                <div className="flex items-center gap-2 px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs text-blue-700 font-medium">
                  <Clock className="h-4 w-4 text-blue-400" />
                  <span>Duration: <strong className="text-blue-900 font-bold">{formatDuration(s.toISOString(), e.toISOString())}</strong></span>
                </div>
              );
            }
            return null;
          })()}
          {error && <p className="text-xs text-red-600 font-medium ml-1">{error}</p>}
        </div>
        <div className="px-6 py-5 border-t border-zinc-100 flex gap-3 bg-zinc-50/50">
          <Button variant="ghost" className="rounded-full flex-1 text-xs h-11 font-bold text-zinc-500 hover:bg-zinc-100" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="rounded-full flex-1 text-xs h-11 bg-zinc-900 hover:bg-zinc-800 font-bold text-white shadow-lg shadow-zinc-200" onClick={handleSave} disabled={saving || !startDate || !endDate}>
            {saving ? "Saving..." : "Save Changes"}
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
      url.searchParams.append("referenceid", referenceid.trim());
      url.searchParams.append("page", String(targetPage));
      url.searchParams.append("limit", String(itemsPerPage));
      url.searchParams.append("fields", "id,activity_reference_number,referenceid,tsm,manager,type_client,project_name,product_category,project_type,source,target_quota,type_activity,callback,call_status,call_type,quotation_number,quotation_amount,quotation_status,quotation_status_sub,so_number,so_amount,actual_sales,delivery_date,dr_number,ticket_reference_number,remarks,status,start_date,end_date,date_followup,date_site_visit,date_created,date_updated,company_name,contact_number,contact_person,email_address,payment_terms,scheduled_status");
      
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
      <div className="overflow-hidden border border-zinc-200 rounded-2xl bg-white shadow-sm">

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-4 px-4 py-4 border-b bg-white border-zinc-100">
          {/* Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="bg-zinc-900 rounded-full p-2">
              <ListFilter className="w-4 h-4 text-white" />
            </div>
            <span className="text-[12px] font-bold tracking-tight text-zinc-900">
              Historical Records
            </span>
          </div>

          {/* Search input */}
          <div className="relative flex-1 min-w-[200px] max-w-md flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                placeholder="Search records..."
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

          {/* Edit Time mode badge */}
          {showEditTimeBtn && (
            <span
              className="inline-flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold rounded-full border border-blue-100 bg-blue-50 text-blue-600 shadow-sm"
            >
              <Clock className="w-3.5 h-3.5" />
              Edit Time Mode
            </span>
          )}

          {/* Right side actions */}
          <div className="ml-auto flex items-center gap-3">
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
                className="h-10 px-5 text-[11px] font-bold rounded-full flex items-center gap-2 transition-all bg-red-500 text-white hover:bg-red-600 shadow-sm active:scale-95"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedIds.size})
              </button>
            )}

            {/* Record count */}
            {totalCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 border border-zinc-100 bg-zinc-50/50 text-[10px] font-bold rounded-full text-zinc-500 shadow-sm">
                <span className="border-r border-zinc-200 pr-2">
                  {totalCount} records
                </span>
                <span className="font-mono text-zinc-900">
                  {Math.min((page - 1) * itemsPerPage + 1, totalCount)}–{Math.min(page * itemsPerPage, totalCount)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Quick filter panel ── */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-b bg-zinc-50/30 border-zinc-100">
            {[
              { label: "Status", value: filterStatus, setter: setFilterStatus, options: statusOptions },
              { label: "Activity", value: filterTypeActivity, setter: setFilterTypeActivity, options: typeActivityOptions },
              { label: "Source", value: filterSource, setter: setFilterSource, options: sourceOptions },
              { label: "Client Type", value: filterTypeClient, setter: setFilterTypeClient, options: typeClientOptions },
              { label: "Call Status", value: filterCallStatus, setter: setFilterCallStatus, options: callStatusOptions },
              { label: "Quotation", value: filterQuotationStatus, setter: setFilterQuotationStatus, options: quotationStatusOptions },
            ].map(({ label, value, setter, options }) => (
              <div key={label} className="flex items-center gap-2.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  {label}
                </span>
                <Select value={value} onValueChange={(v) => { setter(v); fetchActivities(1); }}>
                  <SelectTrigger className="rounded-full h-8 text-[10px] border border-zinc-200 focus:ring-0 w-40 font-bold bg-white text-zinc-700 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
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
          <div className="p-4 bg-white">
            <Alert variant="destructive" className="rounded-xl border-red-100 bg-red-50 shadow-sm">
              <AlertCircleIcon className="h-5 w-5 text-red-500" />
              <AlertTitle className="text-sm font-bold text-red-900">Sync Error</AlertTitle>
              <AlertDescription className="text-xs text-red-700">
                Could not retrieve historical data. Please try again.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && activities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white">
            <div className="bg-zinc-50 rounded-full p-4">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-900" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              Retrieving Records...
            </p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && activities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white">
            <div className="bg-zinc-50 rounded-full p-4">
              <CheckCircle2Icon className="h-10 w-10 text-zinc-200" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              No historical records found
            </p>
          </div>
        )}

        {/* ── Table ── */}
        {activities.length > 0 && (
          <div className="overflow-x-auto bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-white border-zinc-100 hover:bg-white">
                  <TableHead className="py-4 px-4 bg-zinc-50/50">
                    <Checkbox
                      checked={allCurrentSelected}
                      onCheckedChange={toggleSelectAll}
                      className="h-4 w-4 rounded-full border-zinc-300 data-[state=checked]:bg-zinc-900 data-[state=checked]:border-zinc-900"
                    />
                  </TableHead>
                  <TableHead className="uppercase font-bold text-zinc-400 text-[10px] tracking-widest py-4 px-4 bg-zinc-50/50">Edit</TableHead>
                  {[
                    "Date", "Quotation #", "Duration", "Company", "Status", "Quotation Status",
                    "Quotation Remarks", "Contact #", "Type Client", "Project Name", "Project Type",
                    "Source", "Target Quota", "Activity Type", "Callback", "Call Status", "Call Type",
                    "Quotation Amount", "SO #", "SO Amount", "Actual Sales", "Delivery Date",
                    "DR #", "Ticket Ref #", "Remarks", "Date Followup", "Payment Terms",
                  ].map((h) => (
                    <TableHead key={h} className="uppercase font-bold text-zinc-400 text-[10px] tracking-widest whitespace-nowrap py-4 px-4 bg-zinc-50/50">{h}</TableHead>
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
                      className={`border-zinc-50 transition-colors ${isSelected ? "bg-zinc-50" : "bg-white hover:bg-zinc-50/30"}`}
                    >
                      <TableCell className="py-4 px-4">
                        <Checkbox
                          className="h-4 w-4 rounded-full border-zinc-300 data-[state=checked]:bg-zinc-900 data-[state=checked]:border-zinc-900"
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(item.id)}
                        />
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            title="Edit"
                            onClick={() => { setEditItem(item); setEditOpen(true); }}
                            className="h-8 w-8 flex items-center justify-center bg-white border border-zinc-200 text-zinc-400 hover:text-zinc-900 hover:border-zinc-900 hover:shadow-sm transition-all rounded-full"
                          >
                            <PenIcon className="h-3.5 w-3.5" />
                          </button>
                          {item.type_activity === "Sales Order Preparation" && (
                            <button
                              title="RE-SO"
                              onClick={() => { setReSoItem(item); setEditSoNumber(item.so_number || ""); setEditSoAmount(item.so_amount ?? ""); setIsEditingSo(false); setReSoOpen(true); }}
                              className="h-8 w-8 flex items-center justify-center bg-white border border-zinc-200 text-zinc-400 hover:text-amber-600 hover:border-amber-600 hover:shadow-sm transition-all rounded-full"
                            >
                              <Undo className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {showEditTimeBtn && (
                            <button
                              title="Edit Timestamp"
                              onClick={() => handleEditTimeClick(item)}
                              className="h-8 w-8 flex items-center justify-center bg-white border border-zinc-200 text-zinc-400 hover:text-blue-600 hover:border-blue-600 hover:shadow-sm transition-all rounded-full"
                            >
                              <Clock className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">
                        {new Date(item.date_updated ?? item.date_created).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">{displayValue(item.quotation_number)}</TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">{formatDuration(item.start_date, item.end_date)}</TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-900 font-bold tracking-tight">{item.company_name}</TableCell>
                      <TableCell className="py-4 px-4 text-xs">
                        {item.status && (
                          <Badge variant="outline"
                            className={`text-[10px] font-bold px-3 py-1 border rounded-full shadow-sm ${item.status === "Delivered" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                              item.status === "Quote-Done" ? "bg-blue-50 text-blue-600 border-blue-100" :
                                item.status === "SO-Done" ? "bg-amber-50 text-amber-600 border-amber-100" :
                                  item.status === "On Progress" || item.status === "Assisted" ? "bg-orange-50 text-orange-600 border-orange-100" :
                                    item.status === "Cancelled" ? "bg-red-50 text-red-600 border-red-100" :
                                      "bg-zinc-50 text-zinc-500 border-zinc-200"
                              }`}>
                            {item.status.replace("-", " ")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-4 text-xs">
                        {item.status === "Quote-Done" ? (
                          <Select
                            value={`${item.quotation_status || ""}__${item.quotation_status_sub || ""}`}
                            onValueChange={(val) => { const [main, sub] = val.split("__"); handleQuotationStatusUpdate(item.id, main, sub || ""); }}
                          >
                            <SelectTrigger className="h-8 text-[10px] w-[150px] border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 font-bold rounded-full transition-all">
                              <SelectValue asChild><span>{item.quotation_status || "Select status"}</span></SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {Object.entries(QUOTATION_STATUS_OPTIONS).map(([main, subs]) => (
                                <SelectGroup key={main}>
                                  <SelectItem value={main} className="text-[10px] uppercase font-bold text-zinc-900">{main}</SelectItem>
                                  {subs.map((sub) => (
                                    <SelectItem key={sub} value={`${main}__${sub}`} className="text-[10px] pl-6 text-zinc-500">{sub}</SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-zinc-500 font-medium">{displayValue(item.quotation_status)}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">{displayValue(item.quotation_status_sub)}</TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">{displayValue(item.contact_number)}</TableCell>
                      <TableCell className="py-4 px-4 text-xs">
                        <Badge variant="secondary" className="font-bold text-[10px] px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full border-none">
                          {displayValue(item.type_client)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">{displayValue(item.project_name)}</TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">{displayValue(item.project_type)}</TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">{displayValue(item.source)}</TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">{displayValue(item.target_quota)}</TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">{displayValue(item.type_activity)}</TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">
                        {item.callback ? `${new Date(item.callback).toLocaleDateString()} ${formatTimeWithAmPm(item.callback.substring(11, 16))}` : "-"}
                      </TableCell>
                      <TableCell className="py-4 px-4 text-xs">
                        {item.type_activity === "Outbound Calls" ? (
                          <Select value={item.call_status || ""} onValueChange={(val) => handleInlineUpdate(item.id, "call_status", val)}>
                            <SelectTrigger className="h-8 text-[10px] w-[120px] rounded-full border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 font-bold transition-all">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectGroup>
                                <SelectItem value="Successful" className="text-[10px]">Successful</SelectItem>
                                <SelectItem value="Unsuccessful" className="text-[10px]">Unsuccessful</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        ) : displayValue(item.call_status)}
                      </TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">{displayValue(item.call_type)}</TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">
                        {item.quotation_amount != null ? item.quotation_amount.toLocaleString("en-PH", { style: "currency", currency: "PHP" }) : "-"}
                      </TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">
                        <div className="flex items-center gap-2">
                          {displayValue(item.so_number)}
                          {item.so_number && item.status === "Quote-Done" && (
                            <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 rounded-full">AUTO</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">
                        {item.so_amount != null ? item.so_amount.toLocaleString("en-PH", { style: "currency", currency: "PHP" }) : "-"}
                      </TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">
                        {item.actual_sales != null ? item.actual_sales.toLocaleString("en-PH", { style: "currency", currency: "PHP" }) : "-"}
                      </TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">{item.delivery_date ? new Date(item.delivery_date).toLocaleDateString() : "-"}</TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">
                        <div className="flex items-center gap-2">
                          {displayValue(item.dr_number)}
                          {item.dr_number && item.status === "SO-Done" && (
                            <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-700 rounded-full">AUTO</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">{displayValue(item.ticket_reference_number)}</TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">
                        <span className="block truncate max-w-[200px]" title={item.remarks ?? ""}>{displayValue(item.remarks)}</span>
                      </TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">
                        {item.date_followup && !isNaN(new Date(item.date_followup).getTime()) ? new Date(item.date_followup).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="py-4 px-4 text-xs text-zinc-500 font-medium">{displayValue(item.payment_terms)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

              <tfoot>
                <TableRow className="bg-zinc-50/50 border-t border-zinc-100">
                  <TableCell
                    colSpan={29}
                    className="text-zinc-400 text-[10px] font-bold py-5 px-6 uppercase tracking-widest"
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
          <div className="flex items-center justify-center border-t border-zinc-100 bg-white py-4">
            <Pagination className="text-zinc-600">
              <PaginationContent className="flex items-center gap-4 justify-center">
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); if (page > 1) fetchActivities(page - 1); }}
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
                    onClick={(e) => { e.preventDefault(); if (page < pageCount) fetchActivities(page + 1); }}
                    aria-disabled={page === pageCount}
                    className={`rounded-xl h-9 px-5 text-[11px] font-bold uppercase transition-all border-zinc-200 ${page === pageCount ? "pointer-events-none opacity-30 bg-zinc-50" : "hover:bg-zinc-50 active:scale-95 shadow-sm"}`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* ── RE-SO Dialog ── */}
      <Dialog open={reSoOpen} onOpenChange={(v) => { if (!v) { setReSoOpen(false); setIsEditingSo(false); } }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
          <div className="bg-white px-6 pt-6 pb-4 border-b border-zinc-100">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-amber-50 rounded-full p-2"><Undo className="h-4 w-4 text-amber-600" /></div>
                <DialogTitle className="text-sm font-bold tracking-tight text-zinc-900">Sales Order Info</DialogTitle>
              </div>
              {reSoItem && <p className="text-zinc-500 text-xs font-medium mt-1">{reSoItem.company_name}</p>}
            </DialogHeader>
          </div>
          <div className="px-6 py-6 space-y-5 bg-white">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest ml-1">SO Number</label>
              {!isEditingSo ? (
                <div
                  className="border border-zinc-100 px-4 py-3 bg-zinc-50/50 text-xs font-bold text-zinc-900 rounded-xl">
                  {reSoItem?.so_number || <span className="text-zinc-400 italic font-medium">Not set</span>}
                </div>
              ) : (
                <Input
                  value={editSoNumber}
                  onChange={(e) => setEditSoNumber(e.target.value.toUpperCase())}
                  placeholder="Enter SO Number"
                  className="h-11 text-xs rounded-full border-zinc-200 bg-zinc-50/50 focus-visible:ring-zinc-200"
                  autoFocus />
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest ml-1">SO Amount</label>
              {!isEditingSo ? (
                <div className="border border-zinc-100 px-4 py-3 bg-zinc-50/50 text-xs font-bold text-zinc-900 rounded-xl">
                  {reSoItem?.so_amount != null ? Number(reSoItem.so_amount).toLocaleString("en-PH", { style: "currency", currency: "PHP" }) : <span className="text-zinc-400 italic font-medium">Not set</span>}
                </div>
              ) : (
                <Input
                  type="number"
                  value={editSoAmount}
                  onChange={(e) => setEditSoAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Enter SO Amount"
                  className="h-11 text-xs rounded-full border-zinc-200 bg-zinc-50/50 focus-visible:ring-zinc-200"
                />
              )}
            </div>
          </div>
          <div className="px-6 py-5 border-t border-zinc-100 flex gap-3 bg-zinc-50/50">
            <Button variant="ghost" className="flex-1 text-xs h-11 rounded-full font-bold text-zinc-500 hover:bg-zinc-100"
              onClick={() => { if (isEditingSo) { setIsEditingSo(false); setEditSoNumber(reSoItem?.so_number || ""); setEditSoAmount(reSoItem?.so_amount ?? ""); } else setReSoOpen(false); }}>
              {isEditingSo ? "Cancel" : "Close"}
            </Button>
            {!isEditingSo ? (
              <Button className="flex-1 text-xs h-11 bg-zinc-900 hover:bg-zinc-800 rounded-full font-bold text-white shadow-lg shadow-zinc-200"
                onClick={() => { setEditSoNumber(""); setEditSoAmount(""); setIsEditingSo(true); }}>
                Update SO
              </Button>
            ) : (
              <Button className="flex-1 text-xs h-11 bg-zinc-900 hover:bg-zinc-800 rounded-full font-bold text-white shadow-lg shadow-zinc-200"
                onClick={handleSaveSo} disabled={!editSoNumber || editSoAmount === "" || savingSo}>
                {savingSo ? "Saving..." : "Save Changes"}
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
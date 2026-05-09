"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import {
  CheckCircle2Icon, AlertCircleIcon, CheckCircle2, AlertCircle,
  PhoneOutgoing, PackageCheck, ReceiptText, Activity, ThumbsUp,
  Check, Repeat, MoreVertical, ThumbsDown, Dot, Filter, Calendar,
  Settings, Pen, Search,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sileo } from "sileo";

import { CreateActivityDialog } from "../dialog/create";
import { CancelledDialog } from "../dialog/cancelled";
import { DoneDialog } from "../dialog/done";
import { DeliveredDialog } from "../dialog/delivered";
import { TransferDialog } from "../dialog/transfer";

import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";

// ─── Helpers (outside component — stable) ─────────────────────────────────────

function toLocalDateString(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA");
}

function getStatusStyles(status: string): { badgeClass?: string; bgClass?: string } {
  switch (status) {
    case "Assisted":
    case "On-Progress":
    case "Pending":
      return { badgeClass: "bg-orange-500 text-white", bgClass: "bg-orange-100" };
    case "SO-Done":
      return { badgeClass: "bg-yellow-400 text-white", bgClass: "bg-yellow-100" };
    case "Quote-Done":
      return { badgeClass: "bg-blue-500 text-white", bgClass: "bg-blue-100" };
    case "Delivered":
    case "Done":
    case "Completed":
      return { badgeClass: "bg-green-600 text-white", bgClass: "bg-green-100" };
    case "Cancelled":
      return { badgeClass: "bg-red-600 text-white", bgClass: "bg-red-100" };
    case "Transfer":
      return { badgeClass: "bg-purple-500 text-white", bgClass: "bg-purple-100" };
    default:
      return { badgeClass: "", bgClass: "bg-white" };
  }
}

function getActivityIcon(act: string) {
  const lower = act.toLowerCase();
  if (lower.includes("outbound") || lower.includes("call")) return <PhoneOutgoing size={14} />;
  if (lower.includes("sales order") || lower.includes("so prep")) return <PackageCheck size={14} />;
  if (lower.includes("quotation") || lower.includes("quote")) return <ReceiptText size={14} />;
  return <Activity size={14} />;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ALL_STATUSES = [
  "Assisted", "Quote-Done", "SO-Done", "On-Progress",
  "Delivered", "Done", "Completed", "Cancelled", "Transfer", "Pending",
];

const READ_ONLY_FIELDS = ["activity_reference_number", "company_name"];
const INITIAL_DISPLAY_COUNT = 20;
const LOAD_MORE_COUNT = 10;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SupervisorDetails {
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  profilePicture: string | null;
  signatureImage: string | null;
  contact: string | null;
}

interface ActivityItem {
  id: string;
  referenceid: string;
  target_quota?: string;
  tsm: string;
  manager: string;
  activity_reference_number: string;
  account_reference_number: string;
  ticket_reference_number: string;
  ticket_remarks: string;
  status: string;
  agent: string;
  date_updated: string;
  scheduled_date: string;
  date_created: string;
  company_name: string;
  contact_number: string;
  type_client: string;
  email_address: string;
  address: string;
  contact_person: string;
}

interface HistoryItem {
  id: string;
  activity_reference_number: string;
  callback?: string | null;
  date_followup?: string | null;
  quotation_number?: string | null;
  quotation_amount?: number | null;
  so_number?: string | null;
  so_amount?: number | null;
  call_type?: string;
  ticket_reference_number?: string;
  source?: string;
  call_status?: string;
  tsm_approved_status: string;
  type_activity: string;
  quotation_status: string;
  status?: string;
}

interface AllActivitiesProps {
  referenceid: string;
  target_quota?: string;
  firstname: string;
  lastname: string;
  email: string;
  contact: string;
  tsmname: string;
  tsm: string;
  managername: string;
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
  managerDetails: SupervisorDetails | null;
  tsmDetails: SupervisorDetails | null;
  signature: string | null;
  onCountChange?: (count: number) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const AllActivities: React.FC<AllActivitiesProps> = ({
  referenceid,
  tsm,
  target_quota,
  firstname,
  lastname,
  email,
  contact,
  tsmname,
  managername,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
  tsmDetails,
  managerDetails,
  signature,
  onCountChange,
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // hasFetched: true kapag nag-fetch na at least once for the current filter
  const [hasFetched, setHasFetched] = useState(false);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDoneOpen, setDialogDoneOpen] = useState(false);
  const [dialogDeliveredOpen, setDialogDeliveredOpen] = useState(false);
  const [dialogTransferOpen, setDialogTransferOpen] = useState(false);
  const [dialogRescheduleOpen, setDialogRescheduleOpen] = useState(false);

  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");      // what user types
  const [committedSearch, setCommittedSearch] = useState(""); // what's actually searched
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [rescheduleDate, setRescheduleDate] = useState<string>("");
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  const [viewMode, setViewMode] = useState<"accordion" | "table">("accordion");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editCellValue, setEditCellValue] = useState<string>("");

  // ─── Derived: is there an active filter? ──────────────────────────────────

  const hasActiveFilter = useMemo(
    () => committedSearch.trim().length > 0 || !!dateCreatedFilterRange?.from,
    [committedSearch, dateCreatedFilterRange],
  );

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  const fetchAllData = useCallback(() => {
    if (!referenceid || !hasActiveFilter) {
      // No filter → clear results and don't fetch
      setActivities([]);
      setHistory([]);
      setHasFetched(false);
      return;
    }

    setLoading(true);
    setError(null);

    const url = new URL("/api/activity/tsa/planner/fetch-all", window.location.origin);
    url.searchParams.append("referenceid", referenceid);

    if (dateCreatedFilterRange?.from) {
      url.searchParams.append("from", toLocalDateString(dateCreatedFilterRange.from));
      if (dateCreatedFilterRange.to) {
        url.searchParams.append("to", toLocalDateString(dateCreatedFilterRange.to));
      }
    }

    if (committedSearch.trim()) {
      url.searchParams.append("search", committedSearch.trim());
    }

    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch activities and history");
        return res.json();
      })
      .then((data) => {
        setActivities(data.activities || []);
        setHistory(data.history || []);
        setHasFetched(true);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [referenceid, hasActiveFilter, dateCreatedFilterRange, committedSearch]);

  const fetchAllDataRef = useRef(fetchAllData);
  useEffect(() => { fetchAllDataRef.current = fetchAllData; }, [fetchAllData]);

  // ─── Realtime (only refreshes if filter is active) ────────────────────────

  useEffect(() => {
    if (!referenceid) return;

    // Initial fetch when filter is already active (e.g. parent set a date range)
    if (hasActiveFilter) fetchAllDataRef.current();

    const activityChannel = supabase
      .channel(`all-activity-${referenceid}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "activity",
        filter: `referenceid=eq.${referenceid}`,
      }, () => { if (hasActiveFilter) fetchAllDataRef.current(); })
      .subscribe();

    const historyChannel = supabase
      .channel(`all-history-${referenceid}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "history",
        filter: `referenceid=eq.${referenceid}`,
      }, () => { if (hasActiveFilter) fetchAllDataRef.current(); })
      .subscribe();

    return () => {
      supabase.removeChannel(activityChannel);
      supabase.removeChannel(historyChannel);
    };
  }, [referenceid]); // intentionally only referenceid — realtime setup once

  // Re-fetch when committed search or date range changes
  useEffect(() => {
    fetchAllDataRef.current();
  }, [committedSearch, dateCreatedFilterRange]);

  // Reset display count when filter changes
  useEffect(() => {
    setDisplayCount(INITIAL_DISPLAY_COUNT);
  }, [committedSearch, statusFilter, dateCreatedFilterRange]);

  // ─── Merged + filtered activities ─────────────────────────────────────────

  const mergedActivities = useMemo(() =>
    activities.map((activity) => ({
      ...activity,
      relatedHistoryItems: history.filter(
        (h) => h.activity_reference_number === activity.activity_reference_number,
      ),
    })),
    [activities, history],
  );

  const filteredActivities = useMemo(() => {
    // Always filter if there's search or status filter, even if no date filter
    if (!committedSearch.trim() && !dateCreatedFilterRange?.from && statusFilter === "All") return [];

    return mergedActivities
      .filter((item) => {
        if (statusFilter !== "All" && item.status !== statusFilter) return false;

        // Client-side text search (search is also sent to API for DB filtering,
        // but this handles edge cases with already-loaded data)
        if (committedSearch.trim()) {
          const term = committedSearch.toLowerCase();
          const activityStr = Object.values(item)
            .map((v) => (v != null ? v.toString() : ""))
            .join(" ")
            .toLowerCase();
          const historyStr = item.relatedHistoryItems
            .map((h) => Object.values(h).map((v) => (v != null ? v.toString() : "")).join(" "))
            .join(" ")
            .toLowerCase();
          if (!activityStr.includes(term) && !historyStr.includes(term)) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime());
  }, [mergedActivities, statusFilter, committedSearch, dateCreatedFilterRange]);

  const displayedActivities = useMemo(
    () => filteredActivities.slice(0, displayCount),
    [filteredActivities, displayCount],
  );

  useEffect(() => {
    onCountChange?.(filteredActivities.length);
  }, [filteredActivities, onCountChange]);

  // ─── Search trigger ────────────────────────────────────────────────────────

  const triggerSearch = () => {
    setCommittedSearch(searchInput);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") triggerSearch();
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setCommittedSearch("");
  };

  // ─── Dialog openers ────────────────────────────────────────────────────────

  const openCancelledDialog  = (id: string) => { setSelectedActivityId(id); setDialogOpen(true); };
  const openDoneDialog       = (id: string) => { setSelectedActivityId(id); setDialogDoneOpen(true); };
  const openDeliveredDialog  = (id: string) => { setSelectedActivityId(id); setDialogDeliveredOpen(true); };
  const openTransferDialog   = (id: string) => { setSelectedActivityId(id); setDialogTransferOpen(true); };
  const openRescheduleDialog = (id: string) => { setSelectedActivityId(id); setRescheduleDate(""); setDialogRescheduleOpen(true); };

  // ─── Action handlers ───────────────────────────────────────────────────────

  const handleConfirmCancelled = async (cancellationRemarks: string) => {
    if (!selectedActivityId || !cancellationRemarks) return;
    setUpdatingId(selectedActivityId);
    setDialogOpen(false);
    try {
      const res = await fetch("/api/act-cancelled-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId, cancellation_remarks: cancellationRemarks }),
      });
      const result = await res.json();
      if (!res.ok) {
        sileo.error({ title: "Failed", description: `Failed to update: ${result.error || "Unknown error"}`, duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
        return;
      }
      await fetchAllDataRef.current();
      window.location.reload();
      sileo.success({ title: "Success", description: "Transaction marked as Cancelled.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "An error occurred while updating status.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  const handleConfirmDone = async () => {
    if (!selectedActivityId) return;
    setUpdatingId(selectedActivityId);
    try {
      const res = await fetch("/api/act-update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId }),
      });
      const result = await res.json();
      if (!res.ok) {
        sileo.error({ title: "Failed", description: `Failed to update: ${result.error || "Unknown error"}`, duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
        return;
      }
      setDialogDoneOpen(false);
      await fetchAllDataRef.current();
      window.location.reload();
      sileo.success({ title: "Success", description: "Transaction marked as Done.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "An error occurred while updating status.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  const handleConfirmDelivered = async () => {
    if (!selectedActivityId) return;
    setUpdatingId(selectedActivityId);
    try {
      const res = await fetch("/api/act-update-status-delivered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId }),
      });
      const result = await res.json();
      if (!res.ok) {
        sileo.error({ title: "Failed", description: result.error || "Failed to update", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
        return;
      }
      setDialogDeliveredOpen(false);
      await fetchAllDataRef.current();
      window.location.reload();
      sileo.success({ title: "Success", description: "Transaction marked as Completed.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "An error occurred while updating status.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  const handleConfirmTransfer = async (selectedUserReferenceID: string | undefined) => {
    if (!selectedActivityId || !selectedUserReferenceID) {
      sileo.error({ title: "Failed", description: "Please select a user to transfer to.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }
    setUpdatingId(selectedActivityId);
    setDialogTransferOpen(false);
    try {
      const res = await fetch("/api/act-transfer-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId, newReferenceID: selectedUserReferenceID }),
      });
      const result = await res.json();
      if (!res.ok) {
        sileo.error({ title: "Failed", description: result.error || "Failed to transfer", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
        return;
      }
      await fetchAllDataRef.current();
      sileo.success({ title: "Success", description: "Transaction transferred.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "An error occurred while transferring.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  const handleConfirmReschedule = async () => {
    if (!selectedActivityId || !rescheduleDate) return;

    const selectedDate = new Date(rescheduleDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      sileo.error({ title: "Invalid Date", description: "Cannot reschedule to a past date.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }

    setUpdatingId(selectedActivityId);
    try {
      const res = await fetch("/api/act-reschedule-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId, newScheduledDate: rescheduleDate }),
      });
      const result = await res.json();
      if (!res.ok) {
        sileo.error({ title: "Failed", description: `Failed to reschedule: ${result.error || "Unknown error"}`, duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
        return;
      }
      setDialogRescheduleOpen(false);
      await fetchAllDataRef.current();
      window.location.reload();
      sileo.success({ title: "Success", description: "Activity rescheduled successfully.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "An error occurred while rescheduling.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
      setRescheduleDate("");
    }
  };

  // ─── Inline table edit ─────────────────────────────────────────────────────

  const handleActivityInlineUpdate = async (id: string, field: string, value: string) => {
    if (READ_ONLY_FIELDS.includes(field)) return;
    try {
      const res = await fetch(`/api/activity/tsa/planner/update?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to update");
      }
      sileo.success({ title: "Updated", description: `${field.replace(/_/g, " ")} updated.`, duration: 2000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      fetchAllDataRef.current();
    } catch (err: any) {
      sileo.error({ title: "Update Failed", description: err?.message || "Could not update.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    }
  };

  const startCellEdit = (id: string, field: string, currentValue: string) => {
    if (READ_ONLY_FIELDS.includes(field)) return;
    setEditingCell({ id, field });
    setEditCellValue(currentValue || "");
  };

  const saveCellEdit = () => {
    if (!editingCell) return;
    handleActivityInlineUpdate(editingCell.id, editingCell.field, editCellValue);
    setEditingCell(null);
    setEditCellValue("");
  };

  const cancelCellEdit = () => {
    setEditingCell(null);
    setEditCellValue("");
  };

  // ─── Derived dialog state ──────────────────────────────────────────────────

  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const selectedTicketReferenceNumber = selectedActivity?.ticket_reference_number ?? null;

  // ─── Status label ──────────────────────────────────────────────────────────

  const activeDateLabel = (() => {
    if (!hasActiveFilter) return null;
    if (loading) return "Searching...";
    const total = filteredActivities.length;
    const shown = displayedActivities.length;
    if (total === 0) return "No activities found.";

    const parts: string[] = [];
    if (committedSearch.trim()) parts.push(`"${committedSearch}"`);
    if (dateCreatedFilterRange?.from) {
      const from = toLocalDateString(dateCreatedFilterRange.from);
      const to = dateCreatedFilterRange.to ? toLocalDateString(dateCreatedFilterRange.to) : from;
      parts.push(from === to ? from : `${from} → ${to}`);
    }
    return `Showing ${shown} of ${total} result${total !== 1 ? "s" : ""} ${parts.length ? `for ${parts.join(" · ")}` : ""}`;
  })();

  // ─── Error state ───────────────────────────────────────────────────────────

  if (error) {
    return (
      <Alert variant="destructive" className="flex flex-col space-y-4 p-4 text-xs">
        <div className="flex items-center space-x-3">
          <AlertCircleIcon className="h-6 w-6 text-red-600" />
          <div>
            <AlertTitle>No Data Found or No Network Connection</AlertTitle>
            <AlertDescription className="text-xs">Please check your internet connection or try again later.</AlertDescription>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <CheckCircle2Icon className="h-6 w-6 text-green-600" />
          <div>
            <AlertTitle className="text-black">Add New Data</AlertTitle>
            <AlertDescription className="text-xs">You can start by adding new entries to populate your database.</AlertDescription>
          </div>
        </div>
      </Alert>
    );
  }

  // ─── JSX ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Search bar + filter + settings */}
      <div className="flex items-center gap-2 w-full mb-2">
        <div className="relative grow flex items-center gap-0">
          <Input
            type="search"
            placeholder="Type to search, then press Enter or click Search..."
            className="text-xs rounded-none pr-10"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          {searchInput && (
            <button
              className="absolute right-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleClearSearch}
              title="Clear search"
            >✕</button>
          )}
        </div>

        <Button
          variant="default"
          className="rounded-none whitespace-nowrap"
          onClick={triggerSearch}
          disabled={loading}
        >
          <Search className="w-4 h-4 mr-1" />
          Search
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="whitespace-nowrap rounded-none">
              {statusFilter === "All" ? <Filter /> : statusFilter} Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setStatusFilter("All")}>
              <span className="w-2 h-2 rounded-full bg-gray-400 mr-2" />All
            </DropdownMenuItem>
            {ALL_STATUSES.map((status) => {
              const { badgeClass } = getStatusStyles(status);
              return (
                <DropdownMenuItem key={status} onClick={() => setStatusFilter(status)} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${badgeClass}`} />
                  <span className="capitalize">{status}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" className="whitespace-nowrap rounded-none" onClick={() => setSettingsOpen(true)}>
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {/* Status label */}
      <p className="text-[10px] text-muted-foreground mb-1 px-1 min-h-[16px]">
        {activeDateLabel}
        {viewMode === "table" && hasActiveFilter && (
          <span className="ml-2 inline-flex items-center gap-1 text-blue-600 font-bold uppercase">
            <Pen className="w-2.5 h-2.5" /> Table Edit Mode
          </span>
        )}
      </p>

      {/* ── Empty / idle state ──────────────────────────────────────────────── */}
      {!hasActiveFilter && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center text-muted-foreground select-none">
          <Search className="w-8 h-8 opacity-30" />
          <p className="text-xs font-medium">Type a keyword and click <strong>Search</strong>, or set a date range to load activities.</p>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {hasActiveFilter && loading && (
        <div className="flex justify-center items-center h-40">
          <Spinner className="size-8" />
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {hasActiveFilter && !loading && (
        <>
          {viewMode === "accordion" ? (
            <div className="max-h-[70vh] overflow-auto space-y-8 custom-scrollbar">
              <Accordion type="single" collapsible className="w-full">
                {displayedActivities.length === 0 ? (
                  <p className="text-muted-foreground text-xs px-2">No activities found.</p>
                ) : (
                  displayedActivities.map((item) => {
                    const { badgeClass, bgClass } = getStatusStyles(item.status);

                    const uniqueActivityTypes = Array.from(new Set(
                      item.relatedHistoryItems.map((h) => h.type_activity?.trim() ?? "").filter((v) => v && v !== "-"),
                    ));

                    const tsmStatuses = Array.from(new Set(
                      item.relatedHistoryItems
                        .map((h) => h.tsm_approved_status?.trim().toLowerCase() ?? "")
                        .filter((v) => v && v !== "-" && v !== "pending"),
                    ));

                    return (
                      <AccordionItem key={item.id} value={item.id} className={`w-full border rounded-none shadow-sm mt-2 ${bgClass}`}>
                        <div className="p-2 select-none">
                          <div className="flex justify-between items-center">
                            <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer">
                              {item.company_name}
                            </AccordionTrigger>

                            <div className="flex gap-2 ml-4">
                              <CreateActivityDialog
                                firstname={firstname} lastname={lastname} target_quota={target_quota}
                                email={email} contact={contact} tsmname={tsmname} managername={managername}
                                referenceid={item.referenceid} tsm={item.tsm} manager={item.manager}
                                type_client={item.type_client} contact_number={item.contact_number}
                                email_address={item.email_address} activityReferenceNumber={item.activity_reference_number}
                                ticket_reference_number={item.ticket_reference_number} agent={item.agent}
                                company_name={item.company_name} contact_person={item.contact_person}
                                address={item.address} accountReferenceNumber={item.account_reference_number}
                                onCreated={() => fetchAllDataRef.current()}
                                managerDetails={managerDetails ?? null} tsmDetails={tsmDetails ?? null} signature={signature}
                              />

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button className="cursor-pointer rounded-none">Actions <MoreVertical /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuGroup>
                                    <DropdownMenuItem disabled={updatingId === item.id} onClick={(e) => { e.stopPropagation(); openDeliveredDialog(item.id); }}>
                                      <Check className="mr-2 h-4 w-4 text-green-600" /> Mark as Completed
                                    </DropdownMenuItem>
                                    <DropdownMenuItem disabled={updatingId === item.id} onClick={(e) => { e.stopPropagation(); openRescheduleDialog(item.id); }}>
                                      <Calendar className="mr-2 h-4 w-4 text-blue-600" /> Mark as Rescheduled
                                    </DropdownMenuItem>
                                    <DropdownMenuItem disabled={updatingId === item.id} onClick={(e) => { e.stopPropagation(); openCancelledDialog(item.id); }}>
                                      <AlertCircle className="mr-2 h-4 w-4 text-red-600" /> Cancel
                                    </DropdownMenuItem>
                                    {item.ticket_remarks === "Reassigned" && (
                                      <DropdownMenuItem disabled={updatingId === item.id} onClick={(e) => { e.stopPropagation(); openTransferDialog(item.id); }}>
                                        <Repeat className="mr-2 h-4 w-4 text-blue-600" /> Transfer
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuGroup>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          <div className="ml-1 flex flex-wrap gap-1 uppercase">
                            {!["assisted", "not assisted"].includes(item.status.toLowerCase()) && (
                              <Badge variant="secondary" className={`font-mono rounded-sm shadow-md p-2 border-none text-[10px] ${badgeClass}`}>
                                <CheckCircle2 />
                                {item.status.replace("-", " ")} /
                                {item.relatedHistoryItems.some((h) => h.quotation_status && h.quotation_status !== "-") && (
                                  <span className="uppercase ml-1">
                                    {Array.from(new Set(item.relatedHistoryItems.map((h) => h.quotation_status ?? "-").filter((v) => v !== "-"))).join(", ")}
                                  </span>
                                )}
                              </Badge>
                            )}

                            {uniqueActivityTypes.map((activity) => (
                              <HoverCard key={activity}>
                                <HoverCardTrigger asChild>
                                  <Badge variant="outline" className="flex items-center justify-center w-8 h-8 p-0 cursor-default">
                                    {getActivityIcon(activity)}
                                  </Badge>
                                </HoverCardTrigger>
                                <HoverCardContent side="top" align="center" className="text-xs font-medium px-3 py-2 w-auto">
                                  {activity.toUpperCase()}
                                </HoverCardContent>
                              </HoverCard>
                            ))}

                            {tsmStatuses.length > 0 && (() => {
                              const isDeclined = tsmStatuses.some((s) => s === "decline");
                              return (
                                <HoverCard>
                                  <HoverCardTrigger asChild>
                                    <Badge className={`cursor-default font-mono text-[10px] flex items-center gap-1 ${isDeclined ? "bg-red-600 text-white" : "bg-blue-900 text-white"}`}>
                                      {isDeclined ? <ThumbsDown size={12} /> : <ThumbsUp size={12} />}
                                    </Badge>
                                  </HoverCardTrigger>
                                  <HoverCardContent side="top" align="center" className="text-xs font-medium px-3 py-2 w-auto">
                                    {isDeclined ? "Declined by TSM" : "Approved by TSM"}
                                  </HoverCardContent>
                                </HoverCard>
                              );
                            })()}
                          </div>
                        </div>

                        <AccordionContent className="text-xs px-4 py-2 uppercase">
                          <p><strong>Contact Number:</strong> {item.contact_number || "-"}</p>
                          <p><strong>Contact Person:</strong> {item.contact_person || "-"}</p>
                          <p><strong>Email Address:</strong> {item.email_address || "-"}</p>
                          <p><strong>Address:</strong> {item.address || "-"}</p>
                          <Separator className="mb-2 mt-2" />
                          {item.relatedHistoryItems.length === 0 ? (
                            <p>No quotation or SO history available.</p>
                          ) : (
                            <>
                              {item.relatedHistoryItems.some((h) => h.ticket_reference_number && h.ticket_reference_number !== "-") && (
                                <p><strong>Ticket Reference Number:</strong> <span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.ticket_reference_number ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                              )}
                              {item.relatedHistoryItems.some((h) => h.so_number && h.so_number !== "-") && (
                                <p><strong>Sales Order Number:</strong> <span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.so_number ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                              )}
                              {item.relatedHistoryItems.some((h) => h.quotation_number && h.quotation_number !== "-") && (
                                <p><strong>Quotation Number:</strong> <span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.quotation_number ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                              )}
                              {item.relatedHistoryItems.some((h) => h.call_type && h.call_type !== "-") && (
                                <p><strong>Type:</strong> <span className="uppercase">{item.relatedHistoryItems.map((h) => h.call_type ?? "-").filter((v) => v !== "-").join(", ")}</span></p>
                              )}
                              {item.relatedHistoryItems.some((h) => h.source && h.source !== "-") && (
                                <p><strong>Source:</strong> <span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.source ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                              )}
                              {item.relatedHistoryItems.some((h) => h.quotation_amount != null) && (
                                <p><strong>Total Quotation Amount:</strong> {item.relatedHistoryItems.reduce((t, h) => t + (h.quotation_amount ?? 0), 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</p>
                              )}
                              {item.relatedHistoryItems.some((h) => h.so_amount != null) && (
                                <p><strong>Total SO Amount:</strong> {item.relatedHistoryItems.reduce((t, h) => t + (h.so_amount ?? 0), 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</p>
                              )}
                              <Separator className="mb-2 mt-2" />
                              {item.relatedHistoryItems.some((h) => h.tsm_approved_status && h.tsm_approved_status !== "-") && (
                                <p><strong>TSM Feedback:</strong> <span className="uppercase">{item.relatedHistoryItems.map((h) => h.tsm_approved_status ?? "-").filter((v) => v !== "-").join(", ")}</span></p>
                              )}
                            </>
                          )}
                          <p><strong>Date Scheduled:</strong> {new Date(item.scheduled_date).toLocaleDateString()}</p>
                          <div className="flex items-center gap-1 text-xs font-semibold">
                            <Dot />
                            <span className="text-[10px]">{item.activity_reference_number}</span>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })
                )}
              </Accordion>
            </div>
          ) : (
            // ── Table View ──────────────────────────────────────────────────
            <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="text-xs min-w-[1800px]">
                  <TableHeader className="bg-zinc-50/50">
                    <TableRow className="hover:bg-transparent border-b border-zinc-200">
                      {["Act Ref #", "Company", "Contact Person", "Contact #", "Email", "Address", "Type Client", "Status", "Scheduled Date", "Ticket Ref #", "Ticket Remarks"].map((h) => (
                        <TableHead key={h} className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 whitespace-nowrap py-3 px-3">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedActivities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-10 text-zinc-400">No activities found.</TableCell>
                      </TableRow>
                    ) : (
                      displayedActivities.map((item) => {
                        const isEditing = (field: string) => editingCell?.id === item.id && editingCell?.field === field;

                        const renderCell = (field: string, value: string) => {
                          if (READ_ONLY_FIELDS.includes(field)) {
                            return <span className="font-bold text-zinc-700">{value || "-"}</span>;
                          }
                          if (isEditing(field)) {
                            return (
                              <div className="flex items-center gap-1">
                                <Input
                                  className="h-6 text-xs rounded-none px-1 py-0"
                                  value={editCellValue}
                                  onChange={(e) => setEditCellValue(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") cancelCellEdit(); }}
                                  autoFocus
                                />
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-none" onClick={saveCellEdit}>
                                  <Check className="w-3 h-3 text-green-600" />
                                </Button>
                              </div>
                            );
                          }
                          return (
                            <span
                              className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded-sm border border-transparent hover:border-blue-200 transition-colors"
                              onClick={() => startCellEdit(item.id, field, value)}
                              title="Click to edit"
                            >
                              {value || <span className="text-zinc-300 italic">—</span>}
                            </span>
                          );
                        };

                        return (
                          <TableRow key={item.id} className="hover:bg-zinc-50/50">
                            <TableCell className="px-3 font-mono text-[10px] text-zinc-500">{item.activity_reference_number}</TableCell>
                            <TableCell className="px-3 font-bold text-zinc-800 whitespace-nowrap">{renderCell("company_name", item.company_name)}</TableCell>
                            <TableCell className="px-3">{renderCell("contact_person", item.contact_person)}</TableCell>
                            <TableCell className="px-3">{renderCell("contact_number", item.contact_number)}</TableCell>
                            <TableCell className="px-3">{renderCell("email_address", item.email_address)}</TableCell>
                            <TableCell className="px-3">{renderCell("address", item.address)}</TableCell>
                            <TableCell className="px-3">{renderCell("type_client", item.type_client)}</TableCell>
                            <TableCell className="px-3">
                              <Badge variant="outline" className={`rounded-none text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 border-transparent ${
                                ["Delivered", "Done", "Completed"].includes(item.status) ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : item.status === "Quote-Done" ? "bg-blue-50 text-blue-700 border-blue-100"
                                : item.status === "SO-Done" ? "bg-amber-50 text-amber-700 border-amber-100"
                                : item.status === "Cancelled" ? "bg-red-50 text-red-700 border-red-100"
                                : "bg-orange-50 text-orange-700 border-orange-100"
                              }`}>
                                {item.status.replace("-", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-3 whitespace-nowrap font-mono text-[11px] text-zinc-500">{new Date(item.scheduled_date).toLocaleDateString()}</TableCell>
                            <TableCell className="px-3">{renderCell("ticket_reference_number", item.ticket_reference_number)}</TableCell>
                            <TableCell className="px-3">{renderCell("ticket_remarks", item.ticket_remarks)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Load More */}
          {displayCount < filteredActivities.length && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                onClick={() => setDisplayCount((p) => Math.min(p + LOAD_MORE_COUNT, filteredActivities.length))}
                className="rounded-none text-xs"
              >
                Load More ({filteredActivities.length - displayCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}
      <DoneDialog open={dialogDoneOpen} onOpenChange={setDialogDoneOpen} onConfirm={handleConfirmDone} loading={updatingId !== null} />
      <DeliveredDialog open={dialogDeliveredOpen} onOpenChange={setDialogDeliveredOpen} onConfirm={handleConfirmDelivered} loading={updatingId !== null} />
      <TransferDialog
        open={dialogTransferOpen}
        onOpenChange={setDialogTransferOpen}
        onConfirm={(selectedUser) => handleConfirmTransfer(selectedUser?.ReferenceID)}
        loading={updatingId === selectedActivityId}
        ticketReferenceNumber={selectedTicketReferenceNumber}
        tsm={selectedActivity?.tsm}
        account_reference_number={selectedActivity?.account_reference_number}
      />
      <CancelledDialog open={dialogOpen} onOpenChange={setDialogOpen} onConfirm={handleConfirmCancelled} loading={updatingId !== null} />

      <Dialog open={dialogRescheduleOpen} onOpenChange={setDialogRescheduleOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reschedule Activity</DialogTitle>
            <DialogDescription>Select a new date to reschedule this activity. Past dates are not allowed.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reschedule-date" className="text-right">New Date</Label>
              <Input
                id="reschedule-date"
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                min={toLocalDateString(new Date())}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogRescheduleOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleConfirmReschedule} disabled={!rescheduleDate || updatingId !== null}>
              {updatingId !== null && <Spinner className="size-4 mr-2" />}
              Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-sm rounded-none p-0 overflow-hidden gap-0">
          <div className="bg-zinc-900 px-6 pt-5 pb-4">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-white/10 rounded-full p-1.5">
                  <Settings className="h-4 w-4 text-white" />
                </div>
                <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">Settings</DialogTitle>
              </div>
              <p className="text-zinc-400 text-[11px] mt-1">Configure view and editing preferences.</p>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-5">
            <div className="space-y-3">
              <Label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest block">Layout Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setViewMode("accordion"); setSettingsOpen(false); }} className={`flex flex-col items-center gap-2 p-3 border rounded-none transition-colors ${viewMode === "accordion" ? "border-zinc-900 bg-zinc-50 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50"}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Accordion</span>
                </button>
                <button onClick={() => { setViewMode("table"); setSettingsOpen(false); }} className={`flex flex-col items-center gap-2 p-3 border rounded-none transition-colors ${viewMode === "table" ? "border-zinc-900 bg-zinc-50 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50"}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M3 6h18M3 18h18" /></svg>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Table</span>
                </button>
              </div>
            </div>
            {viewMode === "table" && (
              <div className="bg-blue-50 border border-blue-100 p-3 space-y-1">
                <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Table Edit Mode</p>
                <p className="text-[10px] text-blue-600 leading-relaxed">
                  Click any cell to edit it inline. <strong>Activity Reference #</strong> and <strong>Company Name</strong> are read-only.
                  Press <kbd className="px-1 py-0.5 bg-blue-100 border border-blue-200 rounded text-[9px] font-mono">Enter</kbd> to save,{" "}
                  <kbd className="px-1 py-0.5 bg-blue-100 border border-blue-200 rounded text-[9px] font-mono">Esc</kbd> to cancel.
                </p>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-zinc-100 flex gap-2">
            <Button variant="outline" className="rounded-none flex-1 text-xs h-10" onClick={() => setSettingsOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
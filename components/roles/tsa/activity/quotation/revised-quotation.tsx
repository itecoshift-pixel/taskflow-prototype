"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircleIcon,
  PenIcon,
  MoreVertical,
  Loader2,
  Trash2,
  Filter,
  Search,
  LoaderPinwheel
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sileo } from "sileo";

const QUOTATION_STATUS_OPTIONS = {
  "Pending Client Approval": [
    "For Bidding",
    "Nego",
    "Waiting for Approval",
  ],
  "Order Complete": [],
  "Convert to SO": [],
  "Decline": [
    "Loss Price is Too High",
    "Lead Time Issue",
    "Insufficient Stock",
    "Lost Bid",
    "Canvass Only",
    "Did not Meet the Specs",
    "Declined / Dissaproved",
  ],
};

import { TaskListDialog } from "../tasklist/dialog/filter";
import TaskListEditDialog from "./dialog/edit";
import { AccountsActiveDeleteDialog } from "../planner/dialog/delete";

interface SupervisorDetails {
  firstname: string;
  lastname: string;
  email: string;
  profilePicture: string;
  signatureImage: string;
  contact: string;
}

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
  type_activity?: string;
  quotation_number?: string;
  quotation_amount?: number;
  ticket_reference_number?: string;
  remarks?: string;
  status?: string;
  call_status?: string;
  start_date: string;
  end_date: string;
  date_created: string;
  date_updated?: string;
  account_reference_number?: string;
  quotation_type: string;
  company_name: string;
  contact_number: string;
  email_address: string;
  address: string;
  contact_person: string;
  tsm_approved_status: string;
  vat_type: string;
  delivery_fee: string;
  restocking_fee?: string;
  quotation_vatable?: string;
  quotation_subject?: string;
  agent_signature: string;
  agent_contact_number: string;
  agent_email_address: string;
  tsm_signature: string;
  tsm_contact_number: string;
  tsm_email_address: string;
  manager_signature: string;
  manager_contact_number: string;
  manager_email_address: string;
  tsm_approval_date: string;
  manager_approval_date: string;
  tsm_remarks: string;
  manager_remarks: string;
  quotation_status: string;
  quotation_status_sub?: string;
  so_number?: string;
  so_amount?: number;
  dr_number?: string;
  delivery_date?: string;
  discounted_priced?: string;
  discounted_amount?: string;

  // Product data fields
  product_quantity?: string;
  product_amount?: string;
  product_description?: string;
  product_photo?: string;
  product_title?: string;
  product_sku?: string;
  item_remarks?: string;

  // Product flags (serialized as comma-separated values)
  product_is_promo?: string;
  product_is_hidden?: string;
  product_display_mode?: string;

  // Quotation display configuration
  hide_discount_in_preview?: boolean;
  show_discount_columns?: boolean;
  show_summary_discounts?: boolean;
  show_profit_margins?: boolean;
  margin_alert_threshold?: number;
  show_margin_alerts?: boolean;
  product_view_mode?: string;
  visible_columns?: any;
}

interface CompletedProps {
  referenceid: string;
  target_quota?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  contact?: string;
  tsmname?: string;
  managername?: string;
  signature?: string;
  managerDetails?: SupervisorDetails | null;
  tsmDetails?: SupervisorDetails | null;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const displayValue = (v: any) =>
  v === null || v === undefined || String(v).trim() === "" ? "" : String(v);

function formatDuration(start?: string, end?: string) {
  if (!start || !end) return "-";
  const s = new Date(start),
    e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "-";
  let diff = Math.max(0, Math.floor((e.getTime() - s.getTime()) / 1000));
  const h = Math.floor(diff / 3600);
  diff %= 3600;
  const m = Math.floor(diff / 60);
  const sec = diff % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (sec > 0 || parts.length === 0) parts.push(`${sec}s`);
  return parts.join(" ");
}

const MASTER_PASSWORD = "PHDEVTECH";

// ─── Component ────────────────────────────────────────────────────────────────

export const RevisedQuotation: React.FC<CompletedProps> = ({
  referenceid,
  target_quota,
  firstname,
  lastname,
  email,
  contact,
  tsmname,
  managername,
  signature,
  managerDetails: managerDetailsProp,
  tsmDetails: tsmDetailsProp,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}) => {
  const searchParams = useSearchParams();

  const highlightRef = searchParams?.get("highlight") ?? null;
  const openEditRef = searchParams?.get("openEdit") ?? null;
  const actionRef = (searchParams?.get("action") ?? null) as
    | "preview"
    | "download"
    | null;

  const [activities, setActivities] = useState<Completed[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");

  // Set search term if highlight is present
  useEffect(() => {
    if (highlightRef) {
      setSearchTerm(highlightRef);
    }
  }, [highlightRef]);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTypeActivity, setFilterTypeActivity] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterTypeClient, setFilterTypeClient] = useState<string>("all");
  const [filterCallStatus, setFilterCallStatus] = useState<string>("all");
  const [filterQuotationStatus, setFilterQuotationStatus] = useState<string>("all");
  const [itemsPerPage, setItemsPerPage] = useState<number>(10); // Default to 10 items per page
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const [editItem, setEditItem] = useState<Completed | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editAutoAction, setEditAutoAction] = useState<
    "preview" | "download" | null
  >(null);

  const autoOpenFiredRef = useRef<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [removeRemarks, setRemoveRemarks] = useState("");

  const [tsmDetails, setTsmDetails] = useState<SupervisorDetails | null>(
    tsmDetailsProp ?? null,
  );
  const [managerDetails, setManagerDetails] =
    useState<SupervisorDetails | null>(managerDetailsProp ?? null);

  const [highlightedArn, setHighlightedArn] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

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
      .then((res) => res.json())
      .then((data) => { if (data?.table_styles) setTableStyles(data.table_styles); })
      .catch(() => { });
  }, []);

  // ── Inline status edit state ─────────────────────────────────────────────
  const [editStatusMode, setEditStatusMode] = useState(false);
  const [pendingStatuses, setPendingStatuses] = useState<Record<number, string>>({});

  // ── Master password dialog ───────────────────────────────────────────────
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  useEffect(() => {
    if (tsmDetailsProp !== undefined) setTsmDetails(tsmDetailsProp);
  }, [tsmDetailsProp]);

  useEffect(() => {
    if (managerDetailsProp !== undefined) setManagerDetails(managerDetailsProp);
  }, [managerDetailsProp]);

  const fetchHierarchy = useCallback(async () => {
    if (!referenceid) return;
    try {
      const response = await fetch(`/api/user?id=${encodeURIComponent(referenceid)}`);
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setTsmDetails(data.tsmDetails ?? null);
      setManagerDetails(data.managerDetails ?? null);
    } catch (e) {
      console.error("Hierarchy fetch error:", e);
    }
  }, [referenceid]);

  useEffect(() => {
    if (!referenceid) return;
    if (managerDetailsProp === undefined || tsmDetailsProp === undefined) {
      fetchHierarchy();
    }
  }, [referenceid, managerDetailsProp, tsmDetailsProp, fetchHierarchy]);

  const fetchActivities = useCallback(async (page: number = 1, loadMore: boolean = false) => {
    if (!referenceid) {
      setActivities([]);
      return;
    }

    // Set appropriate loading state
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const from = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
      : null;
    const to = dateCreatedFilterRange?.to
      ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
      : null;

    try {
      const url = new URL("/api/activity/tsa/quotation/fetch", window.location.origin);
      url.searchParams.append("referenceid", referenceid);
      url.searchParams.append("page", String(page));
      url.searchParams.append("limit", String(itemsPerPage));

      // Add search term if present
      if (searchTerm.trim()) {
        url.searchParams.append("search", searchTerm.trim());
      }

      // Add filters
      if (filterStatus !== "all") url.searchParams.append("status", filterStatus);
      if (filterTypeActivity !== "all") url.searchParams.append("type_activity", filterTypeActivity);
      if (filterSource !== "all") url.searchParams.append("source", filterSource);
      if (filterTypeClient !== "all") url.searchParams.append("type_client", filterTypeClient);
      if (filterCallStatus !== "all") url.searchParams.append("call_status", filterCallStatus);
      if (filterQuotationStatus !== "all") url.searchParams.append("quotation_status", filterQuotationStatus);

      if (from && to) {
        url.searchParams.append("from", from);
        url.searchParams.append("to", to);
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch activities");
      const data = await res.json();

      if (loadMore && page > 1) {
        // Append new data for load more
        setActivities(prev => [...prev, ...(data.activities || [])]);
      } else {
        // Replace data for initial load or new search
        setActivities(data.activities || []);
      }

      // Update pagination info
      setTotalCount(data.totalCount || 0);
      setHasMore(data.hasMore || false);
      setCurrentPage(page);
    } catch (err: any) {
      setError(err.message);
      setActivities([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [referenceid, dateCreatedFilterRange, itemsPerPage, searchTerm, filterStatus, filterTypeActivity, filterSource, filterTypeClient, filterCallStatus, filterQuotationStatus]);

  useEffect(() => {
    if (!referenceid) return;
    fetchActivities(1, false); // Initial load without loadMore
    const channel = supabase
      .channel(`history-${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "history",
          filter: `referenceid=eq.${referenceid}`,
        },
        () => fetchActivities(1, false), // Refresh on changes
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [referenceid, fetchActivities]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    // The fetchActivities will be called by the search/filters change
  }, [searchTerm, filterStatus, filterTypeActivity, filterSource, filterTypeClient, filterCallStatus, filterQuotationStatus, dateCreatedFilterRange, itemsPerPage]);

  // Search handler - only fetches when search button is clicked
  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    fetchActivities(1, false);
  }, [fetchActivities]);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingMore) {
      const nextPage = currentPage + 1;
      fetchActivities(nextPage, true);
    }
  }, [currentPage, hasMore, loadingMore, fetchActivities]);

  // ── Highlight + scroll ───────────────────────────────────────────────────
  useEffect(() => {
    if (!highlightRef) return;
    setHighlightedArn(highlightRef);
    const t1 = setTimeout(() => {
      // Find row by either activity_reference_number OR quotation_number
      const targetRow = rowRefs.current.get(highlightRef);
      if (targetRow) {
        targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 200);
    const t2 = setTimeout(() => setHighlightedArn(null), 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [highlightRef, activities]);

  // ── Auto-open edit dialog ────────────────────────────────────────────────
  useEffect(() => {
    if (!openEditRef || activities.length === 0) return;
    if (autoOpenFiredRef.current === openEditRef) return;

    const target = activities.find(
      (a) => a.activity_reference_number === openEditRef,
    );
    if (!target) return;

    autoOpenFiredRef.current = openEditRef;
    setEditItem(target);
    setEditAutoAction(actionRef);
    setEditOpen(true);
  }, [openEditRef, actionRef, activities]);

  // ── Alt + Ctrl + E  →  toggle inline status-edit mode ───────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.ctrlKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        if (editStatusMode) {
          // Already on — toggle off directly, no password needed
          setEditStatusMode(false);
          setPendingStatuses({});
        } else {
          // Toggle on — require password first
          setPwInput("");
          setPwError(false);
          setPwDialogOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editStatusMode]);

  // ── Save a single row's inline status ───────────────────────────────────
  const saveStatus = async (item: Completed) => {
    const newStatus = pendingStatuses[item.id];
    if (!newStatus || newStatus === item.tsm_approved_status) return;
    try {
      await fetch("/api/act-update-status", { // ← adjust to your real endpoint
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, tsm_approved_status: newStatus }),
      });
      fetchActivities();
    } catch (err) {
      console.error("Status update failed", err);
    }
  };

  // Note: Filtering and sorting now handled by API for better performance
  // activities array contains already filtered and sorted data from the server

  const statusOptions = useMemo(() => {
    const s = new Set<string>();
    activities.forEach((a: Completed) => {
      if (a.status) s.add(a.status);
    });
    return Array.from(s).sort();
  }, [activities]);

  const typeActivityOptions = useMemo(() => {
    const s = new Set<string>();
    activities.forEach((a: Completed) => {
      if (a.type_activity) s.add(a.type_activity);
    });
    return Array.from(s).sort();
  }, [activities]);

  const sourceOptions = useMemo(() => {
    const s = new Set<string>();
    activities.forEach((a: Completed) => {
      if (a.source) s.add(a.source);
    });
    return Array.from(s).sort();
  }, [activities]);

  const typeClientOptions = useMemo(() => {
    const s = new Set<string>();
    activities.forEach((a: Completed) => {
      if (a.type_client) s.add(a.type_client);
    });
    return Array.from(s).sort();
  }, [activities]);

  const callStatusOptions = useMemo(() => {
    const s = new Set<string>();
    activities.forEach((a: Completed) => {
      if (a.call_status) s.add(a.call_status);
    });
    return Array.from(s).sort();
  }, [activities]);

  const quotationStatusOptions = useMemo(() => {
    const s = new Set<string>();
    activities.forEach((a: Completed) => {
      if (a.quotation_status) s.add(a.quotation_status);
    });
    return Array.from(s).sort();
  }, [activities]);

  const openEditDialog = (item: Completed) => {
    setEditItem(item);
    setEditAutoAction(null);
    setEditOpen(true);
  };
  const closeEditDialog = () => {
    setEditOpen(false);
    setEditItem(null);
    setEditAutoAction(null);
  };
  const onEditSaved = () => {
    fetchActivities();
    closeEditDialog();
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const onConfirmRemove = async () => {
    try {
      const res = await fetch("/api/act-delete-history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          remarks: removeRemarks,
        }),
      });
      if (!res.ok) throw new Error("Failed to delete");

      sileo.success({
        title: "Deleted",
        description: `${selectedIds.size} records removed.`,
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });

      setDeleteDialogOpen(false);
      setSelectedIds(new Set());
      setRemoveRemarks("");
      fetchActivities();
    } catch (e: any) {
      console.error(e);
      sileo.error({
        title: "Delete Failed",
        description: e.message || "Failed to remove records.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  };

  // ── Status Progression Automation ─────────────────────────────────────────────
  const autoUpdateStatus = async (item: Completed, trigger: 'quotation' | 'so' | 'delivery') => {
    try {
      let newStatus: string | null = null;
      let reason = '';

      // Business rules for status progression
      switch (trigger) {
        case 'quotation':
          if (item.quotation_status === 'Convert to SO' && item.quotation_number && item.quotation_amount) {
            newStatus = 'Quote-Done';
            reason = 'Quotation marked for SO conversion';
          }
          break;

        case 'so':
          if (item.so_number && item.so_amount && item.status === 'Quote-Done') {
            newStatus = 'SO-Done';
            reason = 'Sales Order created';
          }
          break;

        case 'delivery':
          if (item.dr_number && item.delivery_date && item.status === 'SO-Done') {
            newStatus = 'Delivered';
            reason = 'Delivery recorded';
          }
          break;
      }

      if (newStatus && newStatus !== item.status) {
        const res = await fetch('/api/activity/tsa/historical/auto-update-status', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Protection': '1'
          },
          body: JSON.stringify({
            id: item.id,
            newStatus,
            previousStatus: item.status,
            trigger,
            reason,
            autoUpdate: true
          })
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData?.error || 'Failed to auto-update status');
        }

        // Show notification for auto-update
        sileo.success({
          title: 'Status Auto-Updated',
          description: `${item.company_name} status changed to ${newStatus.replace('-', ' ')}`,
          duration: 3000,
          position: 'top-right',
          fill: 'black',
          styles: { title: 'text-white!', description: 'text-white' },
        });

        // Refresh data
        fetchActivities();
      }
    } catch (error: any) {
      console.error('Auto status update failed:', error);
      sileo.error({
        title: 'Auto-Update Failed',
        description: error?.message || 'Could not auto-update status',
        duration: 3000,
        position: 'top-right',
        fill: 'black',
        styles: { title: 'text-white!', description: 'text-white' },
      });
    }
  };

  const handleQuotationStatusUpdate = async (id: number, main: string, sub: string) => {
    // Input validation
    if (!id || !main?.trim()) {
      sileo.error({
        title: "Invalid Request",
        description: "Missing required parameters.",
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      return;
    }

    try {
      const res = await fetch("/api/activity/tsa/historical/update-quotation-status", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1"
        },
        body: JSON.stringify({
          id,
          quotation_status: main.trim(),
          quotation_status_sub: sub?.trim() || ""
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || "Failed to update");
      }

      // Find the updated item to trigger automation
      const updatedItem = activities.find(item => item.id === id);
      if (updatedItem) {
        // Create updated item object
        const itemWithNewStatus = { ...updatedItem, quotation_status: main.trim() };

        // Trigger status progression automation
        await autoUpdateStatus(itemWithNewStatus, 'quotation');
      }

      sileo.success({
        title: "Updated",
        description: `Quotation status updated successfully.`,
        duration: 2000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      fetchActivities();
    } catch (error: any) {
      console.error("Quotation status update failed:", error);
      sileo.error({
        title: "Update Failed",
        description: error?.message || "Could not update the quotation status.",
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  };

  return (
    <>
      <style>{`
        @keyframes rq-highlight-pulse {
          0%   { background-color: rgb(254 249 195); }
          50%  { background-color: rgb(253 224 71);  }
          100% { background-color: rgb(254 249 195); }
        }
        .rq-highlight-row {
          animation: rq-highlight-pulse 0.8s ease-in-out 3;
          outline: 2px solid rgb(234 179 8);
          outline-offset: -2px;
        }
        .status-edit-mode-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #eff6ff;
          border: 1px solid #93c5fd;
          color: #1d4ed8;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      `}</style>

      <div className="mb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative max-w-md w-full flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              type="text"
              placeholder="Search company, reference ID, or quotation #..."
              className="pl-9 h-10 rounded-none border-zinc-200 focus:ring-0 focus:border-zinc-400 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={loading}
            className="h-10 px-4 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Search"
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {editStatusMode && (
            <span className="status-edit-mode-badge shadow-sm">
              <PenIcon className="w-3 h-3" />
              Status Edit Mode
            </span>
          )}

          <div className="flex items-center gap-1.5 border border-zinc-200 p-1 bg-white">
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
              setCurrentPage={setCurrentPage}
            />
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                className="h-8 flex items-center gap-1.5 px-3 rounded-none bg-red-600 hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Delete ({selectedIds.size})</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-none border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="space-y-1">
              <AlertTitle className="text-sm font-bold text-red-900">Sync Error</AlertTitle>
              <AlertDescription className="text-xs text-red-700 leading-relaxed">
                We couldn't retrieve the latest activity data. Please check your network connection or try refreshing the page.
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {loading && activities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-60">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">Retrieving Quotations...</p>
        </div>
      )}

      {!loading && activities.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-zinc-50/50 border border-dashed border-zinc-200">
          <AlertCircleIcon className="h-8 w-8 text-zinc-300" />
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-500">No records found</p>
            <p className="text-[11px] text-zinc-400">Try adjusting your filters or search terms.</p>
          </div>
        </div>
      )}

      {activities.length > 0 && (
        <div
          className="overflow-x-auto border"
          style={{
            borderColor: tableStyles.table_border,
            borderRadius: `${tableStyles.table_border_radius}px`,
            backgroundColor: tableStyles.table_bg,
          }}
        >
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.th_bg, color: tableStyles.th_text, }}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest">Quotation History</span>
              <Badge variant="outline" className="rounded-none bg-white text-[10px] font-mono">
                {activities.length}
              </Badge>
              {totalCount > activities.length && (
                <span className="text-[10px]">
                  Showing {activities.length} of {totalCount} total
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.th_bg }}>
                  <TableHead style={{
                    color: tableStyles.th_text,
                    fontSize: `${tableStyles.th_font_size}px`,
                    padding: `${tableStyles.th_padding}px 12px`,
                    borderColor: tableStyles.th_border,
                    backgroundColor: tableStyles.th_bg,
                  }} className="uppercase font-bold">
                    <Checkbox
                      checked={selectedIds.size === activities.length && activities.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedIds(new Set(activities.map((a: Completed) => a.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      className="rounded-none h-4 w-4"
                    />
                  </TableHead>
                  <TableHead style={{
                    color: tableStyles.th_text,
                    fontSize: `${tableStyles.th_font_size}px`,
                    padding: `${tableStyles.th_padding}px 12px`,
                    borderColor: tableStyles.th_border,
                    backgroundColor: tableStyles.th_bg,
                  }} className="uppercase font-bold">Edit</TableHead>
                  <TableHead style={{
                    color: tableStyles.th_text,
                    fontSize: `${tableStyles.th_font_size}px`,
                    padding: `${tableStyles.th_padding}px 12px`,
                    borderColor: tableStyles.th_border,
                    backgroundColor: tableStyles.th_bg,
                  }} className="uppercase font-bold">Quotation #</TableHead>
                  <TableHead style={{
                    color: tableStyles.th_text,
                    fontSize: `${tableStyles.th_font_size}px`,
                    padding: `${tableStyles.th_padding}px 12px`,
                    borderColor: tableStyles.th_border,
                    backgroundColor: tableStyles.th_bg,
                  }} className="uppercase font-bold">Quotation Status</TableHead>
                  <TableHead style={{
                    color: tableStyles.th_text,
                    fontSize: `${tableStyles.th_font_size}px`,
                    padding: `${tableStyles.th_padding}px 12px`,
                    borderColor: tableStyles.th_border,
                    backgroundColor: tableStyles.th_bg,
                  }} className="uppercase font-bold">Quotation Remarks</TableHead>
                  <TableHead style={{
                    color: tableStyles.th_text,
                    fontSize: `${tableStyles.th_font_size}px`,
                    padding: `${tableStyles.th_padding}px 12px`,
                    borderColor: tableStyles.th_border,
                    backgroundColor: tableStyles.th_bg,
                  }} className="uppercase font-bold">Status</TableHead>
                  <TableHead style={{
                    color: tableStyles.th_text,
                    fontSize: `${tableStyles.th_font_size}px`,
                    padding: `${tableStyles.th_padding}px 12px`,
                    borderColor: tableStyles.th_border,
                    backgroundColor: tableStyles.th_bg,
                  }} className="uppercase font-bold">Duration</TableHead>
                  <TableHead style={{
                    color: tableStyles.th_text,
                    fontSize: `${tableStyles.th_font_size}px`,
                    padding: `${tableStyles.th_padding}px 12px`,
                    borderColor: tableStyles.th_border,
                    backgroundColor: tableStyles.th_bg,
                  }} className="uppercase font-bold">Company</TableHead>
                  <TableHead style={{
                    color: tableStyles.th_text,
                    fontSize: `${tableStyles.th_font_size}px`,
                    padding: `${tableStyles.th_padding}px 12px`,
                    borderColor: tableStyles.th_border,
                    backgroundColor: tableStyles.th_bg,
                  }} className="uppercase font-bold">Timeline</TableHead>
                  <TableHead style={{
                    color: tableStyles.th_text,
                    fontSize: `${tableStyles.th_font_size}px`,
                    padding: `${tableStyles.th_padding}px 12px`,
                    borderColor: tableStyles.th_border,
                    backgroundColor: tableStyles.th_bg,
                  }} className="uppercase font-bold">Feedback / Notes</TableHead>
                  <TableHead style={{
                    color: tableStyles.th_text,
                    fontSize: `${tableStyles.th_font_size}px`,
                    padding: `${tableStyles.th_padding}px 12px`,
                    borderColor: tableStyles.th_border,
                    backgroundColor: tableStyles.th_bg,
                  }} className="uppercase font-bold">Amount</TableHead>
                  <TableHead style={{
                    color: tableStyles.th_text,
                    fontSize: `${tableStyles.th_font_size}px`,
                    padding: `${tableStyles.th_padding}px 12px`,
                    borderColor: tableStyles.th_border,
                    backgroundColor: tableStyles.th_bg,
                  }} className="uppercase font-bold">Updated</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {activities.map((item: Completed) => {
                  const isSelected = selectedIds.has(item.id);
                  const isHighlighted =
                    highlightedArn === item.activity_reference_number ||
                    highlightedArn === item.quotation_number;

                  return (
                    <TableRow
                      key={item.id}
                      ref={(el) => {
                        if (el) {
                          rowRefs.current.set(item.activity_reference_number, el);
                          if (item.quotation_number) rowRefs.current.set(item.quotation_number, el);
                        } else {
                          rowRefs.current.delete(item.activity_reference_number);
                          if (item.quotation_number) rowRefs.current.delete(item.quotation_number);
                        }
                      }}
                      className={`group border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50 transition-colors ${isHighlighted ? "rq-highlight-row" : ""}`}
                      style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.table_bg }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.tr_hover_bg;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.table_bg;
                      }}
                    >
                      <TableCell style={{
                        color: tableStyles.td_text,
                        fontSize: `${tableStyles.td_font_size}px`,
                        padding: `${tableStyles.td_padding}px 12px`,
                        borderColor: tableStyles.td_border,
                      }}>
                        <Checkbox
                          className="rounded-none h-4 w-4"
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(item.id)}
                        />
                      </TableCell>

                      <TableCell style={{
                        color: tableStyles.td_text,
                        fontSize: `${tableStyles.td_font_size}px`,
                        padding: `${tableStyles.td_padding}px 12px`,
                        borderColor: tableStyles.td_border,
                      }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(item)}
                          className="h-8 w-8 p-0 rounded-none hover:bg-blue-50 hover:text-blue-600 border border-zinc-200 transition-all group"
                          title="Edit Quotation"
                        >
                          <PenIcon className="w-3.5 h-3.5 text-zinc-400 group-hover:text-blue-600" />
                        </Button>
                      </TableCell>

                      <TableCell style={{
                        color: tableStyles.td_text,
                        fontSize: `${tableStyles.td_font_size}px`,
                        padding: `${tableStyles.td_padding}px 12px`,
                        borderColor: tableStyles.td_border,
                      }}>
                        {displayValue(item.quotation_number)}
                      </TableCell>

                      <TableCell style={{
                        color: tableStyles.td_text,
                        fontSize: `${tableStyles.td_font_size}px`,
                        padding: `${tableStyles.td_padding}px 12px`,
                        borderColor: tableStyles.td_border,
                      }}>
                        {item.status === "Quote-Done" ? (
                          <Select
                            value={`${item.quotation_status || ""}__${item.quotation_status_sub || ""}`}
                            onValueChange={(val: string) => {
                              const [main, sub] = val.split("__");
                              handleQuotationStatusUpdate(item.id, main, sub || "");
                            }}
                          >
                            <SelectTrigger className="h-7 text-[10px] w-[140px] rounded-none border-zinc-200 bg-white hover:bg-zinc-50 transition-colors font-bold uppercase tracking-tight">
                              <SelectValue asChild><span>{item.quotation_status || 'Select status'}</span></SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-none">
                              {Object.entries(QUOTATION_STATUS_OPTIONS).map(([mainStatus, subStatuses]) => (
                                <SelectGroup key={mainStatus}>
                                  <SelectItem value={mainStatus} className="text-[10px] uppercase font-semibold">
                                    {mainStatus}
                                  </SelectItem>
                                  {subStatuses.map(subStatus => (
                                    <SelectItem key={subStatus} value={`${mainStatus}__${subStatus}`} className="text-[10px] pl-8">
                                      {subStatus}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-zinc-500 font-medium">{displayValue(item.quotation_status)}</span>
                        )}
                      </TableCell>

                      <TableCell style={{
                        color: tableStyles.td_text,
                        fontSize: `${tableStyles.td_font_size}px`,
                        padding: `${tableStyles.td_padding}px 12px`,
                        borderColor: tableStyles.td_border,
                      }}>
                        <div className="flex items-center gap-1">
                          {displayValue(item.quotation_status_sub)}
                          {item.quotation_status === 'Convert to SO' && (
                            "-"
                          )}
                        </div>
                      </TableCell>

                      <TableCell style={{
                        color: tableStyles.td_text,
                        fontSize: `${tableStyles.td_font_size}px`,
                        padding: `${tableStyles.td_padding}px 12px`,
                        borderColor: tableStyles.td_border,
                      }}>
                        {editStatusMode ? (
                          <Input
                            className="h-7 text-[10px] w-28 uppercase font-bold border-blue-200 bg-blue-50/50 focus:ring-0 focus:border-blue-400 rounded-none mx-auto text-center"
                            value={pendingStatuses[item.id] ?? item.tsm_approved_status}
                            onChange={(e) => {
                              const value = e.target.value;
                              setPendingStatuses((prev) => ({ ...prev, [item.id]: value }));
                            }}
                            onBlur={() => saveStatus(item)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              if (e.key === "Escape") {
                                setPendingStatuses((prev) => {
                                  const next = { ...prev };
                                  delete next[item.id];
                                  return next;
                                });
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        ) : (
                          <Badge
                            variant="outline"
                            className={`rounded-none text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 border-transparent
                              ${item.tsm_approved_status === "Approved" || item.tsm_approved_status === "Approved By Sales Head"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : item.tsm_approved_status === "Pending"
                                  ? "bg-orange-50 text-orange-700 border-orange-100"
                                  : item.tsm_approved_status === "Decline"
                                    ? "bg-red-50 text-red-700 border-red-100"
                                    : "bg-zinc-100 text-zinc-600 border-zinc-200"
                              }`}
                          >
                            {item.tsm_approved_status}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell style={{
                        color: tableStyles.td_text,
                        fontSize: `${tableStyles.td_font_size}px`,
                        padding: `${tableStyles.td_padding}px 12px`,
                        borderColor: tableStyles.td_border,
                      }}>
                        {formatDuration(item.start_date, item.end_date)}
                      </TableCell>

                      <TableCell style={{
                        color: tableStyles.td_text,
                        fontSize: `${tableStyles.td_font_size}px`,
                        padding: `${tableStyles.td_padding}px 12px`,
                        borderColor: tableStyles.td_border,
                      }}>
                        {item.company_name}
                      </TableCell>

                      <TableCell style={{
                        color: tableStyles.td_text,
                        fontSize: `${tableStyles.td_font_size}px`,
                        padding: `${tableStyles.td_padding}px 12px`,
                        borderColor: tableStyles.td_border,
                      }}>
                        {item.tsm_approval_date && (
                          <div className="flex items-center gap-1">
                            <span className="text-zinc-400 uppercase font-bold tracking-tighter">TSM:</span>
                            <span>{new Date(item.tsm_approval_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        )}
                        {item.manager_approval_date && (
                          <div className="flex items-center gap-1">
                            <span className="text-zinc-400 uppercase font-bold tracking-tighter">MGR:</span>
                            <span>{new Date(item.manager_approval_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        )}
                        {!item.tsm_approval_date && !item.manager_approval_date && <span className="text-zinc-300 italic">No activity logs</span>}
                      </TableCell>

                      <TableCell style={{
                        color: tableStyles.td_text,
                        fontSize: `${tableStyles.td_font_size}px`,
                        padding: `${tableStyles.td_padding}px 12px`,
                        borderColor: tableStyles.td_border,
                      }}>
                        {item.tsm_remarks || "—"}{item.manager_remarks}
                      </TableCell>

                      <TableCell style={{
                        color: tableStyles.td_text,
                        fontSize: `${tableStyles.td_font_size}px`,
                        padding: `${tableStyles.td_padding}px 12px`,
                        borderColor: tableStyles.td_border,
                      }}>
                        {item.quotation_amount ? (
                          `₱${parseFloat(String(item.quotation_amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        ) : "—"}
                      </TableCell>

                      <TableCell style={{
                        color: tableStyles.td_text,
                        fontSize: `${tableStyles.td_font_size}px`,
                        padding: `${tableStyles.td_padding}px 12px`,
                        borderColor: tableStyles.td_border,
                      }}>
                        {new Date(item.date_updated!).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/50 flex justify-center">
              <Button
                onClick={handleLoadMore}
                disabled={loadingMore}
                variant="outline"
                className="rounded-none text-xs"
              >
                {loadingMore ? (
                  <>
                    <LoaderPinwheel className="animate-spin h-3 w-3" /> Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {editOpen && editItem && (
        <TaskListEditDialog
          item={editItem}
          onClose={closeEditDialog}
          onSave={onEditSaved}
          firstname={firstname}
          lastname={lastname}
          email={email}
          contact={contact}
          tsmname={tsmname}
          managername={managername}
          company={{
            company_name: editItem.company_name,
            contact_number: editItem.contact_number,
            email_address: editItem.email_address,
            address: editItem.address,
            contact_person: editItem.contact_person,
          }}
          vatType={editItem.vat_type}
          deliveryFee={editItem.delivery_fee}
          restockingFee={editItem.restocking_fee ?? ""}
          whtType={editItem.quotation_vatable ?? "none"}
          quotationSubject={editItem.quotation_subject ?? "For Quotation"}
          agentSignature={editItem.agent_signature}
          agentContactNumber={editItem.agent_contact_number}
          agentEmailAddress={editItem.agent_email_address}
          TsmSignature={editItem.tsm_signature}
          TsmEmailAddress={editItem.tsm_email_address}
          TsmContactNumber={editItem.tsm_contact_number}
          ManagerSignature={editItem.manager_signature}
          ManagerContactNumber={editItem.manager_contact_number}
          ManagerEmailAddress={editItem.manager_email_address}
          ApprovedStatus={editItem.tsm_approved_status}
          autoAction={editAutoAction}
        />
      )}

      {/* ── Master Password Dialog ── */}
      {pwDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setPwDialogOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-80 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <PenIcon className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-800">Status Edit — Authorization</h2>
            </div>
            <p className="text-xs text-gray-500">
              Enter the master password to enable inline status editing.
            </p>
            <input
              autoFocus
              type="password"
              placeholder="Master password"
              value={pwInput}
              onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (pwInput === MASTER_PASSWORD) {
                    setEditStatusMode(true);
                    setPwDialogOpen(false);
                  } else {
                    setPwError(true);
                    setPwInput("");
                  }
                }
                if (e.key === "Escape") setPwDialogOpen(false);
              }}
              className={`border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 transition-all ${pwError
                ? "border-red-400 focus:ring-red-200 bg-red-50"
                : "border-gray-300 focus:ring-blue-200"
                }`}
            />
            {pwError && (
              <p className="text-xs text-red-500 -mt-2 flex items-center gap-1">
                <AlertCircleIcon className="w-3 h-3" /> Incorrect password. Try again.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                className="text-xs rounded-lg"
                onClick={() => setPwDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="text-xs rounded-lg"
                onClick={() => {
                  if (pwInput === MASTER_PASSWORD) {
                    setEditStatusMode(true);
                    setPwDialogOpen(false);
                  } else {
                    setPwError(true);
                    setPwInput("");
                  }
                }}
              >
                Unlock
              </Button>
            </div>
          </div>
        </div>
      )}

      <AccountsActiveDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        removeRemarks={removeRemarks}
        setRemoveRemarks={setRemoveRemarks}
        onConfirmRemove={onConfirmRemove}
      />
    </>
  );
};
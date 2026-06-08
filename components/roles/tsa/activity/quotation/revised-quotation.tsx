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
  FileText,
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
import { getTableStyles, DEFAULT_TABLE_STYLES, type TableStyles } from "@/lib/table-styles";

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
import { GenerateSODialog } from "./dialog/generate-so";
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
  delivery_address?: string;
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

  const [tableStyles, setTableStyles] = useState<TableStyles>(DEFAULT_TABLE_STYLES);

  useEffect(() => {
    getTableStyles().then(setTableStyles);
  }, []);

  // ── Inline status edit state ─────────────────────────────────────────────
  const [editStatusMode, setEditStatusMode] = useState(false);
  const [pendingStatuses, setPendingStatuses] = useState<Record<number, string>>({});

  // ── Master password dialog ───────────────────────────────────────────────
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  // ── Generate SO dialog ────────────────────────────────────────────────────
  const [soDialogOpen, setSoDialogOpen] = useState(false);
  const [soQuotationData, setSoQuotationData] = useState<Completed | null>(null);

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

  // Stable ref so the realtime channel isn't rebuilt on every filter change
  const fetchActivitiesRef = useRef(fetchActivities);
  useEffect(() => { fetchActivitiesRef.current = fetchActivities; }, [fetchActivities]);

  useEffect(() => {
    if (!referenceid) return;
    fetchActivitiesRef.current(1, false);
    const channel = supabase
      .channel(`history-${referenceid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `referenceid=eq.${referenceid}` },
        () => fetchActivitiesRef.current(1, false),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // Only depend on referenceid — fetchActivities changes are handled via the ref above
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceid]);

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

  const generateToken = (ref: string, total: string): string => {
  const raw = `${ref}|${total}|TF-SECURE-2024-DS-EC`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

const generateQrDataUrl = async (url: string): Promise<string | null> => {
  try {
    const QRCode = await import("qrcode");
    return await QRCode.toDataURL(url, {
      width: 128,
      margin: 1,
      color: { dark: PRIMARY_CHARCOAL, light: OFF_WHITE },
      errorCorrectionLevel: "H",
    });
  } catch (err) {
    console.error("QR Generation failed", err);
    return null;
  }
};

// Constants for PDF generation
const PRIMARY_CHARCOAL = "#121212";
const OFF_WHITE = "#F9FAFA";

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

        return true; // caller should refresh
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
      `}</style>

      {/* ── Unified table container ── */}
      <div
        className="overflow-hidden border"
        style={{
          borderColor: tableStyles.table_border,
          borderRadius: `${tableStyles.table_border_radius}px`,
        }}
      >

        {/* ── Toolbar ── */}
        <div
          className="flex flex-wrap items-center gap-3 px-3 py-2.5 border-b"
          style={{ backgroundColor: tableStyles.toolbar_bg, borderColor: tableStyles.toolbar_border }}
        >
          {/* Title */}
          <div className="flex items-center gap-2 shrink-0">
            <Search className="w-3.5 h-3.5" style={{ color: tableStyles.toolbar_btn_text }} />
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: tableStyles.toolbar_btn_text }}>
              Quotation History
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
                placeholder="Search company, reference ID, or quotation #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
              style={{
                color: tableStyles.toolbar_btn_text,
                borderColor: tableStyles.toolbar_btn_border,
                backgroundColor: tableStyles.toolbar_btn_bg,
                borderRadius: `${tableStyles.table_border_radius}px`,
              }}
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Search"}
            </button>
          </div>

          {/* Status Edit Mode badge */}
          {editStatusMode && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest border"
              style={{ color: "#1d4ed8", borderColor: "#93c5fd", backgroundColor: "#eff6ff" }}
            >
              <PenIcon className="w-3 h-3" />
              Status Edit Mode
            </span>
          )}

          {/* Right side actions */}
          <div className="ml-auto flex items-center gap-2">
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

            {/* Delete selected */}
            {selectedIds.size > 0 && (
              <button
                className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors bg-red-600 border-red-700 text-white hover:bg-red-700"
                style={{ borderRadius: `${tableStyles.table_border_radius}px` }}
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
                style={{
                  color: tableStyles.toolbar_btn_text,
                  borderColor: tableStyles.toolbar_btn_border,
                  backgroundColor: tableStyles.toolbar_btn_bg,
                  borderRadius: `${tableStyles.table_border_radius}px`,
                }}
              >
                <span className="border-r pr-2" style={{ borderColor: tableStyles.toolbar_btn_border }}>
                  {totalCount} records
                </span>
                <span className="font-mono">
                  {activities.length} shown
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="p-4" style={{ backgroundColor: tableStyles.table_bg }}>
            <Alert variant="destructive" className="rounded-none border-red-200 bg-red-50">
              <AlertCircleIcon className="h-5 w-5 text-red-600" />
              <AlertTitle className="text-sm font-bold text-red-900">Sync Error</AlertTitle>
              <AlertDescription className="text-xs text-red-700">
                Could not retrieve quotation data. Please try again.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && activities.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-20 gap-3"
            style={{ backgroundColor: tableStyles.table_bg }}
          >
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: tableStyles.td_text, opacity: 0.4 }} />
            <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: tableStyles.td_text, opacity: 0.5 }}>
              Retrieving Quotations...
            </p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && activities.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-20 gap-2"
            style={{ backgroundColor: tableStyles.table_bg }}
          >
            <AlertCircleIcon className="h-10 w-10 opacity-20" style={{ color: tableStyles.td_text }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: tableStyles.td_text, opacity: 0.5 }}>
              No quotation records found
            </p>
          </div>
        )}

        {/* ── Table ── */}
        {activities.length > 0 && (
          <div className="overflow-x-auto" style={{ backgroundColor: tableStyles.table_bg }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: tableStyles.th_bg, borderColor: tableStyles.tr_border }}>
                  {/* shared th style helper */}
                  {(() => {
                    const thStyle: React.CSSProperties = {
                      color: tableStyles.th_text,
                      fontSize: `${tableStyles.th_font_size}px`,
                      padding: `${tableStyles.th_padding}px 12px`,
                      borderColor: tableStyles.th_border,
                      backgroundColor: tableStyles.th_bg,
                    };
                    return (
                      <>
                        <TableHead style={thStyle} className="uppercase font-black">
                          <Checkbox
                            checked={selectedIds.size === activities.length && activities.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedIds(new Set(activities.map((a: Completed) => a.id)));
                              } else {
                                setSelectedIds(new Set());
                              }
                            }}
                            className="h-4 w-4"
                            style={{ borderRadius: `${tableStyles.table_border_radius}px` }}
                          />
                        </TableHead>
                        {[
                          "Edit", "Quotation #", "Quotation Status", "Quotation Remarks",
                          "Status", "Duration", "Company", "Timeline",
                          "Feedback / Notes", "Amount", "Updated",
                        ].map((h) => (
                          <TableHead key={h} style={thStyle} className="uppercase font-black whitespace-nowrap">{h}</TableHead>
                        ))}
                      </>
                    );
                  })()}
                </TableRow>
              </TableHeader>

              <TableBody>
                {activities.map((item: Completed) => {
                  const isSelected = selectedIds.has(item.id);
                  const isHighlighted =
                    highlightedArn === item.activity_reference_number ||
                    highlightedArn === item.quotation_number;

                  const tdStyle: React.CSSProperties = {
                    color: tableStyles.td_text,
                    fontSize: `${tableStyles.td_font_size}px`,
                    padding: `${tableStyles.td_padding}px 12px`,
                    borderColor: tableStyles.td_border,
                  };

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
                      className={isHighlighted ? "rq-highlight-row" : ""}
                      style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.table_bg }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.tr_hover_bg; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.table_bg; }}
                    >
                      <TableCell style={tdStyle}>
                        <Checkbox
                          className="h-4 w-4"
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(item.id)}
                          style={{ borderRadius: `${tableStyles.table_border_radius}px` }}
                        />
                      </TableCell>

                      <TableCell style={tdStyle}>
                        <button
                          title="Edit Quotation"
                          onClick={() => openEditDialog(item)}
                          className="h-7 w-7 flex items-center justify-center border transition-colors"
                          style={{
                            borderColor: tableStyles.td_border,
                            color: tableStyles.td_text,
                            borderRadius: `${tableStyles.table_border_radius}px`,
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#eff6ff"; (e.currentTarget as HTMLElement).style.color = "#2563eb"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = tableStyles.td_text; }}
                        >
                          <PenIcon className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>

                      <TableCell style={tdStyle}>{displayValue(item.quotation_number)}</TableCell>

                      <TableCell style={tdStyle}>
                        {item.status === "Quote-Done" ? (
                          <Select
                            value={`${item.quotation_status || ""}__${item.quotation_status_sub || ""}`}
                            onValueChange={(val: string) => {
                              const [main, sub] = val.split("__");
                              handleQuotationStatusUpdate(item.id, main, sub || "");
                            }}
                          >
                            <SelectTrigger
                              className="h-7 text-[10px] w-[140px] font-bold uppercase tracking-tight"
                              style={{ borderRadius: `${tableStyles.table_border_radius}px` }}
                            >
                              <SelectValue asChild><span>{item.quotation_status || "Select status"}</span></SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(QUOTATION_STATUS_OPTIONS).map(([mainStatus, subStatuses]) => (
                                <SelectGroup key={mainStatus}>
                                  <SelectItem value={mainStatus} className="text-[10px] uppercase font-semibold">{mainStatus}</SelectItem>
                                  {subStatuses.map((subStatus) => (
                                    <SelectItem key={subStatus} value={`${mainStatus}__${subStatus}`} className="text-[10px] pl-8">{subStatus}</SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span style={{ color: tableStyles.td_text }}>{displayValue(item.quotation_status)}</span>
                        )}
                      </TableCell>

                      <TableCell style={tdStyle}>
                        <div className="flex items-center gap-1">
                          {displayValue(item.quotation_status_sub)}
                          {item.quotation_status === "Convert to SO" && "—"}
                        </div>
                      </TableCell>

                      <TableCell style={tdStyle}>
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
                                setPendingStatuses((prev) => { const next = { ...prev }; delete next[item.id]; return next; });
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        ) : (
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 border-transparent ${
                              item.tsm_approved_status === "Approved" || item.tsm_approved_status === "Approved By Sales Head"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : item.tsm_approved_status === "Pending"
                                ? "bg-orange-50 text-orange-700 border-orange-100"
                                : item.tsm_approved_status === "Decline"
                                ? "bg-red-50 text-red-700 border-red-100"
                                : "bg-zinc-100 text-zinc-600 border-zinc-200"
                            }`}
                            style={{ borderRadius: `${tableStyles.table_border_radius}px` }}
                          >
                            {item.tsm_approved_status}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell style={tdStyle}>{formatDuration(item.start_date, item.end_date)}</TableCell>

                      <TableCell style={{ ...tdStyle }} className="font-bold">{item.company_name}</TableCell>

                      <TableCell style={tdStyle}>
                        {item.tsm_approval_date && (
                          <div className="flex items-center gap-1">
                            <span className="text-zinc-400 uppercase font-bold tracking-tighter text-[9px]">TSM:</span>
                            <span>{new Date(item.tsm_approval_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</span>
                          </div>
                        )}
                        {item.manager_approval_date && (
                          <div className="flex items-center gap-1">
                            <span className="text-zinc-400 uppercase font-bold tracking-tighter text-[9px]">MGR:</span>
                            <span>{new Date(item.manager_approval_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</span>
                          </div>
                        )}
                        {!item.tsm_approval_date && !item.manager_approval_date && (
                          <span className="text-zinc-300 italic">—</span>
                        )}
                      </TableCell>

                      <TableCell style={tdStyle}>
                        <span className="block truncate max-w-[180px]">
                          {item.tsm_remarks || "—"}{item.manager_remarks ? ` / ${item.manager_remarks}` : ""}
                        </span>
                      </TableCell>

                      <TableCell style={tdStyle}>
                        {item.quotation_amount
                          ? `₱${parseFloat(String(item.quotation_amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "—"}
                      </TableCell>

                      <TableCell style={tdStyle}>
                        {new Date(item.date_updated!).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

              <tfoot>
                <TableRow style={{ backgroundColor: tableStyles.tfoot_bg, borderColor: tableStyles.tfoot_border }}>
                  <TableCell
                    colSpan={12}
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

        {/* ── Load More ── */}
        {hasMore && (
          <div
            className="flex items-center justify-center border-t py-3"
            style={{ backgroundColor: tableStyles.pagination_bg, borderColor: tableStyles.toolbar_border }}
          >
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="h-8 px-4 text-[10px] font-bold uppercase tracking-widest border transition-all disabled:pointer-events-none disabled:opacity-30"
              style={{
                color: tableStyles.pagination_text,
                borderColor: tableStyles.pagination_border,
                borderRadius: `${tableStyles.pagination_radius}px`,
                backgroundColor: "transparent",
              }}
            >
              {loadingMore ? (
                <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Loading...</span>
              ) : (
                "Load More"
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Edit dialog ── */}
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
            <p className="text-xs text-gray-500">Enter the master password to enable inline status editing.</p>
            <input
              autoFocus
              type="password"
              placeholder="Master password"
              value={pwInput}
              onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (pwInput === MASTER_PASSWORD) { setEditStatusMode(true); setPwDialogOpen(false); }
                  else { setPwError(true); setPwInput(""); }
                }
                if (e.key === "Escape") setPwDialogOpen(false);
              }}
              className={`border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 transition-all ${
                pwError ? "border-red-400 focus:ring-red-200 bg-red-50" : "border-gray-300 focus:ring-blue-200"
              }`}
            />
            {pwError && (
              <p className="text-xs text-red-500 -mt-2 flex items-center gap-1">
                <AlertCircleIcon className="w-3 h-3" /> Incorrect password. Try again.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" className="text-xs rounded-lg" onClick={() => setPwDialogOpen(false)}>Cancel</Button>
              <Button
                className="text-xs rounded-lg"
                onClick={() => {
                  if (pwInput === MASTER_PASSWORD) { setEditStatusMode(true); setPwDialogOpen(false); }
                  else { setPwError(true); setPwInput(""); }
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

      {/* ── Generate SO Dialog ── */}
      <GenerateSODialog
        open={soDialogOpen}
        onClose={() => setSoDialogOpen(false)}
        onSaved={fetchActivities}
        quotationData={soQuotationData}
        firstname={firstname}
        lastname={lastname}
        email={email}
        contact={contact}
        tsmname={tsmname}
        managername={managername}
      />
    </>
  );
};
"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertCircleIcon, PlusCircle, PenIcon, XCircle,
    Search, FileText, Loader2, Building2, User, ChevronLeft, ChevronRight,
    RefreshCw,
} from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { RequestDialog } from "../../activity/spf/dialog/request-dialog";
import { RevisionDialog } from "../../activity/spf/dialog/revision-dialog";
import { CollaborationHubRowTrigger } from "@/components/collaboration-row-trigger";
import { CancelledButton } from "./cancelled-button";
import { CancelDialog } from "./cancel-dialog";
import { getTableStyles, DEFAULT_TABLE_STYLES, type TableStyles } from "@/lib/table-styles";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
    id?: string;
    company_name: string;
    contact_person: string;
    contact_number: string;
    address: string;
    delivery_address?: string;
    tin_number?: string;
}

interface SPFRecord {
    id: number;
    spf_number: string;
    customer_name: string;
    contact_person: string;
    contact_number: string;
    registered_address: string;
    delivery_address?: string;
    billing_address?: string;
    collection_address?: string;
    payment_terms?: string;
    warranty?: string;
    delivery_date?: string;
    prepared_by?: string;
    approved_by?: string;
    sales_person?: string;
    start_date?: string;
    end_date?: string;
    special_instructions?: string;
    status?: string;
    item_description?: string;
    item_photo?: string;
    item_qty?: string;
    spf_creation_id?: number;
    tin_no?: string;
    date_updated?: string;
    created_at?: string;
    is_cancelled?: boolean;
}

interface SPFProps {
    referenceid: string;
    tsm?: string;
    manager?: string;
    prepared_by?: string;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status?: string }) => {
    const s = (status || "").toLowerCase();

    // Map status values to display text
    const getDisplayText = (status: string) => {
        const statusMap: Record<string, string> = {
            "pending for procurement": "For Procurement Costing",
            "approved by procurement": "Ready for Quotation",
            "for revision": "Revised by Sales",
            "processed by pd": "Pending for Procurement",
            // else
            "approved": "Approved",
            "pending": "Pending",
            "declined": "Declined",
        };

        return statusMap[s] || status || "—";
    };

    const cls =
        s === "approved" || s === "approved by procurement" ? "bg-emerald-50 text-emerald-700 border-emerald-100"
            : s === "pending" || s === "pending for procurement" ? "bg-amber-50 text-amber-700 border-amber-100"
                : s === "processed by pd" || s === "declined" ? "bg-red-50 text-red-700 border-red-100"
                    : s === "for revision" ? "bg-blue-50 text-blue-700 border-blue-100"
                        : "bg-zinc-100 text-zinc-600 border-zinc-200";

    return (
        <span className={`inline-block text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 border-transparent ${cls} rounded-none`}>
            {getDisplayText(status || "")}
        </span>
    );
};


// ─── Pagination Component ─────────────────────────────────────────────────────

interface PaginationProps {
    total: number;
    current: number;
    perPage: number;
    onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ total, current, perPage, onPageChange }) => {
    const totalPages = Math.ceil(total / perPage);
    return (
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 bg-zinc-50/50">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Showing <span className="text-zinc-900">{total === 0 ? 0 : (current - 1) * perPage + 1}</span>–<span className="text-zinc-900">{Math.min(current * perPage, total)}</span> of <span className="text-zinc-900">{total}</span>
            </div>
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPageChange(current - 1)}
                    disabled={current === 1}
                    className="rounded-none h-8 w-8 p-0 hover:bg-zinc-100 transition-all"
                >
                    <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => Math.abs(p - current) <= 1 || p === 1 || p === totalPages)
                        .map((p, i, arr) => (
                            <React.Fragment key={p}>
                                {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-zinc-300 text-[10px]">•••</span>}
                                <Button
                                    variant={p === current ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => onPageChange(p)}
                                    className={`rounded-none h-8 w-8 p-0 text-[11px] font-bold transition-all ${p === current ? "bg-zinc-900 text-white hover:bg-zinc-800" : "hover:bg-zinc-100"
                                        }`}
                                >
                                    {p}
                                </Button>
                            </React.Fragment>
                        ))}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPageChange(current + 1)}
                    disabled={current === totalPages}
                    className="rounded-none h-8 w-8 p-0 hover:bg-zinc-100 transition-all"
                >
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SPF: React.FC<SPFProps> = ({ referenceid, tsm, manager, prepared_by }) => {
    const searchParams = useSearchParams();
    const highlight = searchParams?.get("highlight");

    const [allActivities, setAllActivities] = useState<SPFRecord[]>([]);
    const [allAccounts, setAllAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [accountsLoading, setAccountsLoading] = useState(false);
    // SPF Records search
    const [searchTerm, setSearchTerm] = useState("");
    const searchTermRef = useRef(searchTerm);

    // Accounts search
    const [accountsSearchTerm, setAccountsSearchTerm] = useState("");
    const accountsSearchTermRef = useRef(accountsSearchTerm);

    // Update refs when search terms change
    useEffect(() => {
        searchTermRef.current = searchTerm;
    }, [searchTerm]);

    useEffect(() => {
        accountsSearchTermRef.current = accountsSearchTerm;
    }, [accountsSearchTerm]);

    // Set search term if highlight is present
    useEffect(() => {
        if (highlight) {
            setSearchTerm(highlight);
        }
    }, [highlight]);

    // SPF Records pagination state
    const [recordsPage, setRecordsPage] = useState(1);
    const [itemsPerPage] = useState(10); // Default to 10 items per page
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    // Accounts pagination state
    const [accountsPage, setAccountsPage] = useState(1);
    const [accountsPerPage] = useState(20); // Initial 20 accounts
    const [accountsLoadMoreCount] = useState(10); // Load 10 more each time
    const [accountsTotalCount, setAccountsTotalCount] = useState(0);
    const [accountsHasMore, setAccountsHasMore] = useState(false);
    const [accountsLoadingMore, setAccountsLoadingMore] = useState(false);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentSPF, setCurrentSPF] = useState<Partial<SPFRecord>>({});
    const [contactDialogOpen, setContactDialogOpen] = useState(false);
    const [contactOptions, setContactOptions] = useState<{ person: string; number: string }[]>([]);
    const [loadingSPF, setLoadingSPF] = useState(false);

    // Revision dialog state
    const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
    const [revisionTargetSpfNumber, setRevisionTargetSpfNumber] = useState<string | null>(null);

    // Cancel dialog state
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelTargetSpfNumber, setCancelTargetSpfNumber] = useState<string | null>(null);
    const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);

    const endTimerRef = useRef<number | null>(null);

    const [tableStyles, setTableStyles] = useState<TableStyles>(DEFAULT_TABLE_STYLES);

    useEffect(() => {
        getTableStyles().then(setTableStyles);
    }, []);

    // ─── Fetch accounts (paginated with search) ────────────────────────

    const fetchAccounts = useCallback(async (page: number = 1, loadMore: boolean = false) => {
        if (!referenceid) return;

        if (loadMore) {
            setAccountsLoadingMore(true);
        } else {
            setAccountsLoading(true);
        }

        try {
            const url = new URL("/api/com-fetch-cluster-account", window.location.origin);
            url.searchParams.append("referenceid", referenceid);
            url.searchParams.append("page", String(page));
            // First page: 20 items, subsequent pages: 10 more
            const limit = page === 1 ? accountsPerPage : accountsLoadMoreCount;
            url.searchParams.append("limit", String(limit));

            // Add search term if present
            if (accountsSearchTermRef.current.trim()) {
                url.searchParams.append("search", accountsSearchTermRef.current.trim());
            }

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error("Failed to fetch accounts");
            const data = await res.json();

            const active = (data.data || []).filter(
                (a: any) => a.status?.toLowerCase() === "active"
            );

            if (loadMore && page > 1) {
                // Append new data for load more
                setAllAccounts(prev => [...prev, ...active]);
            } else {
                // Replace data for initial load or new search
                setAllAccounts(active);
            }

            // Update pagination info
            setAccountsTotalCount(data.totalCount || 0);
            setAccountsHasMore(data.hasMore || false);
            setAccountsPage(page);
        } catch (err) {
            console.error("Accounts fetch error:", err);
            if (!loadMore) setAllAccounts([]);
        } finally {
            setAccountsLoading(false);
            setAccountsLoadingMore(false);
        }
    }, [referenceid, accountsPerPage, accountsLoadMoreCount]);

    useEffect(() => {
        fetchAccounts();
    }, [referenceid, fetchAccounts]);

    // Accounts search handler - only fetches when search button is clicked
    const handleAccountsSearch = useCallback(() => {
        setAccountsPage(1);
        fetchAccounts(1, false);
    }, [fetchAccounts]);

    // Accounts load more handler
    const handleAccountsLoadMore = useCallback(() => {
        if (accountsHasMore && !accountsLoadingMore) {
            const nextPage = accountsPage + 1;
            fetchAccounts(nextPage, true);
        }
    }, [accountsPage, accountsHasMore, accountsLoadingMore, fetchAccounts]);

    // ─── Fetch SPF records (paginated) ─────────────────────────────────────────────

    const fetchActivities = useCallback(async (page: number = 1, loadMore: boolean = false) => {
        if (!referenceid) return;

        // Set appropriate loading state
        if (loadMore) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }
        setError(null);

        try {
            const url = new URL("/api/activity/tsa/spf/fetch", window.location.origin);
            url.searchParams.append("referenceid", referenceid);
            url.searchParams.append("page", String(page));
            url.searchParams.append("limit", String(itemsPerPage));

            // Add search term if present
            if (searchTermRef.current.trim()) {
                url.searchParams.append("search", searchTermRef.current.trim());
            }

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error("Failed to fetch SPF records");
            const data = await res.json();

            // Sort by date_updated descending (most recent first)
            const sortedActivities = (data.activities || []).sort((a: SPFRecord, b: SPFRecord) => {
                const dateA = new Date(a.date_updated || a.created_at || String(a.id)).getTime();
                const dateB = new Date(b.date_updated || b.created_at || String(b.id)).getTime();
                return dateB - dateA; // Descending order
            });

            if (loadMore && page > 1) {
                // Append new data for load more
                setAllActivities(prev => [...prev, ...sortedActivities]);
            } else {
                // Replace data for initial load or new search
                setAllActivities(sortedActivities);
            }

            // Update pagination info
            setTotalCount(data.totalCount || 0);
            setTotalPages(data.totalPages || 0);
            setHasMore(data.hasMore || false);
            setRecordsPage(page);
        } catch (err: any) {
            setError(err.message);
            setAllActivities([]);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [referenceid, itemsPerPage]);

    useEffect(() => {
        fetchActivities();
        const channel = supabase
            .channel(`spf-${referenceid}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'spf', filter: `referenceid=eq.${referenceid}` },
                () => fetchActivities(1, false)
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'spf_creation' },
                () => fetchActivities(1, false)
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [referenceid]);

    // ─── SPF number generator ────────────────────────────────────────────────────

    const generateNextSPF = useCallback(async (): Promise<string> => {
        setLoadingSPF(true);
        try {
            const res = await fetch("/api/activity/tsa/spf/generate");
            const data = await res.json();
            const existing: string[] = data.activities?.map((a: any) => a.spf_number) || [];
            const prefix = "SPF-DSI-";
            const year = new Date().getFullYear().toString().slice(-2);
            const nums = existing
                .filter((s) => s.startsWith(`${prefix}${year}-`))
                .map((s) => parseInt(s.replace(`${prefix}${year}-`, ""), 10))
                .filter((n) => !isNaN(n));
            const next = (nums.length ? Math.max(...nums) : 0) + 1;
            return `${prefix}${year}-${String(next).padStart(4, "0")}`;
        } catch (err) {
            console.error("SPF generate error:", err);
            return `SPF-DSI-${Date.now()}`;
        } finally {
            setLoadingSPF(false);
        }
    }, []);

    // Note: Filtering and pagination now handled by API for better performance
    // allActivities array contains already filtered and paginated data from the server

    // Search handler - only fetches when search button is clicked
    const handleSearch = useCallback(() => {
        setRecordsPage(1);
        fetchActivities(1, false);
    }, [fetchActivities]);

    // Load more handler
    const handleLoadMore = useCallback(() => {
        if (hasMore && !loadingMore) {
            const nextPage = recordsPage + 1;
            fetchActivities(nextPage, true);
        }
    }, [recordsPage, hasMore, loadingMore, fetchActivities]);

    // Reset page when search term changes
    useEffect(() => {
        setRecordsPage(1);
        // The search will be triggered by the search button click
    }, [searchTerm]);

    // ─── Open edit ───────────────────────────────────────────────────────────────

    const openEditDialog = (spf: SPFRecord) => {
        setIsEditMode(true);
        setCurrentSPF(spf);
        setDialogOpen(true);
    };

    // ─── Open create (contact selection first) ──────────────────────────────────

    const openContactSelection = (acc: Account) => {
        const persons = acc.contact_person.split(",").map((p) => p.trim());
        const numbers = acc.contact_number.split(",").map((n) => n.trim());
        const options = persons.map((p, i) => ({
            person: p,
            number: numbers[i] || numbers[0] || "",
        }));
        setContactOptions(options);
        setCurrentSPF({
            customer_name: acc.company_name,
            registered_address: acc.address,
            delivery_address: acc.delivery_address || "",
            prepared_by: prepared_by || "",
            sales_person: prepared_by || "",
            start_date: new Date().toISOString(),
            end_date: new Date().toISOString(),
            tin_no: acc.tin_number || "",
        });
        setIsEditMode(false);
        setContactDialogOpen(true);
    };

    const selectContact = async (person: string, number: string) => {
        setContactDialogOpen(false);
        const spfNumber = await generateNextSPF();
        setCurrentSPF((prev) => ({
            ...prev,
            contact_person: person,
            contact_number: number,
            spf_number: spfNumber,
        }));
        setDialogOpen(true);
        // Live end_date timer
        if (endTimerRef.current) clearInterval(endTimerRef.current);
        endTimerRef.current = window.setInterval(() => {
            const now = new Date().toISOString();
            setCurrentSPF((prev) => ({ ...prev, end_date: now }));
        }, 1000);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        if (endTimerRef.current) { clearInterval(endTimerRef.current); endTimerRef.current = null; }
        setCurrentSPF({});
    };

    // ─── Create / Edit ───────────────────────────────────────────────────────────

    const handleCreateSPF = async (payload?: Partial<SPFRecord>) => {
        const data = payload || currentSPF;
        if (!data.spf_number || !data.customer_name) {
            alert("SPF Number and Customer Name are required");
            return;
        }
        if (endTimerRef.current) { clearInterval(endTimerRef.current); endTimerRef.current = null; }
        const now = new Date().toISOString();
        try {
            const res = await fetch("/api/activity/tsa/spf/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    sales_person: data.prepared_by,
                    start_date: data.start_date || now,
                    end_date: data.end_date || now,
                    referenceid, tsm, manager,
                }),
            });
            if (!res.ok) throw new Error("Failed to create SPF");
            closeDialog();
            fetchActivities();
        } catch (err: any) {
            alert(err.message || "Failed to create SPF");
        }
    };

    const handleEditSPF = async (payload?: Partial<SPFRecord>) => {
        const data = payload || currentSPF;
        if (!data.id) return;
        try {
            const res = await fetch("/api/activity/tsa/spf/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, referenceid, tsm, manager }),
            });
            if (!res.ok) throw new Error("Failed to update SPF");
            closeDialog();
            fetchActivities();
        } catch (err: any) {
            alert(err.message || "Failed to update SPF");
        }
    };


    // ─── Request Revision ──────────────────────────────────────────────────────────

    const openRevisionDialog = (spf_number: string) => {
        setRevisionTargetSpfNumber(spf_number);
        setRevisionDialogOpen(true);
    };

    const closeRevisionDialog = () => {
        setRevisionDialogOpen(false);
        setRevisionTargetSpfNumber(null);
    };

    const openCancelDialog = (spf_number: string, id: number) => {
        setCancelTargetSpfNumber(spf_number);
        setCancelTargetId(id);
        setCancelDialogOpen(true);
    };

    const closeCancelDialog = () => {
        setCancelDialogOpen(false);
        setCancelTargetSpfNumber(null);
        setCancelTargetId(null);
    };

    const handleCancel = async (reason: string, customReason?: string) => {
        if (!cancelTargetId) return;

        try {
            const res = await fetch("/api/activity/tsa/spf/cancel", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: cancelTargetId,
                    is_cancelled_reason: reason,
                    is_cancelled_reason_others_remarks: customReason,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to cancel SPF");
            }

            closeCancelDialog();
            fetchActivities();
        } catch (err: any) {
            alert(err.message || "Failed to cancel SPF");
        }
    };

    const handleRequestRevision = async (spf_number: string, revision_type: string, revision_remarks: string, editedData?: any) => {
        const res = await fetch("/api/activity/tsa/spf/request-revision", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spf_number, revision_type, revision_remarks, edited_data: editedData }),
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || "Failed to request revision");
        }
        return res.json();
    };
    // ─── Render ──────────────────────────────────────────────────────────────────

    if (loading)
        return (
            <div className="flex justify-center items-center h-40">
                <Spinner className="size-8" />
            </div>
        );

    if (error)
        return (
            <Alert variant="destructive" className="flex items-start space-x-3 p-4">
                <AlertCircleIcon className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                    <AlertTitle className="text-sm font-bold">Error Loading SPF Records</AlertTitle>
                    <AlertDescription className="text-sm mt-1">{error}</AlertDescription>
                </div>
            </Alert>
        );

    return (
        <div className="space-y-4">

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">

                {/* ── Accounts panel ──────────────────────────────────────────────── */}
                <div className="col-span-1 overflow-hidden shadow-sm">
                    <div className="flex items-center gap-3 px-4 py-3" style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.th_bg, color: tableStyles.th_text, }}>
                        <Building2 className="w-4 h-4 text-zinc-400" />
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold uppercase tracking-widest">
                                Accounts
                            </h3>
                            <p className="text-[11px]">
                                {allAccounts.filter((acc: Account) => {
                                    if (!accountsSearchTerm.trim()) return true;
                                    const search = accountsSearchTerm.toLowerCase();
                                    return (
                                        acc.company_name?.toLowerCase().includes(search) ||
                                        acc.contact_person?.toLowerCase().includes(search) ||
                                        acc.address?.toLowerCase().includes(search)
                                    );
                                }).length} shown / {accountsTotalCount || allAccounts.length} total accounts
                                {accountsSearchTerm.trim() && " (filtered)"}
                            </p>
                        </div>
                    </div>

                    {/* Accounts Search Bar */}
                    <div className="p-3 border-b border-zinc-100">
                        <div className="relative flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                                <Input
                                    className="pl-7 h-8 text-xs rounded-none border-zinc-200 focus:ring-0 focus:border-zinc-400 transition-all"
                                    placeholder="Search company name..."
                                    value={accountsSearchTerm}
                                    onChange={(e) => setAccountsSearchTerm(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleAccountsSearch();
                                        }
                                    }}
                                />
                            </div>
                            <Button
                                onClick={handleAccountsSearch}
                                disabled={accountsLoading}
                                className="h-8 px-3 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium"
                            >
                                {accountsLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    "Search"
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="overflow-y-auto max-h-[600px] divide-y divide-zinc-100">
                        {accountsLoading ? (
                            <div className="flex items-center justify-center py-12 text-zinc-400">
                                <Loader2 className="w-5 h-5 animate-spin" />
                            </div>
                        ) : allAccounts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-2 px-4">
                                <Building2 className="w-10 h-10 opacity-20" />
                                <p className="text-xs font-semibold text-center">No accounts found</p>
                            </div>
                        ) : (
                            allAccounts
                                .filter((acc: Account) => {
                                    // If searching, only show matching accounts
                                    if (!accountsSearchTerm.trim()) return true;
                                    const search = accountsSearchTerm.toLowerCase();
                                    return (
                                        acc.company_name?.toLowerCase().includes(search) ||
                                        acc.contact_person?.toLowerCase().includes(search) ||
                                        acc.address?.toLowerCase().includes(search)
                                    );
                                })
                                .map((acc: Account, i: number) => (
                                    <div key={acc.id || i} className="p-3 hover:bg-zinc-50 transition-colors">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-xs font-bold text-zinc-800 truncate">
                                                    {acc.company_name}
                                                </h4>
                                                <p className="text-[11px] text-zinc-500 truncate uppercase">
                                                    {acc.contact_person}
                                                </p>
                                            </div>
                                            <Button
                                                size="sm"
                                                className="h-7 rounded-none text-[10px] font-bold uppercase gap-1 px-2 shrink-0 bg-zinc-900 hover:bg-zinc-800"
                                                onClick={() => openContactSelection(acc)}
                                                disabled={loadingSPF}
                                            >
                                                <PlusCircle className="w-3 h-3" /> Create
                                            </Button>
                                        </div>
                                        <p className="text-[10px] text-zinc-400 truncate uppercase">
                                            {acc.address}
                                        </p>
                                    </div>
                                ))
                        )}
                    </div>

                    {/* Accounts Load More Button */}
                    {accountsHasMore && (
                        <div className="px-3 py-3 border-t border-zinc-100 bg-zinc-50/50 flex justify-center">
                            <Button
                                onClick={handleAccountsLoadMore}
                                disabled={accountsLoadingMore}
                                className="h-8 px-4 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium"
                            >
                                {accountsLoadingMore ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                                        Loading...
                                    </>
                                ) : (
                                    "Load More"
                                )}
                            </Button>
                        </div>
                    )}
                </div>

                {/* ── SPF Records table ────────────────────────────────────────────── */}
                <div className="col-span-3 border rounded-none overflow-hidden shadow-sm flex flex-col"
                    style={{
                        borderColor: tableStyles.table_border,
                        borderRadius: `${tableStyles.table_border_radius}px`,
                        backgroundColor: tableStyles.table_bg,
                    }}>
                    <div className="flex items-center gap-3 px-4 py-3" style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.th_bg, color: tableStyles.th_text, }}>
                        <FileText className="w-4 h-4" />
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold uppercase tracking-widest">
                                SPF Records
                            </h3>
                            <p className="text-[11px]">
                                {allActivities.length} records
                                {totalCount > allActivities.length && (
                                    <span className="text-[10px] ml-2">
                                        Showing {allActivities.length} of {totalCount} total
                                    </span>
                                )}
                            </p>
                        </div>
                        {/* SPF Records Search Bar */}
                        <div className="relative flex gap-2 max-w-xs">
                            <div className="relative flex-1">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" />
                                <Input
                                    className="pl-7 h-8 text-xs rounded-none border-zinc-200 focus:ring-0 focus:border-zinc-400 transition-all"
                                    placeholder="Search SPF records..."
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
                                className="h-8 px-3 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium"
                            >
                                {loading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    "Search"
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        {allActivities.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-2">
                                <FileText className="w-12 h-12 opacity-20" />
                                <p className="text-sm font-semibold uppercase tracking-wide">
                                    No SPF records
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.th_bg }}>
                                        {[
                                            "Actions", "Status", "SPF No.", "Customer",
                                            "Contact Person", "Contact No.", "Reg. Address",
                                            "Delivery", "Billing", "Collection",
                                            "Payment", "Warranty", "Delivery Date",
                                            "Prepared By", "Approved By", "Date Modified"
                                        ].map((h) => (
                                            <TableHead key={h} style={{
                                                color: tableStyles.th_text,
                                                fontSize: `${tableStyles.th_font_size}px`,
                                                padding: `${tableStyles.th_padding}px 12px`,
                                                borderColor: tableStyles.th_border,
                                                backgroundColor: tableStyles.th_bg,
                                            }} className="uppercase font-bold">
                                                {h}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allActivities.map((item: SPFRecord, idx: number) => {
                                        const isHighlighted = highlight === item.spf_number;
                                        return (
                                            <TableRow key={item.id}
                                                className={`text-xs ${isHighlighted ? "bg-yellow-50 hover:bg-yellow-100/70 border-l-4 border-l-yellow-500" : (idx % 2 === 0 ? "bg-white" : "bg-zinc-50/30")}`} style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.table_bg }}>
                                                <TableCell style={{
                                                    color: tableStyles.td_text,
                                                    fontSize: `${tableStyles.td_font_size}px`,
                                                    padding: `${tableStyles.td_padding}px 12px`,
                                                    borderColor: tableStyles.td_border,
                                                }}>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            title="Edit"
                                                            onClick={() => openEditDialog(item)}
                                                            disabled={item.is_cancelled}
                                                            className="p-1.5 border border-zinc-200 rounded-none text-zinc-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-zinc-400 disabled:hover:border-zinc-200 disabled:hover:bg-transparent"
                                                        >
                                                            <PenIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                        <CancelledButton 
                                                            onClick={() => openCancelDialog(item.spf_number, item.id)} 
                                                            disabled={item.is_cancelled}
                                                        />
                                                        <button
                                                            title="Request Revision"
                                                            onClick={() => openRevisionDialog(item.spf_number)}
                                                            disabled={item.is_cancelled}
                                                            className="p-1.5 border border-zinc-200 rounded-none text-zinc-400 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-zinc-400 disabled:hover:border-zinc-200 disabled:hover:bg-transparent"
                                                        >
                                                            <RefreshCw className="w-3.5 h-3.5" />
                                                        </button>
                                                        <CollaborationHubRowTrigger
                                                            requestId={String(item.id)}
                                                            spfNumber={item.spf_number}
                                                            chatDocId={item.spf_creation_id}
                                                            status={item.status}
                                                            collectionName="spf_creations"
                                                            title={item.spf_number}
                                                            variant="icon"
                                                            className="p-1.5 border border-zinc-200 rounded-none text-zinc-400 hover:text-[#be2d2d] hover:border-[#be2d2d]/30 hover:bg-[#be2d2d]/10 transition-all h-auto w-auto"
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell style={{
                                                    color: tableStyles.td_text,
                                                    fontSize: `${tableStyles.td_font_size}px`,
                                                    padding: `${tableStyles.td_padding}px 12px`,
                                                    borderColor: tableStyles.td_border,
                                                }}>
                                                    <StatusBadge status={item.status} />
                                                </TableCell>
                                                <TableCell style={{
                                                    color: tableStyles.td_text,
                                                    fontSize: `${tableStyles.td_font_size}px`,
                                                    padding: `${tableStyles.td_padding}px 12px`,
                                                    borderColor: tableStyles.td_border,
                                                }}>{item.spf_number}</TableCell>
                                                <TableCell style={{
                                                    color: tableStyles.td_text,
                                                    fontSize: `${tableStyles.td_font_size}px`,
                                                    padding: `${tableStyles.td_padding}px 12px`,
                                                    borderColor: tableStyles.td_border,
                                                }}>{item.customer_name}</TableCell>
                                                <TableCell style={{
                                                    color: tableStyles.td_text,
                                                    fontSize: `${tableStyles.td_font_size}px`,
                                                    padding: `${tableStyles.td_padding}px 12px`,
                                                    borderColor: tableStyles.td_border,
                                                }}>{item.contact_person}</TableCell>
                                                <TableCell style={{
                                                    color: tableStyles.td_text,
                                                    fontSize: `${tableStyles.td_font_size}px`,
                                                    padding: `${tableStyles.td_padding}px 12px`,
                                                    borderColor: tableStyles.td_border,
                                                }}>{item.contact_number}</TableCell>
                                                <TableCell style={{
                                                    color: tableStyles.td_text,
                                                    fontSize: `${tableStyles.td_font_size}px`,
                                                    padding: `${tableStyles.td_padding}px 12px`,
                                                    borderColor: tableStyles.td_border,
                                                }}>{item.registered_address}</TableCell>
                                                <TableCell style={{
                                                    color: tableStyles.td_text,
                                                    fontSize: `${tableStyles.td_font_size}px`,
                                                    padding: `${tableStyles.td_padding}px 12px`,
                                                    borderColor: tableStyles.td_border,
                                                }}>{item.delivery_address || "—"}</TableCell>
                                                <TableCell style={{
                                                    color: tableStyles.td_text,
                                                    fontSize: `${tableStyles.td_font_size}px`,
                                                    padding: `${tableStyles.td_padding}px 12px`,
                                                    borderColor: tableStyles.td_border,
                                                }}>{item.billing_address || "—"}</TableCell>
                                                <TableCell style={{
                                                    color: tableStyles.td_text,
                                                    fontSize: `${tableStyles.td_font_size}px`,
                                                    padding: `${tableStyles.td_padding}px 12px`,
                                                    borderColor: tableStyles.td_border,
                                                }}>{item.collection_address || "—"}</TableCell>
                                                <TableCell style={{
                                                    color: tableStyles.td_text,
                                                    fontSize: `${tableStyles.td_font_size}px`,
                                                    padding: `${tableStyles.td_padding}px 12px`,
                                                    borderColor: tableStyles.td_border,
                                                }}>{item.payment_terms || "—"}</TableCell>
                                                <TableCell style={{
                                                    color: tableStyles.td_text,
                                                    fontSize: `${tableStyles.td_font_size}px`,
                                                    padding: `${tableStyles.td_padding}px 12px`,
                                                    borderColor: tableStyles.td_border,
                                                }}>{item.warranty || "—"}</TableCell>
                                                <TableCell style={{
                                                    color: tableStyles.td_text,
                                                    fontSize: `${tableStyles.td_font_size}px`,
                                                    padding: `${tableStyles.td_padding}px 12px`,
                                                    borderColor: tableStyles.td_border,
                                                }}>{item.delivery_date || "—"}</TableCell>
                                                <TableCell style={{
                                                    color: tableStyles.td_text,
                                                    fontSize: `${tableStyles.td_font_size}px`,
                                                    padding: `${tableStyles.td_padding}px 12px`,
                                                    borderColor: tableStyles.td_border,
                                                }}>{item.prepared_by || "—"}</TableCell>
                                                <TableCell style={{
                                                    color: tableStyles.td_text,
                                                    fontSize: `${tableStyles.td_font_size}px`,
                                                    padding: `${tableStyles.td_padding}px 12px`,
                                                    borderColor: tableStyles.td_border,
                                                }}>{item.approved_by || "—"}</TableCell>
                                                <TableCell style={{
                                                    color: tableStyles.td_text,
                                                    fontSize: `${tableStyles.td_font_size}px`,
                                                    padding: `${tableStyles.td_padding}px 12px`,
                                                    borderColor: tableStyles.td_border,
                                                }}>
                                                    {item.date_updated
                                                        ? new Date(item.date_updated).toLocaleString("en-PH", {
                                                            timeZone: "Asia/Manila",
                                                            year: "numeric",
                                                            month: "short",
                                                            day: "2-digit",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })
                                                        : "—"}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    {/* Load More Button */}
                    {hasMore && (
                        <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/50 flex justify-center">
                            <Button
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                className="h-9 px-6 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium"
                            >
                                {loadingMore ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Loading...
                                    </>
                                ) : (
                                    "Load More"
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Contact selection dialog ─────────────────────────────────────── */}
            <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
                <DialogContent className="max-w-sm rounded-none p-0 overflow-hidden border border-zinc-200">
                    <div className="bg-zinc-900 px-6 py-4">
                        <DialogTitle className="text-white text-sm font-bold uppercase tracking-widest">
                            Select Contact
                        </DialogTitle>
                        <p className="text-zinc-400 text-xs mt-1.5 font-mono">
                            {currentSPF.customer_name}
                        </p>
                    </div>
                    <div className="px-4 py-3 space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                        {contactOptions.map((c, i) => (
                            <button
                                key={i}
                                onClick={() => selectContact(c.person, c.number)}
                                className="flex items-center w-full gap-3 px-4 py-3 border border-zinc-100 rounded-none hover:bg-zinc-50 hover:border-zinc-200 transition-all text-left"
                            >
                                <div className="w-10 h-10 rounded-none bg-zinc-100 flex items-center justify-center shrink-0">
                                    <User className="w-5 h-5 text-zinc-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-zinc-800 capitalize">{c.person}</p>
                                    <p className="text-[10px] text-zinc-500 font-mono">{c.number}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                    <DialogFooter className="px-6 pb-6 bg-zinc-50/50 border-t border-zinc-100">
                        <Button variant="outline" onClick={() => setContactDialogOpen(false)}
                            className="rounded-none h-9 text-xs uppercase font-bold tracking-wider w-full border-zinc-200">
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Request / Edit dialog ────────────────────────────────────────── */}
            <RequestDialog
                open={dialogOpen}
                onClose={closeDialog}
                isEditMode={isEditMode}
                prepared_by={prepared_by}
                currentSPF={currentSPF}
                setCurrentSPF={setCurrentSPF}
                handleCreateSPF={handleCreateSPF}
                handleEditSPF={handleEditSPF}
                referenceid={referenceid}
            />


            {/* ── Revision dialog ────────────────────────────────────────────────── */}
            <RevisionDialog
                open={revisionDialogOpen}
                onClose={closeRevisionDialog}
                spf_number={revisionTargetSpfNumber}
                onRequestRevision={handleRequestRevision}
            />

            {/* ── Cancel dialog ────────────────────────────────────────────────── */}
            <CancelDialog
                open={cancelDialogOpen}
                onOpenChange={closeCancelDialog}
                spfNumber={cancelTargetSpfNumber || ""}
                spfId={cancelTargetId || undefined}
                onConfirm={handleCancel}
            />
        </div>
    );
};

export default SPF;

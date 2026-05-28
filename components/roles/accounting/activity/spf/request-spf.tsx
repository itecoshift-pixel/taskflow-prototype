"use client";

import React, {
    useEffect,
    useState,
    useCallback,
    useMemo,
    useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertCircleIcon, Search, FileText, Loader2, ChevronLeft, ChevronRight,
    RefreshCw, Eye, Download, Filter, X,
} from "lucide-react";
import { SPFPreviewDialog } from "./dialog/preview-dialog";
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/utils/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

interface SPFProps {
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<
        React.SetStateAction<any>
    >;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status?: string }) => {
    const s = (status || "").toLowerCase();

    const getDisplayText = (status: string) => {
        const statusMap: Record<string, string> = {
            "pending for procurement": "For Procurement Costing",
            "approved by procurement": "Ready for Quotation",
            "for revision": "Revised by Sales",
            "processed by pd": "Pending for Procurement",
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
        <span className={`inline-block text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 border-transparent ${cls} rounded-md`}>
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
                <button
                    onClick={() => onPageChange(current - 1)}
                    disabled={current === 1}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-200 text-[11px] font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => Math.abs(p - current) <= 1 || p === 1 || p === totalPages)
                    .map((p, i, arr) => (
                        <React.Fragment key={p}>
                            {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-zinc-300 text-[10px]">...</span>}
                            <button
                                onClick={() => onPageChange(p)}
                                className={`w-7 h-7 rounded-md text-[11px] font-medium transition-colors ${
                                    current === p
                                        ? "bg-blue-600 text-white border border-blue-600"
                                        : "border border-gray-200 text-gray-500 hover:bg-gray-50"
                                }`}
                            >
                                {p}
                            </button>
                        </React.Fragment>
                    ))}
                <button
                    onClick={() => onPageChange(current + 1)}
                    disabled={current === totalPages}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-200 text-[11px] font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SPF: React.FC<SPFProps> = ({ dateCreatedFilterRange, setDateCreatedFilterRangeAction }) => {
    const searchParams = useSearchParams();
    const highlight = searchParams?.get("highlight");

    const [allActivities, setAllActivities] = useState<SPFRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Preview dialog
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewSPF, setPreviewSPF] = useState<any>(null);

    // Search with debounce
    const [searchInput, setSearchInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [customerFilter, setCustomerFilter] = useState<string>("");
    const [salesPersonFilter, setSalesPersonFilter] = useState<string>("");
    const [showFilters, setShowFilters] = useState(false);

    // Pagination
    const [recordsPage, setRecordsPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // Table styles
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

    // Fetch SPF records
    const fetchActivities = useCallback(async (page: number = 1) => {
        setLoading(true);
        setError(null);

        try {
            const url = new URL("/api/activity/accounting/spf/fetch", window.location.origin);
            url.searchParams.append("page", String(page));
            url.searchParams.append("limit", String(itemsPerPage));

            if (searchTerm.trim()) {
                url.searchParams.append("search", searchTerm.trim());
            }

            if (statusFilter) {
                url.searchParams.append("status", statusFilter);
            }
            if (customerFilter) {
                url.searchParams.append("customer", customerFilter);
            }
            if (salesPersonFilter) {
                url.searchParams.append("salesPerson", salesPersonFilter);
            }

            if (dateCreatedFilterRange?.from) {
                url.searchParams.append("from", new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10));
            }
            if (dateCreatedFilterRange?.to) {
                url.searchParams.append("to", new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10));
            }

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error("Failed to fetch SPF records");
            const data = await res.json();

            const sortedActivities = (data.activities || []).sort((a: SPFRecord, b: SPFRecord) => {
                const dateA = new Date(a.date_updated || a.created_at || String(a.id)).getTime();
                const dateB = new Date(b.date_updated || b.created_at || String(b.id)).getTime();
                return dateB - dateA;
            });

            setAllActivities(sortedActivities);
            setTotalCount(data.totalCount || 0);
        } catch (err: any) {
            setError(err.message);
            setAllActivities([]);
        } finally {
            setLoading(false);
        }
    }, [itemsPerPage, searchTerm, statusFilter, customerFilter, salesPersonFilter, dateCreatedFilterRange]);

    useEffect(() => {
        fetchActivities();
        const channel = supabase
            .channel(`spf-all`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'spf' },
                () => fetchActivities(1)
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'spf_creation' },
                () => fetchActivities(1)
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchActivities]);

    // Debounce search
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchInput(val);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearchTerm(val);
            setRecordsPage(1);
        }, 400);
    };

    // Reset page when filters change
    useEffect(() => {
        setRecordsPage(1);
    }, [searchTerm, statusFilter, customerFilter, salesPersonFilter, dateCreatedFilterRange]);

    // Clear all filters
    const clearFilters = () => {
        setStatusFilter("");
        setCustomerFilter("");
        setSalesPersonFilter("");
        setSearchInput("");
        setSearchTerm("");
    };

    // Check active filters
    const hasActiveFilters = statusFilter || customerFilter || salesPersonFilter || searchTerm;

    // CSV Download
    const handleDownloadCSV = async () => {
        if (!allActivities.length) return;

        const headers = [
            "SPF Number",
            "Customer Name",
            "Contact Person",
            "Contact Number",
            "TIN Number",
            "Registered Address",
            "Status",
            "Sales Person",
            "Prepared By",
            "Approved By",
            "Payment Terms",
            "Warranty",
            "Delivery Date",
            "Date Created",
        ];

        const rows = allActivities.map((item) => [
            item.spf_number,
            item.customer_name,
            item.contact_person,
            item.contact_number,
            item.tin_no || "",
            item.registered_address,
            item.status,
            item.sales_person || "",
            item.prepared_by || "",
            item.approved_by || "",
            item.payment_terms || "",
            item.warranty || "",
            item.delivery_date ? new Date(item.delivery_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "",
            item.created_at?.slice(0, 10) || "",
        ]);

        const csvContent = [headers, ...rows]
            .map((row) =>
                row
                    .map((f) => `"${String(f).replace(/"/g, '""')}"`)
                    .join(",")
            )
            .join("\n");

        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "spf_records.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

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
            {/* Search + Filter Actions */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search SPF records (SPF no., customer, contact)..."
                        className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all placeholder:text-gray-400"
                        value={searchInput}
                        onChange={handleSearchChange}
                    />
                </div>

                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-[11px] font-medium transition-colors flex-shrink-0 ${
                        showFilters || hasActiveFilters
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                >
                    <Filter className="w-3.5 h-3.5" />
                    Filters
                    {hasActiveFilters && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                </button>

                {/* Download */}
                <button
                    onClick={handleDownloadCSV}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-200 text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors flex-shrink-0"
                >
                    <Download className="w-3.5 h-3.5" />
                    Download
                </button>

                {/* Refresh */}
                <button
                    onClick={() => fetchActivities(1)}
                    disabled={loading}
                    title="Refresh"
                    className="flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors flex-shrink-0"
                >
                    <RefreshCw
                        className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                    />
                </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-md flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">
                            Accounting Filters
                        </span>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 transition-colors"
                            >
                                <X className="w-3 h-3" />
                                Clear All
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {/* Status Filter */}
                        <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                Status
                            </label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                            >
                                <option value="">All Statuses</option>
                                <option value="Approved">Approved</option>
                                <option value="Pending">Pending</option>
                                <option value="Pending for Procurement">Pending for Procurement</option>
                                <option value="Ready for Quotation">Ready for Quotation</option>
                                <option value="Declined">Declined</option>
                            </select>
                        </div>

                        {/* Customer Filter */}
                        <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                Customer Name
                            </label>
                            <input
                                type="text"
                                placeholder="Filter by customer"
                                value={customerFilter}
                                onChange={(e) => setCustomerFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                            />
                        </div>

                        {/* Sales Person Filter */}
                        <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                Sales Person
                            </label>
                            <input
                                type="text"
                                placeholder="Filter by sales person"
                                value={salesPersonFilter}
                                onChange={(e) => setSalesPersonFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* SPF Records table */}
            <div className="border rounded-none overflow-hidden shadow-sm flex flex-col"
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
                            {totalCount} records
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table style={{ fontFamily: tableStyles.table_font_family }}>
                        <TableHeader style={{ backgroundColor: tableStyles.th_bg }}>
                            <TableRow style={{ borderColor: tableStyles.th_border }}>
                                <TableHead style={{ color: tableStyles.th_text, fontSize: `${tableStyles.th_font_size}px`, fontWeight: tableStyles.th_font_weight, padding: `${tableStyles.th_padding}px`, letterSpacing: tableStyles.th_letter_spacing, borderColor: tableStyles.td_border }}>
                                    Actions
                                </TableHead>
                                <TableHead style={{ color: tableStyles.th_text, fontSize: `${tableStyles.th_font_size}px`, fontWeight: tableStyles.th_font_weight, padding: `${tableStyles.th_padding}px`, letterSpacing: tableStyles.th_letter_spacing, borderColor: tableStyles.td_border }}>
                                    Status
                                </TableHead>
                                <TableHead style={{ color: tableStyles.th_text, fontSize: `${tableStyles.th_font_size}px`, fontWeight: tableStyles.th_font_weight, padding: `${tableStyles.th_padding}px`, letterSpacing: tableStyles.th_letter_spacing, borderColor: tableStyles.td_border }}>
                                    SPF No.
                                </TableHead>
                                <TableHead style={{ color: tableStyles.th_text, fontSize: `${tableStyles.th_font_size}px`, fontWeight: tableStyles.th_font_weight, padding: `${tableStyles.th_padding}px`, letterSpacing: tableStyles.th_letter_spacing, borderColor: tableStyles.td_border }}>
                                    Customer
                                </TableHead>
                                <TableHead style={{ color: tableStyles.th_text, fontSize: `${tableStyles.th_font_size}px`, fontWeight: tableStyles.th_font_weight, padding: `${tableStyles.th_padding}px`, letterSpacing: tableStyles.th_letter_spacing, borderColor: tableStyles.td_border }}>
                                    Contact Person
                                </TableHead>
                                <TableHead style={{ color: tableStyles.th_text, fontSize: `${tableStyles.th_font_size}px`, fontWeight: tableStyles.th_font_weight, padding: `${tableStyles.th_padding}px`, letterSpacing: tableStyles.th_letter_spacing, borderColor: tableStyles.td_border }}>
                                    Contact No.
                                </TableHead>
                                <TableHead style={{ color: tableStyles.th_text, fontSize: `${tableStyles.th_font_size}px`, fontWeight: tableStyles.th_font_weight, padding: `${tableStyles.th_padding}px`, letterSpacing: tableStyles.th_letter_spacing, borderColor: tableStyles.td_border }}>
                                    Address
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allActivities.map((spf, i) => (
                                <TableRow key={spf.id || i} style={{ borderColor: tableStyles.td_border }}>
                                    <TableCell style={{ padding: `${tableStyles.td_padding}px`, fontSize: `${tableStyles.td_font_size}px`, color: tableStyles.td_text, borderColor: tableStyles.td_border }}>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 rounded-md hover:bg-zinc-100"
                                                onClick={() => { setPreviewSPF(spf); setPreviewOpen(true); }}
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell style={{ padding: `${tableStyles.td_padding}px`, fontSize: `${tableStyles.td_font_size}px`, color: tableStyles.td_text, borderColor: tableStyles.td_border }}>
                                        <StatusBadge status={spf.status} />
                                    </TableCell>
                                    <TableCell style={{ padding: `${tableStyles.td_padding}px`, fontSize: `${tableStyles.td_font_size}px`, color: tableStyles.td_text, borderColor: tableStyles.td_border, fontWeight: 600 }}>
                                        {spf.spf_number}
                                    </TableCell>
                                    <TableCell style={{ padding: `${tableStyles.td_padding}px`, fontSize: `${tableStyles.td_font_size}px`, color: tableStyles.td_text, borderColor: tableStyles.td_border }}>
                                        {spf.customer_name}
                                    </TableCell>
                                    <TableCell style={{ padding: `${tableStyles.td_padding}px`, fontSize: `${tableStyles.td_font_size}px`, color: tableStyles.td_text, borderColor: tableStyles.td_border }}>
                                        {spf.contact_person}
                                    </TableCell>
                                    <TableCell style={{ padding: `${tableStyles.td_padding}px`, fontSize: `${tableStyles.td_font_size}px`, color: tableStyles.td_text, borderColor: tableStyles.td_border }}>
                                        {spf.contact_number}
                                    </TableCell>
                                    <TableCell style={{ padding: `${tableStyles.td_padding}px`, fontSize: `${tableStyles.td_font_size}px`, color: tableStyles.td_text, borderColor: tableStyles.td_border }}>
                                        {spf.registered_address}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {allActivities.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-12 text-zinc-400 text-xs">
                                        No SPF records found
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <Pagination
                    total={totalCount}
                    current={recordsPage}
                    perPage={itemsPerPage}
                    onPageChange={(page) => fetchActivities(page)}
                />
            </div>

            {/* Preview Dialog */}
            {previewSPF && (
                <SPFPreviewDialog
                    open={previewOpen}
                    onClose={() => { setPreviewOpen(false); setPreviewSPF(null); }}
                    currentSPF={previewSPF}
                />
            )}
        </div>
    );
};

export default SPF;

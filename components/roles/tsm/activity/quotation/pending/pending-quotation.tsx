"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, CheckCircle2Icon, Eye, Search, Loader2, FileX, LoaderPinwheel } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import TaskListEditDialog from "../../dialog/edit";

interface RevisedQuotation {
    quotation_number: string;
    date_updated: string;
}

interface Completed {
    quotation_subject: string;
    quotation_vatable: string;
    restocking_fee: string;
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
    delivery_fee: string;
    product_quantity?: string;
    product_amount?: string;
    product_description?: string;
    product_photo?: string;
    product_title?: string;
    product_sku?: string;
    item_remarks?: string;

    // Signatories
    agent_signature: string;
    agent_contact_number: string;
    agent_email_address: string;
    agent_name: string;

    tsm_name: string;
    tsm_approval_date: string;
    tsm_remarks: string;

    manager_name: string;

    vat_type: string;

    // Revised quotation data
    revised_quotation?: RevisedQuotation | null;
}

interface ScheduledProps {
    referenceid: string;
    target_quota?: string;
    firstname?: string;
    lastname?: string;
    email?: string;
    contact?: string;
    tsmname?: string;
    managername?: string;
    signature?: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

export const Scheduled: React.FC<ScheduledProps> = ({
    referenceid,
    target_quota,
    firstname,
    lastname,
    email,
    contact,
    tsmname,
    managername,
    signature,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
}) => {
    const [activities, setActivities] = useState<Completed[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [editItem, setEditItem] = useState<Completed | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [agents, setAgents] = useState<any[]>([]);

    // Pagination state
    const [itemsPerPage] = useState(10); // Default to 10 items per page
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // -----------------------------
    // FETCH ACTIVITIES (paginated)
    // -----------------------------
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
            const url = new URL("/api/activity/tsm/quotation/pending/fetch", window.location.origin);
            url.searchParams.append("referenceid", referenceid);
            url.searchParams.append("page", String(page));
            url.searchParams.append("limit", String(itemsPerPage));

            // Add search term if present
            if (searchTerm.trim()) {
                url.searchParams.append("search", searchTerm.trim());
            }

            // Add date range filter
            const from = dateCreatedFilterRange?.from
                ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
                : null;
            const to = dateCreatedFilterRange?.to
                ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
                : null;

            if (from && to) {
                url.searchParams.append("from", from);
                url.searchParams.append("to", to);
            }

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error(`Failed to fetch activities (${res.status})`);
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
            setTotalPages(data.totalPages || 0);
            setHasMore(data.hasMore || false);
            setCurrentPage(page);
        } catch (err: any) {
            setError(err.message ?? "Unknown error");
            setActivities([]);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [referenceid, itemsPerPage, searchTerm, dateCreatedFilterRange]);

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

    // Reset page when search or filter changes
    useEffect(() => {
        setCurrentPage(1);
        // The search will be triggered by the search button click
    }, [searchTerm]);

    // Fetch agents
    useEffect(() => {
        if (!referenceid) return;
        fetch(`/api/fetch-all-user?id=${encodeURIComponent(referenceid)}`)
            .then((res) => res.json())
            .then((data) => setAgents(Array.isArray(data) ? data : []))
            .catch(() => setError("Failed to load agents."));
    }, [referenceid]);

    // Check for highlighted quotation from notification click
    useEffect(() => {
        const highlightedId = localStorage.getItem('highlightQuotationId');
        if (highlightedId) {
            console.log("🔔 Local TSM Notification: Checking for highlighted quotation:", highlightedId);
            // Wait for activities to load then highlight
            const checkAndHighlight = setInterval(() => {
                const element = document.querySelector(`[data-quotation-id="${highlightedId}"]`);
                if (element) {
                    console.log("🔔 Local TSM Notification: Found and highlighting quotation:", highlightedId);
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    element.classList.add('highlight-quotation');
                    setTimeout(() => {
                        element.classList.remove('highlight-quotation');
                    }, 3000);
                    localStorage.removeItem('highlightQuotationId');
                    clearInterval(checkAndHighlight);
                }
            }, 500);
            
            // Stop checking after 10 seconds
            setTimeout(() => {
                clearInterval(checkAndHighlight);
                localStorage.removeItem('highlightQuotationId');
            }, 10000);
        }
    }, [activities]);
    // Fetch on mount + real-time subscription
useEffect(() => {
    if (!referenceid) return;

        fetchActivities(1, false);

        const channel = supabase
            .channel(`history-${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "history",
                    filter: `tsm=eq.${referenceid}`,
                },
                () => { fetchActivities(1, false); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [referenceid, fetchActivities]);

    // -----------------------------
    // SORT & FILTER (removed - now handled server-side)
    // -----------------------------
    // Client-side filtering removed - all filtering is now done by the API

    // -----------------------------
    // AGENT MAP
    // -----------------------------
    const agentMap = useMemo(() => {
        const map: Record<string, { name: string; profilePicture: string }> = {};
        agents.forEach((agent) => {
            if (agent.ReferenceID && agent.Firstname && agent.Lastname) {
                map[agent.ReferenceID.toLowerCase()] = {
                    name: `${agent.Firstname} ${agent.Lastname}`,
                    profilePicture: agent.profilePicture || "",
                };
            }
        });
        return map;
    }, [agents]);

    const openEditDialog = (item: Completed) => {
        setEditItem(item);
        setEditOpen(true);
    };

    const closeEditDialog = () => {
        setEditOpen(false);
        setEditItem(null);
    };

    const statusColor = (status: string) => {
        switch (status) {
            case "Approved": return "bg-emerald-600 text-white";
            case "Pending": return "bg-amber-500 text-white";
            case "Decline": return "bg-red-500 text-white";
            case "Endorsed to Sales Head": return "bg-blue-600 text-white";
            default: return "bg-gray-400 text-white";
        }
    };

    return (
        <>
            {/* Search Bar */}
            <div className="mb-4 flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Input
                        type="text"
                        placeholder="Search quotations, companies, agents..."
                        className="input input-bordered input-sm w-full rounded-none pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleSearch();
                            }
                        }}
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>
                <Button
                    onClick={handleSearch}
                    disabled={loading}
                    className="h-9 px-4 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium"
                >
                    {loading ? (
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                        "Search"
                    )}
                </Button>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    <span className="text-xs">Loading quotations...</span>
                </div>
            )}

            {/* Error State */}
            {!loading && error && (
                <Alert variant="destructive" className="rounded-none text-xs mb-4">
                    <AlertCircleIcon className="h-4 w-4" />
                    <AlertTitle className="text-xs font-bold">Connection Error</AlertTitle>
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
            )}

            {/* Empty State */}
            {!loading && !error && activities.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <FileX className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-xs font-semibold uppercase tracking-wide">No pending quotations</p>
                    {searchTerm && (
                        <p className="text-xs mt-1 text-gray-300">Try adjusting your search</p>
                    )}
                </div>
            )}

            {/* Record Count */}
            {!loading && activities.length > 0 && (
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                        Showing {activities.length} records
                        {totalCount > activities.length && (
                            <span className="text-gray-400 ml-1">
                                of {totalCount} total
                            </span>
                        )}
                    </span>
                    <span className="text-[10px] text-amber-600 font-semibold uppercase bg-amber-50 px-2 py-0.5 border border-amber-200">
                        Pending Approval
                    </span>
                </div>
            )}

            {/* Cards */}
            {!loading && (
                <>
                <div className="h-[500px] overflow-y-auto space-y-3 pr-1">
                    {activities.map((item: Completed) => {
                        const agent = agentMap[item.referenceid?.toLowerCase() ?? ""];
                        return (
                            <div
                                key={item.id}
                                data-quotation-id={item.id}
                                className="border rounded-sm bg-white hover:shadow-md transition-shadow duration-200 relative overflow-hidden"
                            >
                                {/* Left accent strip by status */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.tsm_approved_status === "Approved" ? "bg-emerald-500" : item.tsm_approved_status === "Pending" ? "bg-amber-500" : "bg-gray-300"}`} />

                                <div className="pl-4 pr-3 pt-3 pb-3">
                                    {/* Header Row */}
                                    <div className="flex justify-between items-start mb-2.5">
                                        <div className="flex items-center gap-2 uppercase">
                                            {agent?.profilePicture ? (
                                                <img
                                                    src={agent.profilePicture}
                                                    alt={agent.name}
                                                    className="w-7 h-7 rounded-full object-cover border border-gray-200"
                                                />
                                            ) : (
                                                <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[9px] text-gray-500 font-bold">
                                                    {agent?.name?.charAt(0) ?? "?"}
                                                </div>
                                            )}
                                            <span className="font-bold text-[11px] text-gray-800 uppercase tracking-tight">
                                                {agent?.name || item.referenceid || "—"}
                                            </span>
                                        </div>

                                        {/* Status + Action */}
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-[10px] font-bold px-2 py-1 uppercase tracking-wide ${statusColor(item.tsm_approved_status)}`}>
                                                {item.tsm_approved_status}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="rounded-none h-7 text-[10px] px-2 border-gray-300 hover:bg-gray-50"
                                                onClick={() => openEditDialog(item)}
                                            >
                                                <Eye className="w-3 h-3 mr-1" />
                                                View
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                                        <div className="col-span-2">
                                            <span className="font-semibold text-gray-500">Company: </span>
                                            <span className="font-bold text-gray-800 uppercase">{item.company_name || "—"}</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-gray-500">Ref #: </span>
                                            <span className="font-mono text-[10px] text-gray-600">{item.activity_reference_number}</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-gray-500">Quotation #: </span>
                                            <span className="text-gray-700 uppercase">{item.quotation_number || "—"}</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-gray-500">Amount: </span>
                                            <span className="font-bold text-emerald-700">
                                                {item.quotation_amount
                                                    ? `₱${item.quotation_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                    : "—"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-gray-500">Date: </span>
                                            <span className="font-mono text-[10px] text-gray-600">
                                                {(item.revised_quotation?.date_updated || item.date_updated || item.date_created).slice(0, 10)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Remarks */}
                                    {item.remarks && item.remarks !== "-" && (
                                        <div className="col-span-2 mt-2 bg-amber-50 border border-amber-200 p-2 rounded-none">
                                            <span className="text-amber-700 font-medium text-[10px] uppercase">Remarks:</span>
                                            <span className="text-gray-700 italic text-[10px] ml-1">{item.remarks}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Load More Button */}
                {hasMore && (
                    <div className="flex justify-center mt-4">
                        <Button
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="h-9 px-6 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium"
                        >
                            {loadingMore ? <LoaderPinwheel className="animate-spin" /> : null} {loadingMore ? (
                                "Loading..."
                            ) : (
                                "Load More"
                            )}
                        </Button>
                    </div>
                )}
                </>
            )}

            {/* Edit Dialog */}
            {editOpen && editItem && (
                <TaskListEditDialog
                    item={editItem}
                    onClose={closeEditDialog}
                    onSave={() => {
                        fetchActivities(1, false);
                        closeEditDialog();
                    }}
                    firstname={firstname}
                    lastname={lastname}
                    email={email}
                    contact={contact}
                    tsmname={tsmname}
                    signature={signature}
                    company={{
                        company_name: editItem.company_name,
                        contact_number: editItem.contact_number,
                        email_address: editItem.email_address,
                        address: editItem.address,
                        contact_person: editItem.contact_person,
                    }}
                    deliveryFee={editItem.delivery_fee}
                    restockingFee={editItem.restocking_fee ?? ""}
                    whtType={editItem.quotation_vatable ?? "none"}
                    quotationSubject={editItem.quotation_subject ?? "For Quotation"}
                    agentName={editItem.agent_name}
                    agentSignature={editItem.agent_signature}
                    agentContactNumber={editItem.agent_contact_number}
                    agentEmailAddress={editItem.agent_email_address}
                    tsmName={editItem.tsm_name}
                    managerName={editItem.manager_name}
                    vatType={editItem.vat_type}
                />
            )}
            
            {/* CSS for highlighting quotations from notification clicks */}
            <style>{`
                @keyframes highlight-pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7); }
                    50% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
                }
                .highlight-quotation {
                    animation: highlight-pulse 1.5s ease-in-out 2;
                    border: 2px solid #2563eb !important;
                    background-color: #eff6ff !important;
                }
            `}</style>
        </>
    );
};
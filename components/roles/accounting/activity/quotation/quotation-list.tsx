"use client";

import React, {
    useEffect,
    useState,
    useCallback,
    useMemo,
    useRef,
} from "react";
import {
    AlertCircleIcon,
    Eye,
    Search,
    Loader2,
    FileX,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Download,
    Filter,
    X,
    History,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Preview } from "@/components/roles/tsa/activity/quotation/dialog/preview";
import { supabase } from "@/utils/supabase";

// Types
interface Quotation {
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
    vat_type: string;
    delivery_fee: string;
    restocking_fee?: string;
    quotation_vatable?: string;
    quotation_subject?: string;
    agent_signature: string;
    agent_contact_number: string;
    agent_email_address: string;
    agent_name: string;
    tsm_signature: string;
    tsm_contact_number: string;
    tsm_email_address: string;
    tsm_name: string;
    manager_name?: string;
    manager_signature: string;
    manager_contact_number: string;
    manager_email_address: string;
    tsm_approval_date: string;
    manager_approval_date: string;
    tsm_remarks: string;
    manager_remarks: string;
    product_quantity?: string;
    product_amount?: string;
    product_description?: string;
    product_photo?: string;
    product_title?: string;
    product_sku?: string;
    item_remarks?: string;
    discounted_priced?: string;
    discounted_amount?: string;
    product_is_promo?: string;
    product_is_hidden?: string;
    product_display_mode?: string;
    hide_discount_in_preview?: boolean | string;
    show_discount_columns?: boolean | string;
    show_summary_discounts?: boolean | string;
    show_profit_margins?: boolean | string;
    margin_alert_threshold?: number;
    show_margin_alerts?: boolean | string;
    product_view_mode?: string;
    visible_columns?: any;
    [key: string]: any;
}

interface QuotationProps {
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
    setDateCreatedFilterRangeAction: React.Dispatch<
        React.SetStateAction<any>
    >;
}

// Pagination
const PaginationControls = ({
    currentPage,
    totalPages,
    goToPage,
}: {
    currentPage: number;
    totalPages: number;
    goToPage: (page: number) => void;
}) => {
    if (totalPages <= 1) return null;

    const pages: (number | "...")[] = [];
    const delta = 2;
    const left = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);

    pages.push(1);
    if (left > 2) pages.push("...");
    for (let p = left; p <= right; p++) pages.push(p);
    if (right < totalPages - 1) pages.push("...");
    if (totalPages > 1) pages.push(totalPages);

    return (
        <div className="flex items-center justify-center gap-1">
            <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-gray-200 text-[11px] font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
            </button>

            {pages.map((p, i) =>
                p === "..." ? (
                    <span
                        key={`ellipsis-${i}`}
                        className="px-1 text-[11px] text-gray-300 select-none"
                    >
                        ...
                    </span>
                ) : (
                    <button
                        key={p}
                        onClick={() => goToPage(p as number)}
                        className={`w-7 h-7 rounded text-[11px] font-medium transition-colors ${
                            currentPage === p
                                ? "bg-blue-600 text-white border border-blue-600"
                                : "border border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                    >
                        {p}
                    </button>
                )
            )}

            <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-gray-200 text-[11px] font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};

// Helpers
const getAccentClass = (status: string) => {
    if (status === "Approved") return "bg-emerald-500";
    if (status === "Pending") return "bg-amber-400";
    return "bg-gray-300";
};

const getBadgeClass = (status: string) => {
    if (status === "Approved")
        return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    if (status === "Pending")
        return "bg-amber-50 text-amber-700 border border-amber-200";
    return "bg-gray-100 text-gray-500 border border-gray-200";
};

const formatAmount = (amount?: number) => {
    if (!amount) return "₱0.00";
    return `₱${amount.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

const getInitials = (name: string) =>
    name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

const toBoolean = (value: any, defaultValue: boolean): boolean => {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return defaultValue;
};

const splitAndTrim = (value: string | null | undefined) => {
    if (!value) return [];
    return value.split(",").map((v) => v.trim());
};

const splitDescription = (value: string | null | undefined) => {
    if (!value) return [];
    return value
        .split("||")
        .map((v) => v.trim().replace(/^"|"$/g, ""));
};

// Main Component
export const Quotation: React.FC<QuotationProps> = ({
    referenceid,
    firstname,
    lastname,
    email,
    contact,
    tsmname,
    managername,
    signature,
    dateCreatedFilterRange,
}) => {
    // State
    const [activities, setActivities] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Search
    const [searchInput, setSearchInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [minAmount, setMinAmount] = useState<string>("");
    const [maxAmount, setMaxAmount] = useState<string>("");
    const [companyFilter, setCompanyFilter] = useState<string>("");
    const [agentNameFilter, setAgentNameFilter] = useState<string>("");
    const [tsmNameFilter, setTsmNameFilter] = useState<string>("");
    const [quotationTypeFilter, setQuotationTypeFilter] = useState<string>("");
    const [projectTypeFilter, setProjectTypeFilter] = useState<string>("");
    const [sourceFilter, setSourceFilter] = useState<string>("");
    const [showFilters, setShowFilters] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Dialog
    const [editItem, setEditItem] = useState<Quotation | null>(null);
    const [editOpen, setEditOpen] = useState(false);

    // Preview Dialog
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewPayload, setPreviewPayload] = useState<any>(null);
    const [previewQuotationType, setPreviewQuotationType] = useState("");
    const [revisedQuotations, setRevisedQuotations] = useState<any[]>([]);
    const [selectedRevisedQuotation, setSelectedRevisedQuotation] = useState<any | null>(null);
    const [viewingCurrent, setViewingCurrent] = useState(true);
    const [currentPreviewItem, setCurrentPreviewItem] = useState<Quotation | null>(null);

    // Agents (profile pictures)
    const [agents, setAgents] = useState<any[]>([]);

    // Fetch agents once
    useEffect(() => {
        fetch("/api/fetch-all-user")
            .then((r) => {
                if (!r.ok) throw new Error("Failed to fetch agents");
                return r.json();
            })
            .then((d) => setAgents(Array.isArray(d) ? d : []))
            .catch(() => setAgents([]));
    }, []);

    // Fetch activities
    const fetchActivities = useCallback(async () => {
        setLoading(true);
        setError(null);

        const from = dateCreatedFilterRange?.from
            ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
            : null;
        const to = dateCreatedFilterRange?.to
            ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
            : null;

        try {
            const url = new URL(
                "/api/activity/csr/quotation/fetch",
                window.location.origin
            );

            if (from && to) {
                url.searchParams.append("from", from);
                url.searchParams.append("to", to);
            }
            url.searchParams.append("page", String(currentPage));
            if (searchTerm) url.searchParams.append("search", searchTerm);
            
            if (statusFilter) url.searchParams.append("status", statusFilter);
            if (minAmount) url.searchParams.append("minAmount", minAmount);
            if (maxAmount) url.searchParams.append("maxAmount", maxAmount);
            if (companyFilter) url.searchParams.append("company", companyFilter);
            if (agentNameFilter) url.searchParams.append("agentName", agentNameFilter);
            if (tsmNameFilter) url.searchParams.append("tsmName", tsmNameFilter);
            if (quotationTypeFilter) url.searchParams.append("quotationType", quotationTypeFilter);
            if (projectTypeFilter) url.searchParams.append("projectType", projectTypeFilter);
            if (sourceFilter) url.searchParams.append("source", sourceFilter);

            const res = await fetch(url.toString());

            if (!res.ok) {
                let msg = `Failed to fetch activities (${res.status})`;
                try {
                    const body = await res.json();
                    if (body?.message) msg = body.message;
                } catch (_) {}
                throw new Error(msg);
            }

            const data = await res.json();
            setActivities(data.activities ?? []);
            setTotalPages(data.totalPages ?? 1);
            setTotalCount(data.total ?? 0);
        } catch (err: any) {
            setError(err.message ?? "Unknown error");
        } finally {
            setLoading(false);
        }
    }, [dateCreatedFilterRange, currentPage, searchTerm, statusFilter, minAmount, maxAmount, companyFilter, agentNameFilter, tsmNameFilter, quotationTypeFilter, projectTypeFilter, sourceFilter]);

    // Fetch when dependencies change
    useEffect(() => {
        fetchActivities();
    }, [fetchActivities]);

    // Debounce search input
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchInput(val);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearchTerm(val);
            setCurrentPage(1);
        }, 400);
    };

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [dateCreatedFilterRange, statusFilter, minAmount, maxAmount, companyFilter, agentNameFilter, tsmNameFilter, quotationTypeFilter, projectTypeFilter, sourceFilter]);

    // Clear all filters
    const clearFilters = () => {
        setStatusFilter("");
        setMinAmount("");
        setMaxAmount("");
        setCompanyFilter("");
        setAgentNameFilter("");
        setTsmNameFilter("");
        setQuotationTypeFilter("");
        setProjectTypeFilter("");
        setSourceFilter("");
        setSearchInput("");
        setSearchTerm("");
    };

    // Check if any filters are active
    const hasActiveFilters = statusFilter || minAmount || maxAmount || companyFilter || agentNameFilter || tsmNameFilter || quotationTypeFilter || projectTypeFilter || sourceFilter || searchTerm;

    // Agent map (for profile pictures)
    const agentMap = useMemo(() => {
        const map: Record<string, { name: string; profilePicture: string }> =
            {};
        agents.forEach((agent) => {
            if (agent.Firstname && agent.Lastname) {
                const fullName = `${agent.Firstname} ${agent.Lastname}`;
                map[fullName.toLowerCase()] = {
                    name: fullName,
                    profilePicture: agent.profilePicture || "",
                };
            }
        });
        return map;
    }, [agents]);

    // Dialog functions
    const openEditDialog = (item: Quotation) => {
        setEditItem(item);
        setEditOpen(true);
    };
    const closeEditDialog = () => {
        setEditOpen(false);
        setEditItem(null);
    };

    // Build Preview Payload
    const buildPreviewPayload = (item: Quotation) => {
        const quantities = splitAndTrim(item.product_quantity);
        const amounts = splitAndTrim(item.product_amount);
        const titles = splitAndTrim(item.product_title);
        const descriptions = splitDescription(item.product_description);
        const photos = splitAndTrim(item.product_photo);
        const skus = splitAndTrim(item.product_sku);
        const remarks = splitAndTrim(item.item_remarks);
        const promoFlags = splitAndTrim(item.product_is_promo);
        const hiddenFlags = splitAndTrim(item.product_is_hidden);
        const displayModes = splitAndTrim(item.product_display_mode);
        const discountPercents = splitAndTrim(item.discounted_priced);
        const discountedAmountArr = splitAndTrim(item.discounted_amount);

        const maxLen = Math.max(
            quantities.length,
            amounts.length,
            titles.length,
            descriptions.length,
            photos.length,
            skus.length,
            remarks.length,
            1
        );

        const items = Array.from({ length: maxLen }, (_, i) => {
            const qty = parseFloat(quantities[i] ?? "0") || 0;
            const unitPrice = parseFloat(amounts[i] ?? "0") || 0;
            const discountPct = parseFloat(discountPercents[i] ?? "0") || 0;
            const isDiscounted = discountPct > 0;
            const qtyNum = qty || 1;
            let savedDiscountAmt = parseFloat(discountedAmountArr[i] ?? "0") || 0;
            if (savedDiscountAmt > 0 && qtyNum > 1) {
                savedDiscountAmt = savedDiscountAmt / qtyNum;
            }
            const discountAmount = savedDiscountAmt > 0
                ? savedDiscountAmt
                : isDiscounted ? (unitPrice * discountPct) / 100 : 0;
            const discountedAmount = unitPrice - discountAmount;

            return {
                itemNo: i + 1,
                qty,
                photo: photos[i] ?? "",
                title: titles[i] ?? "",
                sku: skus[i] ?? "",
                product_description: descriptions[i] ?? "",
                unitPrice,
                discount: discountPct,
                discountAmount,
                discountedAmount,
                totalAmount: discountedAmount * qty,
                remarks: remarks[i] ?? "",
                isPromo: promoFlags[i]?.toLowerCase() === "true" || false,
                isHidden: hiddenFlags[i]?.toLowerCase() === "true" || false,
                hideDiscountInPreview: hiddenFlags[i] === "1",
                displayMode: (() => {
                    const raw = displayModes[i] ?? "";
                    if (raw === 'full' || raw === 'transparent') return 'transparent';
                    if (raw === 'compact' || raw === 'net_only') return 'net_only';
                    if (raw === 'value_add') return 'value_add';
                    if (raw === 'bundle') return 'bundle';
                    if (raw === 'request') return 'request';
                    return 'transparent';
                })(),
            };
        });

        const totalPrice = items.reduce((sum, item) => sum + item.totalAmount, 0);
        const deliveryFeeNum = parseFloat(item.delivery_fee || "0") || 0;
        const restockingFeeNum = parseFloat(item.restocking_fee || "0") || 0;
        const totalPriceWithDelivery = totalPrice + deliveryFeeNum + restockingFeeNum;
        
        const whtType = item.quotation_vatable || "none";
        const whtLabel = whtType === "wht_1" ? "EWT 1% (Goods)" : whtType === "wht_2" ? "EWT 2% (Services)" : "None";
        const whtAmount = whtType !== "none"
            ? (item.vat_type === "vat_inc"
                ? totalPriceWithDelivery / 1.12
                : totalPriceWithDelivery
            ) * (whtType === "wht_1" ? 0.01 : 0.02)
            : 0;
        const netAmountToCollect = totalPriceWithDelivery - whtAmount;

        return {
            referenceNo: item.activity_reference_number || item.quotation_number || "",
            date: item.date_created,
            companyName: item.company_name || "",
            address: item.address || "",
            telNo: item.contact_number || "",
            email: item.email_address || "",
            attention: item.contact_person || "",
            subject: item.quotation_subject || "For Quotation",
            salesRepresentative: item.agent_name || "",
            salescontact: item.agent_contact_number || "",
            salesemail: item.agent_email_address || "",
            salestsmname: item.tsm_name || item.tsm || "",
            salesmanagername: item.manager_name || item.manager || "",
            salestsmcontact: item.tsm_contact_number || "",
            salestsmemail: item.tsm_email_address || "",
            items,
            totalPrice,
            vatType: item.vat_type || "",
            deliveryFee: item.delivery_fee || "",
            restockingFee: restockingFeeNum,
            whtType,
            whtLabel,
            whtAmount,
            netAmountToCollect,
            salesManagerContact: item.manager_contact_number || "",
            salesManagerEmail: item.manager_email_address || "",
            agentSignature: item.agent_signature || null,
            agentContactNumber: item.agent_contact_number || null,
            agentEmailAddress: item.agent_email_address || null,
            TsmSignature: item.tsm_signature || null,
            TsmEmailAddress: item.tsm_email_address || null,
            TsmContactNumber: item.tsm_contact_number || null,
            ManagerSignature: item.manager_signature || null,
            ManagerContactNumber: item.manager_contact_number || null,
            ManagerEmailAddress: item.manager_email_address || null,
        };
    };

    // Build Preview Payload from Revised Quotation
    const buildPreviewPayloadFromRevision = (revision: any) => {
        const quantities = splitAndTrim(revision.product_quantity);
        const amounts = splitAndTrim(revision.product_amount);
        const titles = splitAndTrim(revision.product_title);
        const descriptions = splitDescription(revision.product_description);
        const photos = splitAndTrim(revision.product_photo);
        const skus = splitAndTrim(revision.product_sku);
        const remarks = splitAndTrim(revision.item_remarks);
        const promoFlags = splitAndTrim(revision.product_is_promo);
        const hiddenFlags = splitAndTrim(revision.product_is_hidden);
        const displayModes = splitAndTrim(revision.product_display_mode);
        const discountPercents = splitAndTrim(revision.discounted_priced);
        const discountedAmountArr = splitAndTrim(revision.discounted_amount);

        const maxLen = Math.max(
            quantities.length,
            amounts.length,
            titles.length,
            descriptions.length,
            photos.length,
            skus.length,
            remarks.length,
            1
        );

        const items = Array.from({ length: maxLen }, (_, i) => {
            const qty = parseFloat(quantities[i] ?? "0") || 0;
            const unitPrice = parseFloat(amounts[i] ?? "0") || 0;
            const discountPct = parseFloat(discountPercents[i] ?? "0") || 0;
            const isDiscounted = discountPct > 0;
            const qtyNum = qty || 1;
            let savedDiscountAmt = parseFloat(discountedAmountArr[i] ?? "0") || 0;
            if (savedDiscountAmt > 0 && qtyNum > 1) {
                savedDiscountAmt = savedDiscountAmt / qtyNum;
            }
            const discountAmount = savedDiscountAmt > 0
                ? savedDiscountAmt
                : isDiscounted ? (unitPrice * discountPct) / 100 : 0;
            const discountedAmount = unitPrice - discountAmount;

            return {
                itemNo: i + 1,
                qty,
                photo: photos[i] ?? "",
                title: titles[i] ?? "",
                sku: skus[i] ?? "",
                product_description: descriptions[i] ?? "",
                unitPrice,
                discount: discountPct,
                discountAmount,
                discountedAmount,
                totalAmount: discountedAmount * qty,
                remarks: remarks[i] ?? "",
                isPromo: promoFlags[i]?.toLowerCase() === "true" || false,
                isHidden: hiddenFlags[i]?.toLowerCase() === "true" || false,
                hideDiscountInPreview: hiddenFlags[i] === "1",
                displayMode: (() => {
                    const raw = displayModes[i] ?? "";
                    if (raw === 'full' || raw === 'transparent') return 'transparent';
                    if (raw === 'compact' || raw === 'net_only') return 'net_only';
                    if (raw === 'value_add') return 'value_add';
                    if (raw === 'bundle') return 'bundle';
                    if (raw === 'request') return 'request';
                    return 'transparent';
                })(),
            };
        });

        const totalPrice = items.reduce((sum, item) => sum + item.totalAmount, 0);
        const deliveryFeeNum = parseFloat(revision.delivery_fee || "0") || 0;
        const restockingFeeNum = parseFloat(revision.restocking_fee || "0") || 0;
        const totalPriceWithDelivery = totalPrice + deliveryFeeNum + restockingFeeNum;
        
        const whtType = revision.quotation_vatable || "none";
        const whtLabel = whtType === "wht_1" ? "EWT 1% (Goods)" : whtType === "wht_2" ? "EWT 2% (Services)" : "None";
        const whtAmount = whtType !== "none"
            ? (revision.vat_type === "vat_inc"
                ? totalPriceWithDelivery / 1.12
                : totalPriceWithDelivery
            ) * (whtType === "wht_1" ? 0.01 : 0.02)
            : 0;
        const netAmountToCollect = totalPriceWithDelivery - whtAmount;

        return {
            referenceNo: revision.activity_reference_number || revision.quotation_number || "",
            date: revision.date_created || new Date().toISOString(),
            companyName: revision.company_name || "",
            address: revision.address || "",
            telNo: revision.contact_number || "",
            email: revision.email_address || "",
            attention: revision.contact_person || "",
            subject: revision.quotation_subject || "For Quotation",
            salesRepresentative: revision.agent_name || "",
            salescontact: revision.agent_contact_number || "",
            salesemail: revision.agent_email_address || "",
            salestsmname: revision.tsm_name || "",
            salesmanagername: revision.manager_name || "",
            salestsmcontact: revision.tsm_contact_number || "",
            salestsmemail: revision.tsm_email_address || "",
            items,
            totalPrice,
            vatType: revision.vat_type || "",
            deliveryFee: revision.delivery_fee || "",
            restockingFee: restockingFeeNum,
            whtType,
            whtLabel,
            whtAmount,
            netAmountToCollect,
            salesManagerContact: revision.manager_contact_number || "",
            salesManagerEmail: revision.manager_email_address || "",
            agentSignature: revision.agent_signature || null,
            agentContactNumber: revision.agent_contact_number || null,
            agentEmailAddress: revision.agent_email_address || null,
            TsmSignature: revision.tsm_signature || null,
            TsmEmailAddress: revision.tsm_email_address || null,
            TsmContactNumber: revision.tsm_contact_number || null,
            ManagerSignature: revision.manager_signature || null,
            ManagerContactNumber: revision.manager_contact_number || null,
            ManagerEmailAddress: revision.manager_email_address || null,
        };
    };

    const openPreviewDialog = (item: Quotation) => {
        setCurrentPreviewItem(item);
        setPreviewPayload(buildPreviewPayload(item));
        setPreviewQuotationType(item.quotation_type || "");
        setSelectedRevisedQuotation(null);
        setViewingCurrent(true);
        setPreviewOpen(true);
    };

    // CSV Download (current page only)
    const handleDownloadCSV = async () => {
        if (!activities.length) return;

        const headers = [
            "Agent Name",
            "TSM Name",
            "Company Name",
            "Contact Person",
            "Contact Number",
            "Email Address",
            "Address",
            "Quotation #",
            "Activity Ref #",
            "Quotation Amount",
            "TSM Approved Status",
            "Date Created",
            "Date Updated",
            "Quotation Type",
            "Project Type",
            "Project Name",
            "Product Category",
            "Source",
            "Type Activity",
            "Type Client",
            "VAT Type",
            "Delivery Fee",
            "TSM Remarks",
            "Manager Remarks",
            "TSM Approval Date",
            "Manager Approval Date",
        ];

        const rows = activities.map((item) => [
            item.agent_name || "",
            item.tsm_name || "",
            item.company_name || "",
            item.contact_person || "",
            item.contact_number || "",
            item.email_address || "",
            item.address || "",
            item.quotation_number || "",
            item.activity_reference_number || "",
            item.quotation_amount || "",
            item.tsm_approved_status || "",
            item.date_created?.slice(0, 10) || "",
            item.date_updated?.slice(0, 10) || "",
            item.quotation_type || "",
            item.project_type || "",
            item.project_name || "",
            item.product_category || "",
            item.source || "",
            item.type_activity || "",
            item.type_client || "",
            item.vat_type || "",
            item.delivery_fee || "",
            item.tsm_remarks || "",
            item.manager_remarks || "",
            item.tsm_approval_date?.slice(0, 10) || "",
            item.manager_approval_date?.slice(0, 10) || "",
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
        link.setAttribute("download", "quotation_list.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Log audit trail for the download
        const userId = localStorage.getItem("userId");
        if (userId) {
            try {
                await fetch("/api/audit-log", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        userId,
                        action: "export",
                        entityType: "quotation_list",
                        entityName: "Quotation List",
                        details: `Exported ${activities.length} quotation records`,
                        changes: {
                            recordCount: activities.length,
                            filters: {
                                status: statusFilter,
                                minAmount,
                                maxAmount,
                                company: companyFilter,
                                agentName: agentNameFilter,
                                tsmName: tsmNameFilter,
                                quotationType: quotationTypeFilter,
                                projectType: projectTypeFilter,
                                source: sourceFilter,
                            },
                        },
                        ipAddress: typeof window !== "undefined" ? window.location.hostname : undefined,
                        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
                    }),
                });
            } catch (error) {
                console.error("Failed to log audit trail for CSV download:", error);
            }
        }
    };

    // Fetch revised quotations when preview opens
    useEffect(() => {
        if (!previewOpen || !currentPreviewItem) return;
        const fetchRevisedQuotations = async () => {
            if (!currentPreviewItem.quotation_number) return;
            const { data, error } = await supabase
                .from("revised_quotations")
                .select("*")
                .eq("quotation_number", currentPreviewItem.quotation_number)
                .order("id", { ascending: false });
            if (!error) {
                const rows = data || [];
                setRevisedQuotations(rows);
            }
        };
        fetchRevisedQuotations();
    }, [previewOpen, currentPreviewItem, supabase]);

    // Update preview when selected revision changes
    useEffect(() => {
        if (!previewOpen) return;
        if (selectedRevisedQuotation) {
            const payload = buildPreviewPayloadFromRevision(selectedRevisedQuotation);
            setPreviewPayload(payload);
        } else if (currentPreviewItem) {
            const payload = buildPreviewPayload(currentPreviewItem);
            setPreviewPayload(payload);
        }
    }, [selectedRevisedQuotation, currentPreviewItem, previewOpen]);

    // Render
    return (
        <div className="flex flex-col h-full">

            {/* Search + Filter Actions */}
            <div className="mb-4 flex items-center gap-2 flex-shrink-0">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search quotations (company, quote #, ref #)..."
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

                {/* Manual refresh */}
                <button
                    onClick={() => fetchActivities()}
                    disabled={loading}
                    title="Refresh"
                    className="flex items-center justify-center w-8 h-8 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors flex-shrink-0"
                >
                    <RefreshCw
                        className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                    />
                </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md flex-shrink-0">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
                                <option value="Declined">Declined</option>
                            </select>
                        </div>

                        {/* Min Amount */}
                        <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                Min Amount (₱)
                            </label>
                            <input
                                type="number"
                                placeholder="0"
                                value={minAmount}
                                onChange={(e) => setMinAmount(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                            />
                        </div>

                        {/* Max Amount */}
                        <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                Max Amount (₱)
                            </label>
                            <input
                                type="number"
                                placeholder="No limit"
                                value={maxAmount}
                                onChange={(e) => setMaxAmount(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                            />
                        </div>

                        {/* Company Name Filter */}
                        <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                Company Name
                            </label>
                            <input
                                type="text"
                                placeholder="Filter by company"
                                value={companyFilter}
                                onChange={(e) => setCompanyFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                            />
                        </div>

                        {/* Agent Name Filter */}
                        <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                Agent Name
                            </label>
                            <input
                                type="text"
                                placeholder="Filter by agent"
                                value={agentNameFilter}
                                onChange={(e) => setAgentNameFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                            />
                        </div>

                        {/* TSM Name Filter */}
                        <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                TSM Name
                            </label>
                            <input
                                type="text"
                                placeholder="Filter by TSM"
                                value={tsmNameFilter}
                                onChange={(e) => setTsmNameFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                            />
                        </div>

                        {/* Quotation Type Filter */}
                        <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                Quotation Type
                            </label>
                            <input
                                type="text"
                                placeholder="Filter by type"
                                value={quotationTypeFilter}
                                onChange={(e) => setQuotationTypeFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                            />
                        </div>

                        {/* Project Type Filter */}
                        <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                Project Type
                            </label>
                            <input
                                type="text"
                                placeholder="Filter by project"
                                value={projectTypeFilter}
                                onChange={(e) => setProjectTypeFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                            />
                        </div>

                        {/* Source Filter */}
                        <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                Source
                            </label>
                            <input
                                type="text"
                                placeholder="Filter by source"
                                value={sourceFilter}
                                onChange={(e) => setSourceFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-14 text-gray-400 gap-2 flex-shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Loading quotations...</span>
                </div>
            )}

            {/* Error */}
            {!loading && error && (
                <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 mb-4 flex-shrink-0">
                    <AlertCircleIcon className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-semibold text-red-700">
                            Connection Error
                        </p>
                        <p className="text-xs text-red-500 mt-0.5">{error}</p>
                        <button
                            onClick={fetchActivities}
                            className="mt-1.5 text-[11px] text-red-600 underline underline-offset-2 hover:text-red-800 transition-colors"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            )}

            {/* Empty */}
            {!loading && !error && activities.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2 flex-shrink-0">
                    <FileX className="w-9 h-9 opacity-25" />
                    <p className="text-xs font-semibold uppercase tracking-widest">
                        No quotations found
                    </p>
                    {hasActiveFilters && (
                        <p className="text-[11px] text-gray-300">
                            Try adjusting your filters
                        </p>
                    )}
                </div>
            )}

            {/* Meta bar + pagination TOP */}
            {!loading && activities.length > 0 && (
                <div className="flex-shrink-0 mb-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                            {totalCount} Record{totalCount !== 1 ? "s" : ""}
                            <span className="ml-1 text-gray-300">
                                · Page {currentPage} of {totalPages}
                            </span>
                        </span>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleDownloadCSV}
                                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                            >
                                <Download className="w-3 h-3" />
                                Download
                            </button>
                            <span className="text-[10px] font-medium text-amber-700 uppercase tracking-wide bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                Quotation List
                            </span>
                        </div>
                    </div>

                    <PaginationControls
                        currentPage={currentPage}
                        totalPages={totalPages}
                        goToPage={(p) => setCurrentPage(p)}
                    />
                </div>
            )}

            {/* Cards */}
            {!loading && (
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
                    {activities.map((item) => {
                        const agentKey =
                            item.agent_name?.toLowerCase() ?? "";
                        const agent = agentMap[agentKey];
                        const displayName =
                            agent?.name || item.agent_name || "Unknown";

                        return (
                            <div
                                key={item.id}
                                className="flex flex-col sm:flex-row border border-gray-100 rounded-lg bg-white hover:border-gray-200 hover:shadow-sm transition-all duration-150 overflow-hidden"
                            >
                                {/* Left accent strip (hidden on mobile, visible on sm+) */}
                                <div
                                    className={`hidden sm:block w-1 flex-shrink-0 ${getAccentClass(item.tsm_approved_status)}`}
                                />

                                <div className="flex-1 px-3 py-3 sm:px-3.5 sm:py-3 min-w-0">
                                    {/* Header row */}
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2.5 gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {agent?.profilePicture ? (
                                                <img
                                                    src={agent.profilePicture}
                                                    alt={displayName}
                                                    className="w-7 h-7 rounded-full object-cover border border-gray-100 flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[9px] font-semibold text-blue-500 flex-shrink-0">
                                                    {getInitials(displayName)}
                                                </div>
                                            )}
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-tight truncate">
                                                    {displayName}
                                                </span>
                                                <span className="text-[9px] text-gray-500 truncate">
                                                    {item.company_name || "—"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <span
                                                className={`text-[10px] font-medium px-2 py-0.5 rounded uppercase tracking-wide ${getBadgeClass(item.tsm_approved_status)}`}
                                            >
                                                {item.tsm_approved_status}
                                            </span>
                                            <button
                                                onClick={() =>
                                                    openPreviewDialog(item)
                                                }
                                                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                                            >
                                                <Eye className="w-3 h-3" />
                                                View
                                            </button>
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-100 mb-2.5" />

                                    {/* Detail grid - responsive columns */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-2">
                                        <div>
                                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                                Ref #
                                            </p>
                                            <p className="font-mono text-[10px] text-gray-500 break-all">
                                                {item.activity_reference_number}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                                Quotation #
                                            </p>
                                            <p className="font-mono text-[10px] text-gray-500 break-all">
                                                {item.quotation_number || "—"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                                Amount
                                            </p>
                                            <p className="text-[12px] font-semibold text-emerald-600">
                                                {formatAmount(item.quotation_amount)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                                Date
                                            </p>
                                            <p className="font-mono text-[10px] text-gray-500">
                                                {item.date_created.slice(0, 10)}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Additional details - visible on md+ */}
                                    <div className="hidden md:block mt-3 pt-3 border-t border-gray-100">
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                                            {item.vat_type && (
                                                <div>
                                                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                                        VAT Type
                                                    </p>
                                                    <p className="text-[10px] text-gray-500">
                                                        {item.vat_type}
                                                    </p>
                                                </div>
                                            )}
                                            {item.quotation_type && (
                                                <div>
                                                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                                        Quotation Type
                                                    </p>
                                                    <p className="text-[10px] text-gray-500">
                                                        {item.quotation_type}
                                                    </p>
                                                </div>
                                            )}
                                            {item.source && (
                                                <div>
                                                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                                        Source
                                                    </p>
                                                    <p className="text-[10px] text-gray-500">
                                                        {item.source}
                                                    </p>
                                                </div>
                                            )}
                                            {item.project_type && (
                                                <div>
                                                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                                        Project Type
                                                    </p>
                                                    <p className="text-[10px] text-gray-500">
                                                        {item.project_type}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Additional details for mobile */}
                                    <div className="mt-2 sm:hidden">
                                        <p className="text-[11px] text-gray-400">
                                            {[
                                                item.contact_person,
                                                item.contact_number,
                                            ]
                                                .filter(Boolean)
                                                .join(" · ") || "—"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination BOTTOM */}
            {!loading && activities.length > 0 && (
                <div className="mt-4 flex-shrink-0">
                    <PaginationControls
                        currentPage={currentPage}
                        totalPages={totalPages}
                        goToPage={(p) => setCurrentPage(p)}
                    />
                </div>
            )}

            {/* Preview Dialog with Version History */}
            {previewOpen && previewPayload && (
                <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                    <DialogContent
                        className="max-w-[1400px] w-[95vw] max-h-[90vh] p-0 border-none bg-white shadow-2xl flex flex-col"
                        style={{ maxWidth: "1400px", width: "100vw" }}
                    >
                        <DialogHeader className="px-5 pt-4 pb-0 border-b border-gray-100">
                            <DialogTitle className="text-sm font-black uppercase tracking-tight text-gray-800">
                                Quotation Preview
                            </DialogTitle>
                            <DialogDescription className="text-[11px] text-gray-400 pb-3">
                                {currentPreviewItem?.quotation_number} · {currentPreviewItem?.company_name}
                            </DialogDescription>
                        </DialogHeader>

                        {/* Two-column layout: Left Preview, Right Revisions */}
                        <div className="flex-1 grid grid-cols-[1fr_380px] overflow-hidden">
                            {/* Left: Preview */}
                            <div className="overflow-auto p-3 border-r border-gray-200 accounting-preview-container">
                                <style>{`
                                    .accounting-preview-container .sticky.bottom-0 {
                                        display: none !important;
                                    }
                                `}</style>
                                <Preview
                                    payload={previewPayload}
                                    quotationType={previewQuotationType}
                                    setIsPreviewOpen={setPreviewOpen}
                                    hideDiscountInPreview={toBoolean(currentPreviewItem?.hide_discount_in_preview, false)}
                                    showDiscountColumns={toBoolean(currentPreviewItem?.show_discount_columns, true)}
                                    showSummaryDiscounts={toBoolean(currentPreviewItem?.show_summary_discounts, true)}
                                    showProfitMargins={toBoolean(currentPreviewItem?.show_profit_margins, false)}
                                    marginAlertThreshold={currentPreviewItem?.margin_alert_threshold ?? 0}
                                    showMarginAlerts={toBoolean(currentPreviewItem?.show_margin_alerts, false)}
                                    productViewMode={currentPreviewItem?.product_view_mode ?? "list"}
                                    visibleColumns={currentPreviewItem?.visible_columns ?? null}
                                    approvedStatus={currentPreviewItem?.tsm_approved_status ?? ""}
                                    hasChanges={false}
                                />
                            </div>

                            {/* Right: Revisions Panel (matching TSM approved dialog) */}
                            <div className="bg-gray-50 flex flex-col overflow-hidden">
                                <div className="p-4 border-b border-gray-200 bg-white">
                                    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-gray-800">
                                        <History className="w-4 h-4" />
                                        Revision History
                                        <span className="bg-[#121212] text-white text-[10px] font-black px-2 py-0.5 rounded-full ml-auto">
                                            {revisedQuotations.length}
                                        </span>
                                    </h3>
                                </div>
                                <div className="flex-1 overflow-auto p-3">
                                    {/* Current/Latest Button */}
                                    <div
                                        onClick={() => { setViewingCurrent(true); setSelectedRevisedQuotation(null); }}
                                        className={`mb-3 border rounded-sm p-3 cursor-pointer transition hover:shadow-md ${viewingCurrent ? "bg-[#121212] text-white border-[#121212]" : "bg-white border-gray-300"}`}
                                    >
                                        <div className="font-semibold text-sm mb-1 flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${viewingCurrent ? "bg-emerald-400" : "bg-emerald-500"}`}></span>
                                            CURRENT / LATEST
                                        </div>
                                        <div className={`text-xs ${viewingCurrent ? "text-gray-300" : "text-gray-500"}`}>
                                            <div>Quotation: {currentPreviewItem?.quotation_number}</div>
                                            <div>Amount: {formatAmount(currentPreviewItem?.quotation_amount)}</div>
                                        </div>
                                    </div>

                                    {revisedQuotations.length === 0 ? (
                                        <p className="text-xs text-gray-500 italic text-center py-4">No revised quotations found.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {revisedQuotations.map((q, idx) => (
                                                <div
                                                    key={q.id}
                                                    onClick={() => { setViewingCurrent(false); setSelectedRevisedQuotation(q); }}
                                                    className={`border rounded-sm p-3 text-xs cursor-pointer transition hover:shadow-md ${!viewingCurrent && selectedRevisedQuotation?.id === q.id ? "bg-gray-100 border-[#121212]" : "bg-white border-gray-300"}`}
                                                >
                                                    <div className="font-semibold text-sm mb-1 text-gray-800">REV {revisedQuotations.length - idx}</div>
                                                    <div className="text-gray-600 space-y-0.5">
                                                        <div><span className="font-bold">Product:</span> {q.product_title?.split(",")[0] || "N/A"}</div>
                                                        <div><span className="font-bold">Amount:</span> {formatAmount(q.quotation_amount)}</div>
                                                        <div className="text-gray-400 text-[10px] mt-1 flex items-center gap-2">
                                                            <span>Modified: {q.date_created ? (() => {
                                                                const d = new Date(q.date_created);
                                                                return d.toLocaleString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric',
                                                                    hour: 'numeric',
                                                                    minute: '2-digit',
                                                                    hour12: true,
                                                                    timeZone: 'Asia/Manila'
                                                                });
                                                            })() : 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};

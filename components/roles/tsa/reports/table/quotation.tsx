"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/utils/supabase";
import ExcelJS from "exceljs";
import { Download, Search } from "lucide-react";
import { ta } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Quotation {
  id: number;
  quotation_number?: string;
  quotation_amount?: number;
  remarks?: string;
  date_created: string;
  date_updated?: string;
  company_name?: string;
  contact_number?: string;
  type_activity: string;
  status: string;
  quotation_status?: string;
  quotation_status_sub?: string;
}

interface QuotationProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

// ─── Priority ─────────────────────────────────────────────────────────────────

type Priority = "all" | "HOT" | "WARM" | "COLD" | "DONE";

function getPriority(status?: string, sub?: string): "HOT" | "WARM" | "COLD" | "DONE" | null {
  if (sub && sub.trim() !== "") {
    if (sub.toUpperCase().includes("DECLINE")) return "COLD";
  }
  switch (status?.toUpperCase()) {
    case "CONVERT TO SO": return "HOT";
    case "PENDING CLIENT APPROVAL": return "WARM";
    case "ORDER COMPLETE": return "DONE";
    default: return null;
  }
}

const PRIORITY_STYLES: Record<string, { badge: string; dot: string }> = {
  HOT: { badge: "bg-red-50 text-red-700 border-red-100", dot: "bg-red-500" },
  WARM: { badge: "bg-amber-50 text-amber-700 border-amber-100", dot: "bg-amber-400" },
  COLD: { badge: "bg-blue-50 text-blue-700 border-blue-100", dot: "bg-blue-400" },
  DONE: { badge: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500" },
};

const PAGE_SIZE = 10;

// ─── Component ────────────────────────────────────────────────────────────────

export const QuotationTable: React.FC<QuotationProps> = ({
  referenceid,
  dateCreatedFilterRange,
}) => {
  const [activities, setActivities] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterPriority, setFilterPriority] = useState<Priority>("all");
  const [filterQuotationStatus, setFilterQuotationStatus] = useState("all");
  const [filterQuotationSubStatus, setFilterQuotationSubStatus] = useState("all");
  const [page, setPage] = useState(1);

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

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchActivities = useCallback(() => {
    if (!referenceid) { setActivities([]); return; }
    setLoading(true);
    setError(null);

    const from = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from).toISOString() : null;
    const to = dateCreatedFilterRange?.to
      ? new Date(new Date(dateCreatedFilterRange.to).setHours(23, 59, 59, 999)).toISOString() : null;

    const url = new URL("/api/reports/tsa/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    if (from && to) { url.searchParams.append("from", from); url.searchParams.append("to", to); }

    fetch(url.toString())
      .then(async (res) => { if (!res.ok) throw new Error("Failed to fetch activities"); return res.json(); })
      .then((data) => setActivities(data.activities || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;
    const channel = supabase
      .channel(`public:history:referenceid=eq.${referenceid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "history", filter: `referenceid=eq.${referenceid}` }, (payload) => {
        const n = payload.new as Quotation;
        const o = payload.old as Quotation;
        setActivities((curr) => {
          switch (payload.eventType) {
            case "INSERT": return curr.some(a => a.id === n.id) ? curr : [...curr, n];
            case "UPDATE": return curr.map(a => a.id === n.id ? n : a);
            case "DELETE": return curr.filter(a => a.id !== o.id);
            default: return curr;
          }
        });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [referenceid, fetchActivities]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const baseActivities = useMemo(() =>
    [...activities]
      .filter(i => i.type_activity?.toLowerCase() === "quotation preparation")
      .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime()),
    [activities]
  );

  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = { HOT: 0, WARM: 0, COLD: 0, DONE: 0 };
    baseActivities.forEach(i => { const p = getPriority(i.quotation_status, i.quotation_status_sub); if (p) counts[p]++; });
    return counts;
  }, [baseActivities]);

  const uniqueStatuses = useMemo(() =>
    Array.from(new Set(baseActivities.map(i => i.quotation_status?.toUpperCase()).filter(Boolean) as string[])).sort(),
    [baseActivities]
  );

  const uniqueSubStatuses = useMemo(() =>
    Array.from(new Set(baseActivities.map(i => i.quotation_status_sub?.toUpperCase()).filter(Boolean) as string[])).sort(),
    [baseActivities]
  );

  const availableStatuses = useMemo(() => {
    if (filterPriority === "all") return uniqueStatuses;
    return uniqueStatuses.filter(s =>
      baseActivities.some(a => a.quotation_status?.toUpperCase() === s &&
        getPriority(a.quotation_status, a.quotation_status_sub) === filterPriority)
    );
  }, [uniqueStatuses, baseActivities, filterPriority]);

  useEffect(() => { setFilterQuotationStatus("all"); setFilterQuotationSubStatus("all"); }, [filterPriority]);

  const filteredActivities = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return baseActivities.filter(item => {
      if (search && ![item.company_name, item.quotation_number, item.remarks].some(v => v?.toLowerCase().includes(search))) return false;
      if (filterPriority !== "all") {
        if (getPriority(item.quotation_status, item.quotation_status_sub) !== filterPriority) return false;
      }
      if (filterQuotationStatus !== "all" && item.quotation_status?.toUpperCase() !== filterQuotationStatus) return false;
      if (filterQuotationSubStatus !== "all" && item.quotation_status_sub?.toUpperCase() !== filterQuotationSubStatus) return false;
      if (dateCreatedFilterRange?.from || dateCreatedFilterRange?.to) {
        const itemDate = new Date(item.date_created);
        if (isNaN(itemDate.getTime())) return false;
        const from = dateCreatedFilterRange.from ? new Date(dateCreatedFilterRange.from) : null;
        const to = dateCreatedFilterRange.to ? new Date(dateCreatedFilterRange.to) : null;
        const sameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
        if (from && to && sameDay(from, to)) { if (!sameDay(itemDate, from)) return false; }
        else { if (from && itemDate < from) return false; if (to && itemDate > to) return false; }
      }
      return true;
    });
  }, [baseActivities, searchTerm, filterPriority, filterQuotationStatus, filterQuotationSubStatus, dateCreatedFilterRange]);

  useEffect(() => { setPage(1); }, [searchTerm, filterPriority, filterQuotationStatus, filterQuotationSubStatus, dateCreatedFilterRange]);

  const totalQuotationAmount = useMemo(() =>
    filteredActivities.reduce((acc, i) => acc + (i.quotation_amount ?? 0), 0),
    [filteredActivities]
  );

  const uniqueQuotationCount = useMemo(() => {
    const s = new Set<string>();
    filteredActivities.forEach(i => { if (i.quotation_number) s.add(i.quotation_number); });
    return s.size;
  }, [filteredActivities]);

  const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);
  const paginatedActivities = useMemo(() =>
    filteredActivities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredActivities, page]
  );

  // ── Shared cell style ──────────────────────────────────────────────────────
  const tdStyle = {
    color: tableStyles.td_text,
    fontSize: `${tableStyles.td_font_size}px`,
    padding: `${tableStyles.td_padding}px 12px`,
    borderColor: tableStyles.td_border,
  };

  const tfootCellStyle = {
    color: tableStyles.tfoot_text,
    fontSize: `${tableStyles.tfoot_font_size}px`,
    padding: `${tableStyles.tfoot_padding}px 12px`,
  };

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!loading && !error && baseActivities.length === 0) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="bg-red-50 border border-red-100 p-6 text-center shadow-sm">
          <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-1">No Data Found</p>
          <p className="text-[10px] text-red-400 uppercase font-bold">Please check your date range or try again later.</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Priority pills ── */}
      <div className="flex flex-wrap gap-2">
        {(["all", "HOT", "WARM", "COLD", "DONE"] as const).map((p) => {
          const isActive = filterPriority === p;
          const style = p !== "all" ? PRIORITY_STYLES[p] : null;
          return (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm
                ${isActive
                  ? p === "all" ? "bg-zinc-900 text-white" : style?.badge + " ring-1"
                  : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"}`}
              style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
            >
              {p !== "all" && <span className={`w-1.5 h-1.5 rounded-full ${style?.dot}`} />}
              {p === "all" ? "All Records" : p}
              {p !== "all" && (
                <span className="ml-1 px-1.5 py-0.5 bg-zinc-100 text-zinc-600 border border-zinc-200"
                  style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
                  {priorityCounts[p]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Summary bar ── */}
      {filteredActivities.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50/50 border border-indigo-100/50"
          style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
          <span className="text-xs">📊</span>
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
            <span>Records: <span className="text-indigo-900 font-mono">{filteredActivities.length}</span></span>
            <span className="text-indigo-200">|</span>
            <span>Unique Quotations: <span className="text-indigo-900 font-mono">{uniqueQuotationCount}</span></span>
            <span className="text-indigo-200">|</span>
            <span>Total: <span className="text-indigo-900 font-mono underline underline-offset-2">
              {totalQuotationAmount.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
            </span></span>
          </div>
        </div>
      )}

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
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-50"
              style={{ color: tableStyles.toolbar_input_text }}
            />
            <Input
              type="text"
              placeholder="Search..."
              className="h-8 text-[10px] pl-8 uppercase tracking-widest border-0 focus-visible:ring-0"
              style={{
                color: tableStyles.toolbar_input_text,
                fontSize: `${tableStyles.th_font_size}px`,
                backgroundColor: tableStyles.toolbar_input_bg,
                borderColor: tableStyles.toolbar_input_border,
                borderRadius: `${tableStyles.table_border_radius}px`,
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Status filter */}
          <Select value={filterQuotationStatus} onValueChange={setFilterQuotationStatus}>
            <SelectTrigger
              className="h-8 w-[180px] text-[10px] font-bold uppercase tracking-widest border"
              style={{
                color: tableStyles.toolbar_btn_text,
                borderColor: tableStyles.toolbar_btn_border,
                backgroundColor: tableStyles.toolbar_btn_bg,
                borderRadius: `${tableStyles.table_border_radius}px`,
              }}
            >
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent style={{ borderRadius: tableStyles.table_border_radius, }}>
              <SelectItem value="all" className="text-[10px] font-bold uppercase tracking-widest">All Statuses</SelectItem>
              {availableStatuses.map((s) => {
                const p = getPriority(s, undefined);
                const style = p ? PRIORITY_STYLES[p] : null;
                return (
                  <SelectItem key={s} value={s} className="text-[10px] font-bold uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                      {style && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />}
                      {s}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Sub-status filter */}
          <Select value={filterQuotationSubStatus} onValueChange={setFilterQuotationSubStatus}>
            <SelectTrigger
              className="h-8 w-[180px] text-[10px] font-bold uppercase tracking-widest"
              style={{
                color: tableStyles.toolbar_btn_text,
                borderColor: tableStyles.toolbar_btn_border,
                backgroundColor: tableStyles.toolbar_btn_bg,
                borderRadius: `${tableStyles.table_border_radius}px`,
              }}
            >
              <SelectValue placeholder="Sub-Status" />
            </SelectTrigger>
            <SelectContent style={{ borderRadius: tableStyles.table_border_radius, }}>
              <SelectItem value="all" className="text-[10px] font-bold uppercase tracking-widest">All Sub-Statuses</SelectItem>
              {uniqueSubStatuses.map((s) => (
                <SelectItem key={s} value={s} className="text-[10px] font-bold uppercase tracking-widest">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Table body ── */}
        {loading ? (
          <div className="flex justify-center items-center h-40 text-xs font-mono"
            style={{ color: tableStyles.td_text, backgroundColor: tableStyles.table_bg }}>
            Loading records...
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-40 text-xs font-bold uppercase tracking-wider text-red-500"
            style={{ backgroundColor: tableStyles.table_bg }}>
            {error}
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex justify-center items-center h-40 text-xs font-bold uppercase tracking-widest italic"
            style={{ color: tableStyles.td_text, backgroundColor: tableStyles.table_bg }}>
            No quotation records found.
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ backgroundColor: tableStyles.table_bg }}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.th_bg }}>
                  {["Date Created", "Status", "Quotation Remarks", "Quotation No.", "Amount", "Company", "Contact", "Priority", "Remarks"].map((h) => (
                    <TableHead key={h}
                      className="uppercase font-bold whitespace-nowrap"
                      style={{ color: tableStyles.th_text, fontSize: `${tableStyles.th_font_size}px`, padding: `${tableStyles.th_padding}px 12px`, borderColor: tableStyles.th_border, backgroundColor: tableStyles.th_bg }}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginatedActivities.map((item) => {
                  const priority = getPriority(item.quotation_status, item.quotation_status_sub);
                  const priorityStyle = priority ? PRIORITY_STYLES[priority] : null;
                  return (
                    <TableRow key={item.id}
                      style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.table_bg }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.tr_hover_bg; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.table_bg; }}
                    >
                      <TableCell style={tdStyle}>{new Date(item.date_created).toLocaleDateString()}</TableCell>
                      <TableCell style={tdStyle}>
                        <span
                          className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter bg-zinc-100 text-zinc-600 border border-zinc-200"
                          style={{
                            borderRadius: `${tableStyles.table_border_radius}px`,
                          }}
                        >
                          {item.quotation_status || "—"}
                        </span>
                      </TableCell>
                      <TableCell style={tdStyle}>{item.quotation_status_sub || "—"}</TableCell>
                      <TableCell style={tdStyle}>{item.quotation_number || "—"}</TableCell>
                      <TableCell style={tdStyle}>
                        {item.quotation_amount != null
                          ? item.quotation_amount.toLocaleString(undefined, { style: "currency", currency: "PHP" })
                          : "—"}
                      </TableCell>
                      <TableCell style={tdStyle}>{item.company_name || "—"}</TableCell>
                      <TableCell style={tdStyle}>{item.contact_number || "—"}</TableCell>
                      <TableCell style={tdStyle}>
                        {priority && priorityStyle ? (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none text-[10px] font-bold uppercase tracking-tighter shadow-sm border ${priorityStyle.badge}`}
                            style={{
                              borderRadius: `${tableStyles.table_border_radius}px`,
                            }}>
                            <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
                            {priority}
                          </span>
                        ) : <span className="text-zinc-300">—</span>}
                      </TableCell>
                      <TableCell style={tdStyle}>{item.remarks || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

              <TableFooter>
                <TableRow style={{ backgroundColor: tableStyles.tfoot_bg, borderColor: tableStyles.tfoot_border }}>
                  <TableCell colSpan={4} className="uppercase tracking-wider" style={tfootCellStyle}>Total</TableCell>
                  <TableCell style={tfootCellStyle}>
                    {totalQuotationAmount.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                  </TableCell>
                  <TableCell colSpan={4} />
                </TableRow>
              </TableFooter>
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
                    onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
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
                    onClick={(e) => { e.preventDefault(); if (page < pageCount) setPage(page + 1); }}
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
    </div>
  );
};

"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search } from "lucide-react";
import { supabase } from "@/utils/supabase";
import ExcelJS from "exceljs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "PHP" });

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const inDateRange = (dateStr: string, range: any): boolean => {
  if (!range?.from && !range?.to) return true;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const from = range.from ? new Date(range.from) : null;
  const to = range.to ? new Date(range.to) : null;
  if (from && to && isSameDay(from, to)) return isSameDay(date, from);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) || d.getTime() === new Date("1970-01-01T00:00:00Z").getTime()
    ? "—"
    : d.toLocaleDateString();
};

function makeRealtimeHandler<T extends { id: number }>(
  setActivities: React.Dispatch<React.SetStateAction<T[]>>
) {
  return (payload: any) => {
    const n = payload.new as T;
    const o = payload.old as T;
    setActivities((curr) => {
      switch (payload.eventType) {
        case "INSERT": return curr.some((a) => a.id === n.id) ? curr : [...curr, n];
        case "UPDATE": return curr.map((a) => (a.id === n.id ? n : a));
        case "DELETE": return curr.filter((a) => a.id !== o.id);
        default: return curr;
      }
    });
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SO {
  id: number;
  so_number?: string;
  so_amount?: number;
  remarks?: string;
  date_created: string;
  company_name?: string;
  contact_number?: string;
  contact_person?: string;
  type_activity: string;
  status: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const SOTable: React.FC<{
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}> = ({ referenceid, dateCreatedFilterRange }) => {
  const [activities, setActivities] = useState<SO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
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

    const url = new URL("/api/reports/tsa/fetch", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    const from = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from).toISOString() : null;
    const to = dateCreatedFilterRange?.to
      ? new Date(new Date(dateCreatedFilterRange.to).setHours(23, 59, 59, 999)).toISOString() : null;
    if (from && to) { url.searchParams.append("from", from); url.searchParams.append("to", to); }

    fetch(url.toString())
      .then(async (r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => setActivities(d.activities || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;
    const ch = supabase
      .channel(`public:history:referenceid=eq.${referenceid}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "history",
        filter: `referenceid=eq.${referenceid}`,
      }, makeRealtimeHandler(setActivities))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [referenceid, fetchActivities]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const statusOptions = useMemo(() =>
    Array.from(new Set(
      activities
        .filter((a) => a.type_activity?.toLowerCase() === "sales order preparation")
        .map((a) => a.status)
        .filter(Boolean)
    )).sort(),
    [activities]
  );

  const filtered = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return activities
      .filter((i) => i.type_activity?.toLowerCase() === "sales order preparation")
      .filter((i) => !s || [i.company_name, i.so_number, i.remarks].some((v) => v?.toLowerCase().includes(s)))
      .filter((i) => filterStatus === "all" || i.status === filterStatus)
      .filter((i) => inDateRange(i.date_created, dateCreatedFilterRange))
      .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
  }, [activities, searchTerm, filterStatus, dateCreatedFilterRange]);

  const total = useMemo(() => filtered.reduce((a, i) => a + (i.so_amount ?? 0), 0), [filtered]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() =>
    filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  useEffect(() => { setPage(1); }, [searchTerm, filterStatus, dateCreatedFilterRange]);

  // ── Shared cell style ──────────────────────────────────────────────────────
  const tdStyle = {
    color: tableStyles.td_text,
    fontSize: `${tableStyles.td_font_size}px`,
    padding: `${tableStyles.td_padding}px 12px`,
    borderColor: tableStyles.td_border,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
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
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger
            className="h-8 w-[180px] text-[10px] font-bold uppercase tracking-widest"
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
            <SelectItem value="all" className="text-[10px] font-bold uppercase tracking-widest">
              All Statuses
            </SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s} className="text-[10px] font-bold uppercase tracking-widest">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Record count + total */}
        {filtered.length > 0 && (
          <div
            className="ml-auto flex items-center gap-3 px-3 py-1 border text-[10px] font-bold uppercase tracking-widest"
            style={{
              color: tableStyles.toolbar_btn_text,
              borderColor: tableStyles.toolbar_btn_border,
              backgroundColor: tableStyles.toolbar_btn_bg,
              borderRadius: `${tableStyles.table_border_radius}px`,
            }}
          >
            <span className="border-r pr-3" style={{ borderColor: tableStyles.toolbar_btn_border }}>
              {filtered.length} records
            </span>
            <span className="font-mono">{fmt(total)}</span>
          </div>
        )}
      </div>

      {/* ── Table body ── */}
      {loading ? (
        <div
          className="flex justify-center items-center h-40 text-xs font-mono"
          style={{ color: tableStyles.td_text, backgroundColor: tableStyles.table_bg }}
        >
          <Search className="w-4 h-4 animate-spin mr-2" /> Loading records...
        </div>
      ) : error ? (
        <div
          className="flex justify-center items-center h-40 text-xs font-bold uppercase tracking-wider text-red-500"
          style={{ backgroundColor: tableStyles.table_bg }}
        >
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center h-40 gap-2"
          style={{ backgroundColor: tableStyles.table_bg }}
        >
          <span className="text-3xl grayscale opacity-30">📦</span>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: tableStyles.td_text }}>
            No SO records found
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto" style={{ backgroundColor: tableStyles.table_bg }}>
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.th_bg }}>
                {["Date Created", "Status", "SO Amount", "Company", "Contact Person", "Contact No.", "Remarks"].map((h) => (
                  <TableHead
                    key={h}
                    className="uppercase font-bold whitespace-nowrap"
                    style={{
                      color: tableStyles.th_text,
                      fontSize: `${tableStyles.th_font_size}px`,
                      padding: `${tableStyles.th_padding}px 12px`,
                      borderColor: tableStyles.th_border,
                      backgroundColor: tableStyles.th_bg,
                    }}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginated.map((item) => (
                <TableRow
                  key={item.id}
                  style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.table_bg }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.tr_hover_bg; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.table_bg; }}
                >
                  <TableCell style={tdStyle}>{fmtDate(item.date_created)}</TableCell>
                  <TableCell style={tdStyle}>
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter bg-zinc-100 text-zinc-600 border border-zinc-200"
                      style={{
                        borderRadius: `${tableStyles.table_border_radius}px`,
                      }}>
                      {item.status || "—"}
                    </span>
                  </TableCell>
                  <TableCell style={tdStyle}>{item.so_amount != null ? fmt(item.so_amount) : "—"}</TableCell>
                  <TableCell style={tdStyle}>{item.company_name || "—"}</TableCell>
                  <TableCell style={tdStyle}>{item.contact_person || "—"}</TableCell>
                  <TableCell style={tdStyle}>{item.contact_number || "—"}</TableCell>
                  <TableCell style={tdStyle}>{item.remarks || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>

            <TableFooter>
              <TableRow style={{ backgroundColor: tableStyles.tfoot_bg, borderColor: tableStyles.tfoot_border }}>
                <TableCell
                  colSpan={2}
                  className="uppercase tracking-wider"
                  style={{ color: tableStyles.tfoot_text, fontSize: `${tableStyles.tfoot_font_size}px`, padding: `${tableStyles.tfoot_padding}px 12px` }}
                >
                  Total ({filtered.length})
                </TableCell>
                <TableCell
                  style={{ color: tableStyles.tfoot_text, fontSize: `${tableStyles.tfoot_font_size}px`, padding: `${tableStyles.tfoot_padding}px 12px` }}
                >
                  {fmt(total)}
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
  );
};

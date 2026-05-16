"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search } from "lucide-react";
import { supabase } from "@/utils/supabase";
import ExcelJS from "exceljs";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SI {
  id: number;
  actual_sales?: number;
  dr_number?: string;
  remarks?: string;
  company_name?: string;
  contact_number?: string;
  contact_person?: string;
  type_activity: string;
  status: string;
  delivery_date?: string;
  si_date?: string;
  so_number?: string;
  payment_terms?: string;
}

interface SIProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "PHP" });

const fmtDate = (dateStr?: string | null): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime()) || d.getTime() === new Date("1970-01-01T00:00:00Z").getTime()) return "—";
  return d.toLocaleDateString();
};

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const inDateRange = (dateStr: string | null | undefined, range: any): boolean => {
  if (!range?.from && !range?.to) return true;
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const from = range.from ? new Date(range.from) : null;
  const to = range.to ? new Date(range.to) : null;
  if (from && to && isSameDay(from, to)) return isSameDay(date, from);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const SITable: React.FC<SIProps> = ({ referenceid, dateCreatedFilterRange }) => {
  const [activities, setActivities] = useState<SI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterPaymentTerms, setFilterPaymentTerms] = useState("all");
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
      .then(async (res) => { if (!res.ok) throw new Error("Failed to fetch"); return res.json(); })
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
        const n = payload.new as SI;
        const o = payload.old as SI;
        setActivities((curr) => {
          switch (payload.eventType) {
            case "INSERT": return curr.some((a) => a.id === n.id) ? curr : [...curr, n];
            case "UPDATE": return curr.map((a) => (a.id === n.id ? n : a));
            case "DELETE": return curr.filter((a) => a.id !== o.id);
            default: return curr;
          }
        });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [referenceid, fetchActivities]);

  // ── Derived ────────────────────────────────────────────────────────────────

  // Payment terms options from actual data
  const paymentTermsOptions = useMemo(() =>
    Array.from(new Set(
      activities
        .filter((a) => a.type_activity?.toLowerCase() === "delivered / closed transaction")
        .map((a) => a.payment_terms)
        .filter(Boolean) as string[]
    )).sort(),
    [activities]
  );

  const filteredActivities = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return activities
      .filter((i) => i.type_activity?.toLowerCase() === "delivered / closed transaction")
      .filter((i) => !s || [i.company_name, i.dr_number, i.so_number, i.remarks].some((v) => v?.toLowerCase().includes(s)))
      .filter((i) => filterPaymentTerms === "all" || i.payment_terms === filterPaymentTerms)
      .filter((i) => inDateRange(i.delivery_date, dateCreatedFilterRange))
      .sort((a, b) => new Date(b.delivery_date || 0).getTime() - new Date(a.delivery_date || 0).getTime());
  }, [activities, searchTerm, filterPaymentTerms, dateCreatedFilterRange]);

  const totalSales = useMemo(() =>
    filteredActivities.reduce((a, i) => a + (i.actual_sales ?? 0), 0),
    [filteredActivities]
  );

  const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);
  const paginated = useMemo(() =>
    filteredActivities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredActivities, page]
  );

  useEffect(() => { setPage(1); }, [searchTerm, filterPaymentTerms, dateCreatedFilterRange]);

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
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-50"
            style={{ color: tableStyles.toolbar_input_text }} />
          <Input
            type="text"
            placeholder="Search..."
            className="h-8 text-[10px] rounded-none pl-8 uppercase tracking-widest border-0 focus-visible:ring-0"
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

        {/* Payment Terms filter */}
        <Select value={filterPaymentTerms} onValueChange={setFilterPaymentTerms}>
          <SelectTrigger
            className="h-8 w-[180px] text-[10px] font-bold uppercase tracking-widest rounded-none border"
            style={{
              color: tableStyles.toolbar_btn_text,
              borderColor: tableStyles.toolbar_btn_border,
              backgroundColor: tableStyles.toolbar_btn_bg,
              borderRadius: `${tableStyles.table_border_radius}px`,
            }}
          >
            <SelectValue placeholder="Payment Terms" />
          </SelectTrigger>
          <SelectContent style={{ borderRadius: tableStyles.table_border_radius, }}>
            <SelectItem value="all" className="text-[10px] font-bold uppercase tracking-widest">
              All Payment Terms
            </SelectItem>
            {paymentTermsOptions.map((s) => (
              <SelectItem key={s} value={s} className="text-[10px] font-bold uppercase tracking-widest">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Record count */}
        {filteredActivities.length > 0 && (
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
              {filteredActivities.length} records
            </span>
            <span className="font-mono">{fmt(totalSales)}</span>
          </div>
        )}
      </div>

      {/* ── Table body ── */}
      {loading ? (
        <div className="flex justify-center items-center h-40 text-xs font-mono"
          style={{ color: tableStyles.td_text, backgroundColor: tableStyles.table_bg }}>
          <Search className="w-4 h-4 animate-spin mr-2" /> Loading records...
        </div>
      ) : error ? (
        <div className="flex justify-center items-center h-40 text-xs font-bold uppercase tracking-wider text-red-500"
          style={{ backgroundColor: tableStyles.table_bg }}>
          {error}
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2"
          style={{ backgroundColor: tableStyles.table_bg }}>
          <span className="text-3xl grayscale opacity-30">🧾</span>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: tableStyles.td_text }}>
            No SI records found
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto" style={{ backgroundColor: tableStyles.table_bg }}>
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.th_bg }}>
                {["Delivery Date", "SI Date", "SI Amount", "SO Number", "DR Number",
                  "Company", "Contact Person", "Contact No.", "Remarks", "Payment Terms"].map((h) => (
                    <TableHead key={h}
                      className="uppercase font-bold whitespace-nowrap"
                      style={{
                        color: tableStyles.th_text,
                        fontSize: `${tableStyles.th_font_size}px`,
                        padding: `${tableStyles.th_padding}px 12px`,
                        borderColor: tableStyles.th_border,
                        backgroundColor: tableStyles.th_bg,
                      }}>
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
                  <TableCell style={tdStyle}>{fmtDate(item.delivery_date)}</TableCell>
                  <TableCell style={tdStyle}>{fmtDate(item.si_date)}</TableCell>
                  <TableCell style={tdStyle}>{item.actual_sales != null ? fmt(item.actual_sales) : "—"}</TableCell>
                  <TableCell style={tdStyle}>{item.so_number || "—"}</TableCell>
                  <TableCell style={tdStyle}>{item.dr_number || "—"}</TableCell>
                  <TableCell style={tdStyle}>{item.company_name || "—"}</TableCell>
                  <TableCell style={tdStyle}>{item.contact_person || "—"}</TableCell>
                  <TableCell style={tdStyle}>{item.contact_number || "—"}</TableCell>
                  <TableCell style={tdStyle}>{item.remarks || "—"}</TableCell>
                  <TableCell style={tdStyle}>{item.payment_terms || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>

            <TableFooter>
              <TableRow style={{
                backgroundColor: tableStyles.tfoot_bg,
                borderColor: tableStyles.tfoot_border,
              }}>
                <TableCell
                  colSpan={2}
                  className="uppercase tracking-wider"
                  style={{ color: tableStyles.tfoot_text, fontSize: `${tableStyles.tfoot_font_size}px`, padding: `${tableStyles.tfoot_padding}px 12px` }}
                >
                  Total ({filteredActivities.length})
                </TableCell>
                <TableCell
                  style={{ color: tableStyles.tfoot_text, fontSize: `${tableStyles.tfoot_font_size}px`, padding: `${tableStyles.tfoot_padding}px 12px` }}
                >
                  {fmt(totalSales)}
                </TableCell>
                <TableCell colSpan={7} />
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

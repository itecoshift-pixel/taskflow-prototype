"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, Download } from "lucide-react";
import ExcelJS from "exceljs";
import { supabase } from "@/utils/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CSR {
  id: number;
  quotation_amount?: number;
  ticket_reference_number?: string;
  remarks?: string;
  date_created: string;
  date_updated?: string;
  company_name?: string;
  contact_number?: string;
  contact_person?: string;
  type_client?: string;
  status: string;
}

interface CSRProps {
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

interface GroupedTicket {
  ticket: string;
  latest: CSR;
  total: number;
  count: number;
  items: CSR[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "PHP" });

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) || d.getTime() === new Date("1970-01-01T00:00:00Z").getTime() ? "—" : d.toLocaleDateString();
};

const fmtDateTime = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
};

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

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

// ─── Entries Dialog ───────────────────────────────────────────────────────────

function EntriesDialog({ open, onClose, group }: { open: boolean; onClose: () => void; group: GroupedTicket | null }) {
  if (!group) return null;
  const sorted = [...group.items].sort((a, b) => new Date(a.date_created).getTime() - new Date(b.date_created).getTime());
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full rounded-none border border-zinc-200 shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-xs font-bold text-zinc-800 uppercase tracking-widest">{group.ticket}</DialogTitle>
          <DialogDescription className="text-[10px] text-zinc-500 uppercase font-mono">
            {group.count} {group.count === 1 ? "entry" : "entries"} · {group.latest.company_name || "—"} · Total:{" "}
            <span className="font-bold text-zinc-900">{fmt(group.total)}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 rounded-none border border-zinc-200 overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50">
                {["#", "Date Created", "Amount", "Status", "Contact Person", "Remarks"].map((h) => (
                  <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-3 py-2.5">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((item, idx) => (
                <TableRow key={item.id} className="text-xs hover:bg-zinc-50/50 transition-colors border-b border-zinc-100 last:border-0">
                  <TableCell className="text-zinc-400 w-8 px-3 font-mono">{idx + 1}</TableCell>
                  <TableCell className="text-zinc-500 whitespace-nowrap px-3 font-mono text-[11px]">{fmtDateTime(item.date_created)}</TableCell>
                  <TableCell className="text-zinc-700 font-bold px-3">{item.quotation_amount != null ? fmt(item.quotation_amount) : "—"}</TableCell>
                  <TableCell className="px-3">
                    {item.status ? (
                      <span className="inline-block px-2 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-tighter bg-zinc-100 text-zinc-600 border border-zinc-200">{item.status}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-zinc-600 px-3 capitalize">{item.contact_person || "—"}</TableCell>
                  <TableCell className="capitalize text-zinc-500 px-3">{item.remarks || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot>
              <TableRow className="bg-zinc-50/50 font-bold text-[11px] border-t border-zinc-200">
                <TableCell colSpan={2} className="text-zinc-500 px-3 uppercase tracking-wider">
                  Total ({group.count} {group.count === 1 ? "entry" : "entries"})
                </TableCell>
                <TableCell className="text-zinc-900 px-3">{fmt(group.total)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </tfoot>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const CSRTable: React.FC<CSRProps> = ({ referenceid, dateCreatedFilterRange }) => {
  const [activities, setActivities] = useState<CSR[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selectedGroup, setSelectedGroup] = useState<GroupedTicket | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
    if (dateCreatedFilterRange?.from) url.searchParams.append("from", dateCreatedFilterRange.from);
    if (dateCreatedFilterRange?.to) url.searchParams.append("to", dateCreatedFilterRange.to);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "history", filter: `referenceid=eq.${referenceid}` }, (payload) => {
        const n = payload.new as CSR;
        const o = payload.old as CSR;
        setActivities((curr) => {
          switch (payload.eventType) {
            case "INSERT": return curr.some((a) => a.id === n.id) ? curr : [...curr, n];
            case "UPDATE": return curr.map((a) => (a.id === n.id ? n : a));
            case "DELETE": return curr.filter((a) => a.id !== o.id);
            default: return curr;
          }
        });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [referenceid, fetchActivities]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return activities
      .filter((i) => i.type_client?.toLowerCase() === "csr client")
      .filter((i) => !s || [i.company_name, i.ticket_reference_number, i.remarks].some((v) => v?.toLowerCase().includes(s)))
      .filter((i) => inDateRange(i.date_created, dateCreatedFilterRange))
      .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
  }, [activities, searchTerm, dateCreatedFilterRange]);

  const grouped = useMemo((): GroupedTicket[] => {
    const map = new Map<string, CSR[]>();
    filtered.forEach((i) => {
      const key = i.ticket_reference_number ?? "UNKNOWN";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    });
    return Array.from(map.entries()).map(([ticket, items]) => {
      const latest = items.reduce((prev, curr) =>
        new Date(curr.date_updated ?? curr.date_created).getTime() >
          new Date(prev.date_updated ?? prev.date_created).getTime() ? curr : prev
      );
      return { ticket, latest, total: items.reduce((a, i) => a + (i.quotation_amount ?? 0), 0), count: items.length, items };
    });
  }, [filtered]);

  const grandTotal = useMemo(() => grouped.reduce((a, g) => a + g.total, 0), [grouped]);
  const pageCount = Math.ceil(grouped.length / PAGE_SIZE);
  const paginated = useMemo(() => grouped.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [grouped, page]);

  useEffect(() => { setPage(1); }, [searchTerm, dateCreatedFilterRange]);

  const openDialog = (group: GroupedTicket) => { setSelectedGroup(group); setDialogOpen(true); };

  // ── Shared styles ──────────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Hint ── */}
      {grouped.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50/50 border border-indigo-100/50"
          style={{
            borderRadius: `${tableStyles.table_border_radius}px`,
          }}>
          <span className="text-xs">💡</span>
          <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">
            Click the <span className="underline underline-offset-2">entries</span> badge to view all records under a ticket.
          </p>
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
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-50"
              style={{ color: tableStyles.toolbar_input_text }}
            />
            <Input
              placeholder="Search company, ticket number, remarks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

          {/* Record count */}
          {grouped.length > 0 && (
            <div
              className="ml-auto flex items-center gap-3 px-3 py-1 border text-[10px] font-bold uppercase tracking-widest"
              style={{
                color: tableStyles.toolbar_btn_text,
                borderColor: tableStyles.toolbar_btn_border,
                backgroundColor: tableStyles.toolbar_btn_bg,
                borderRadius: `${tableStyles.table_border_radius}px`,
              }}
            >
              <span className="border-r pr-3"
                style={{ borderColor: tableStyles.toolbar_btn_border }}>
                {grouped.length} tickets
              </span>
              <span className="font-mono">{fmt(grandTotal)}</span>
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
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2"
            style={{ backgroundColor: tableStyles.table_bg }}>
            <span className="text-3xl grayscale opacity-30">🎫</span>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: tableStyles.td_text }}>
              No CSR records found
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ backgroundColor: tableStyles.table_bg }}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.th_bg }}>
                  {["Date Created", "Ticket No.", "Total Amount", "Entries", "Company", "Contact Person", "Contact No.", "Remarks"].map((h) => (
                    <TableHead key={h}
                      className="uppercase font-bold whitespace-nowrap"
                      style={{ color: tableStyles.th_text, fontSize: `${tableStyles.th_font_size}px`, padding: `${tableStyles.th_padding}px 12px`, borderColor: tableStyles.th_border, backgroundColor: tableStyles.th_bg }}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginated.map((group) => {
                  const { ticket, latest, total: rowTotal, count } = group;
                  return (
                    <TableRow
                      key={latest.id}
                      style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.table_bg }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.tr_hover_bg; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.table_bg; }}
                    >
                      <TableCell style={tdStyle} className="whitespace-nowrap font-mono">{fmtDate(latest.date_created)}</TableCell>
                      <TableCell style={tdStyle} className="uppercase font-bold">{ticket || "—"}</TableCell>
                      <TableCell style={tdStyle} className="font-bold">{fmt(rowTotal)}</TableCell>
                      <TableCell style={tdStyle}>
                        <button
                          onClick={() => openDialog(group)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-tighter bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all cursor-pointer shadow-sm"
                          style={{
                            borderRadius: `${tableStyles.table_border_radius}px`,
                          }}
                          title="Click to view all entries"
                        >
                          {count} {count === 1 ? "entry" : "entries"} ↗
                        </button>
                      </TableCell>
                      <TableCell style={tdStyle} className="font-bold">{latest.company_name || "—"}</TableCell>
                      <TableCell style={tdStyle} className="capitalize font-medium">{latest.contact_person || "—"}</TableCell>
                      <TableCell style={{ ...tdStyle }} className="font-mono text-[11px]">{latest.contact_number || "—"}</TableCell>
                      <TableCell style={tdStyle} className="capitalize truncate max-w-[200px]" title={latest.remarks || ""}>{latest.remarks || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

              <tfoot>
                <TableRow style={{ backgroundColor: tableStyles.tfoot_bg, borderColor: tableStyles.tfoot_border }}>
                  <TableCell colSpan={2} className="uppercase tracking-wider" style={tfootCellStyle}>
                    Total ({grouped.length} tickets)
                  </TableCell>
                  <TableCell style={tfootCellStyle}>{fmt(grandTotal)}</TableCell>
                  <TableCell colSpan={5} />
                </TableRow>
              </tfoot>
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

      {/* ── Entries Dialog ── */}
      <EntriesDialog open={dialogOpen} onClose={() => setDialogOpen(false)} group={selectedGroup} />
    </div>
  );
};

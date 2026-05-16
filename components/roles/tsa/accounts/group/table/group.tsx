"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  ColumnDef,
  flexRender,
  SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Eye,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import { type DateRange } from "react-day-picker";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Account {
  id: string;
  referenceid: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  delivery_address: string;
  region: string;
  type_client: string;
  date_created: string;
  status?: string;
  industry?: string;
}

interface GroupedAccounts {
  industry: string;
  accounts: Account[];
}

interface AccountsTableProps {
  posts: Account[];
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<
    React.SetStateAction<DateRange | undefined>
  >;
  groupedPosts?: GroupedAccounts[];
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: "asc" | "desc" | false }) {
  if (!direction) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-slate-400" />;
  if (direction === "asc") return <ArrowUp className="ml-1 h-3.5 w-3.5 text-slate-700" />;
  return <ArrowDown className="ml-1 h-3.5 w-3.5 text-slate-700" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AccountsTable({
  posts = [],
  groupedPosts,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
}: AccountsTableProps) {
  // ── State ──
  const [localPosts, setLocalPosts] = useState<Account[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupedAccounts | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [dialogSearch, setDialogSearch] = useState("");

  // ── Table styles from API ─────────────────────────────────────────────────
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

  // ── Effects ──
  useEffect(() => {
    setLocalPosts(posts);
  }, [posts]);

  useEffect(() => {
    if (!globalFilter) { setIsFiltering(false); return; }
    setIsFiltering(true);
    const t = setTimeout(() => setIsFiltering(false), 300);
    return () => clearTimeout(t);
  }, [globalFilter]);

  // ── Dialog actions ──
  const openGroupDialog = useCallback((group: GroupedAccounts) => {
    setSelectedGroup(group);
    setDialogSearch("");
    setIsDialogOpen(true);
  }, []);

  // ── Computed groups ──
  const computedGroupedPosts = useMemo<GroupedAccounts[]>(() => {
    if (groupedPosts && groupedPosts.length > 0) return groupedPosts;
    const map = new Map<string, Account[]>();
    localPosts.forEach((acc) => {
      const g = acc.industry ?? "Ungrouped";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(acc);
    });
    return Array.from(map.entries()).map(([industry, accounts]) => ({
      industry,
      accounts,
    }));
  }, [localPosts, groupedPosts]);

  const filteredGroupedPosts = useMemo(() => {
    return computedGroupedPosts
      .map(({ industry, accounts }) => {
        let filtered = accounts;

        if (globalFilter.trim()) {
          const gf = globalFilter.toLowerCase();
          filtered = filtered.filter((acc) =>
            Object.values(acc).some(
              (val) => val != null && String(val).toLowerCase().includes(gf)
            )
          );
        }

        if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
          const from = new Date(dateCreatedFilterRange.from).setHours(0, 0, 0, 0);
          const to = new Date(dateCreatedFilterRange.to).setHours(23, 59, 59, 999);
          filtered = filtered.filter((acc) => {
            const d = new Date(acc.date_created).getTime();
            return d >= from && d <= to;
          });
        }

        return { industry, accounts: filtered };
      })
      .filter((g) => g.accounts.length > 0);
  }, [computedGroupedPosts, globalFilter, dateCreatedFilterRange]);

  // ── Summary stats ──
  const totalAccounts = useMemo(
    () => filteredGroupedPosts.reduce((sum, g) => sum + g.accounts.length, 0),
    [filteredGroupedPosts]
  );

  // ── Columns ──
  const columns = useMemo<ColumnDef<GroupedAccounts>[]>(
    () => [
      {
        accessorKey: "industry",
        header: ({ column }) => (
          <button
            className="flex items-center uppercase tracking-wide"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Industry
            <SortIcon direction={column.getIsSorted()} />
          </button>
        ),
        cell: (info) => (
          <button
            style={{
              color: tableStyles.td_text,
              fontSize: `${tableStyles.td_font_size}px`,
              borderColor: tableStyles.td_border,
            }}
            onClick={() => openGroupDialog(info.row.original)}
          >
            {String(info.getValue())}
          </button>
        ),
      },
      {
        accessorFn: (row) => row.accounts.length,
        id: "number_of_companies",
        header: ({ column }) => (
          <button
            className="flex items-center uppercase tracking-wide"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Companies
            <SortIcon direction={column.getIsSorted()} />
          </button>
        ),
        cell: (info) => (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-none bg-slate-100 text-slate-700 text-sm font-semibold">
            {info.getValue() as number}
          </span>
        ),
      },
      {
        id: "region",
        header: () => (
          <span className="flex items-center uppercase tracking-wide">
            Regions
          </span>
        ),
        cell: (info) => {
          const regions = [
            ...new Set(
              info.row.original.accounts.map((a) => a.region).filter(Boolean)
            ),
          ];
          return (
            <div className="flex flex-wrap gap-1">
              {regions.slice(0, 3).map((r) => (
                <span
                  key={r}
                  className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-none"
                >
                  {r}
                </span>
              ))}
              {regions.length > 3 && (
                <span className="text-xs text-slate-400">+{regions.length - 3}</span>
              )}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: "action",
        header: () => (
          <span className="flex items-center uppercase tracking-wide">
            Action
          </span>
        ),
        cell: (info) => (
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer rounded-none text-xs h-8 gap-1.5 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
            onClick={() => openGroupDialog(info.row.original)}
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </Button>
        ),
        enableSorting: false,
      },
    ],
    [openGroupDialog]
  );

  const table = useReactTable({
    data: filteredGroupedPosts,
    columns,
    getRowId: (row) => row.industry,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    initialState: { pagination: { pageSize: 10 } },
  });

  // ── Dialog filtered accounts ──
  const dialogAccounts = useMemo(() => {
    if (!selectedGroup) return [];
    let list = selectedGroup.accounts;
    if (dialogSearch.trim()) {
      const s = dialogSearch.toLowerCase();
      list = list.filter(
        (a) =>
          a.company_name.toLowerCase().includes(s) ||
          a.contact_person.toLowerCase().includes(s) ||
          a.region?.toLowerCase().includes(s) ||
          a.email_address?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [selectedGroup, dialogSearch]);

  // ── Render ──
  return (
    <>
      {/* ── Header Controls ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search industries, companies..."
            className="pl-8 h-9 text-sm rounded-none border-slate-200"
          />
          {isFiltering && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-slate-400" />
          )}
          {globalFilter && !isFiltering && (
            <button
              onClick={() => setGlobalFilter("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: "Total Industries", value: filteredGroupedPosts.length, color: "bg-slate-50 border-slate-200 text-slate-700" },
          { label: "Total Companies", value: totalAccounts, color: "bg-blue-50 border-blue-200 text-blue-700" },
        ].map((card) => (
          <div key={card.label} className={`rounded-none border p-3 ${card.color}`}>
            <p className="text-xs font-medium opacity-70">{card.label}</p>
            <p className="text-2xl font-bold mt-0.5">{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div
        className="overflow-hidden border"
        style={{
          borderColor: tableStyles.table_border,
          borderRadius: `${tableStyles.table_border_radius}px`,
          backgroundColor: tableStyles.table_bg,
        }}
      >
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: tableStyles.th_border, backgroundColor: tableStyles.th_bg }}
        >
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: tableStyles.th_text }}
          >
            Industries
          </span>
          <Badge variant="outline" style={{
            color: tableStyles.th_text,
            fontSize: `${tableStyles.th_font_size}px`,
            padding: `${tableStyles.td_padding}px 16px`,
            borderColor: tableStyles.td_border,
          }} className="uppercase">
            {filteredGroupedPosts.length} groups
          </Badge>
        </div>

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow
                key={hg.id}
                style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.th_bg }}
              >
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="font-bold uppercase tracking-wider"
                    style={{
                      color: tableStyles.th_text,
                      fontSize: `${tableStyles.th_font_size}px`,
                      padding: `${tableStyles.th_padding}px 16px`,
                      borderColor: tableStyles.th_border,
                      backgroundColor: tableStyles.th_bg,
                    }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-12"
                  style={{ color: tableStyles.td_text }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No industries found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="transition-colors"
                  style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.table_bg }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.tr_hover_bg;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.table_bg;
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="align-top"
                      style={{
                        color: tableStyles.td_text,
                        fontSize: `${tableStyles.td_font_size}px`,
                        padding: `${tableStyles.td_padding}px 16px`,
                        borderColor: tableStyles.td_border,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* ── Pagination ── */}
        <div
          className="px-4 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ borderColor: tableStyles.th_border, backgroundColor: tableStyles.table_bg }}
        >
          <p className="text-xs text-slate-500">
            Page{" "}
            <span className="font-medium text-slate-700">
              {table.getState().pagination.pageIndex + 1}
            </span>{" "}
            of{" "}
            <span className="font-medium text-slate-700">
              {table.getPageCount() || 1}
            </span>{" "}
            · {filteredGroupedPosts.length} industries
          </p>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-none border-slate-200"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-none border-slate-200"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-none border-slate-200"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-none border-slate-200"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Drill-down Dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl rounded-none max-h-[90vh] flex flex-col p-0">
          {/* Dialog Header */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle style={{
                  color: tableStyles.td_text,
                  fontSize: `${tableStyles.td_font_size}px`,
                  padding: `${tableStyles.td_padding}px 16px`,
                  borderColor: tableStyles.td_border,
                }}>
                  <Building2 className="h-4 w-4 text-slate-500" />
                  {selectedGroup?.industry}
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedGroup?.accounts.length} companies in this industry
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Dialog Search */}
          <div className="px-6 py-3 border-b border-slate-100 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={dialogSearch}
                onChange={(e) => setDialogSearch(e.target.value)}
                placeholder="Search company, contact, region..."
                className="pl-8 h-8 text-xs rounded-none border-slate-200"
              />
            </div>
          </div>

          {/* Dialog Account List */}
          <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
            {dialogAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Building2 className="h-8 w-8 opacity-30 mb-2" />
                <p className="text-sm">No companies match your filters</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dialogAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="rounded-none border border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50 transition-colors p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        {/* Company name + type */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800 truncate">
                            {acc.company_name}
                          </span>
                          {acc.type_client && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-none">
                              {acc.type_client}
                            </span>
                          )}
                        </div>

                        {/* Reference ID */}
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">
                          {acc.referenceid}
                        </p>

                        {/* Details grid */}
                        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4">
                          {acc.contact_person && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 min-w-0">
                              <User className="h-3 w-3 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{acc.contact_person}</span>
                            </div>
                          )}
                          {acc.contact_number && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 min-w-0">
                              <Phone className="h-3 w-3 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{acc.contact_number}</span>
                            </div>
                          )}
                          {acc.email_address && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 min-w-0">
                              <Mail className="h-3 w-3 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{acc.email_address}</span>
                            </div>
                          )}
                          {acc.region && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 min-w-0">
                              <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{acc.region}</span>
                            </div>
                          )}
                        </div>

                        {/* Address */}
                        {acc.address && (
                          <p className="mt-1.5 text-xs text-slate-500 flex items-start gap-1.5">
                            <MapPin className="h-3 w-3 text-slate-300 flex-shrink-0 mt-0.5" />
                            <span>{acc.address}</span>
                          </p>
                        )}
                      </div>

                      {/* Date created */}
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-slate-400">Created</p>
                        <p className="text-xs font-medium text-slate-600 mt-0.5">
                          {acc.date_created
                            ? new Date(acc.date_created).toLocaleDateString("en-PH", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dialog Footer */}
          <div className="px-6 py-3 border-t border-slate-100 flex-shrink-0 flex items-center justify-between bg-slate-50 rounded-none">
            <p className="text-xs text-slate-500">
              Showing{" "}
              <span className="font-medium text-slate-700">{dialogAccounts.length}</span>{" "}
              of{" "}
              <span className="font-medium text-slate-700">
                {selectedGroup?.accounts.length}
              </span>{" "}
              companies
            </p>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 -none border-slate-200"
              onClick={() => setIsDialogOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
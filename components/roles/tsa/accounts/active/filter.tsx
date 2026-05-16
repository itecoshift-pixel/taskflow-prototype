"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Filter,
  ArrowUpAZ,
  ArrowDownAZ,
  CalendarArrowUp,
  CalendarArrowDown,
  X,
  CheckCircle2,
  Check,
  CalendarDays,
  MapPin,
  Factory,
  ChevronDown,
} from "lucide-react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AccountsActiveFilterProps {
  typeFilter: string;
  setTypeFilterAction: (value: string) => void;
  dateCreatedFilter: string | null;
  setDateCreatedFilterAction: (value: string | null) => void;
  alphabeticalFilter: string | null;
  setAlphabeticalFilterAction: (value: string | null) => void;
  regionFilter: string;
  setRegionFilterAction: (value: string) => void;
  industryFilter: string[];
  setIndustryFilterAction: (value: string[]) => void;
  nextAvailableDateRange: DateRange | undefined;
  setNextAvailableDateRangeAction: (value: DateRange | undefined) => void;
  posts: Array<{ region?: string; industry?: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "TOP 50", label: "Top 50" },
  { value: "NEXT 30", label: "Next 30" },
  { value: "BALANCE 20", label: "Balance 20" },
  { value: "CSR CLIENT", label: "CSR Client" },
  { value: "TSA CLIENT", label: "TSA Client" },
  { value: "NEW CLIENT", label: "New Client" },
];

const REGION_OPTIONS = [
  { value: "all", label: "All Regions" },
  { value: "North", label: "North" },
  { value: "South", label: "South" },
  { value: "East", label: "East" },
  { value: "West", label: "West" },
];

const INDUSTRY_OPTIONS = [
  { value: "all", label: "All Industries" },
  { value: "Technology", label: "Technology" },
  { value: "Finance", label: "Finance" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Manufacturing", label: "Manufacturing" },
];

/** Count how many filters are currently active */
function countActiveFilters(
  typeFilter: string,
  dateCreatedFilter: string | null,
  alphabeticalFilter: string | null,
  regionFilter: string,
  industryFilter: string[],
  nextAvailableDateRange: DateRange | undefined,
): number {
  let count = 0;
  if (typeFilter && typeFilter !== "all") count++;
  if (dateCreatedFilter) count++;
  if (alphabeticalFilter) count++;
  if (regionFilter && regionFilter !== "all") count++;
  if (industryFilter.length > 0) count++;
  if (nextAvailableDateRange?.from || nextAvailableDateRange?.to) count++;
  return count;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AccountsActiveFilter({
  typeFilter,
  setTypeFilterAction,
  dateCreatedFilter,
  setDateCreatedFilterAction,
  alphabeticalFilter,
  setAlphabeticalFilterAction,
  regionFilter,
  setRegionFilterAction,
  industryFilter,
  setIndustryFilterAction,
  nextAvailableDateRange,
  setNextAvailableDateRangeAction,
  posts,
}: AccountsActiveFilterProps) {
  const [open, setOpen] = useState(false);
  const [industryPopoverOpen, setIndustryPopoverOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

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
      .then((data) => {
        if (data?.table_styles) setTableStyles(data.table_styles);
      })
      .catch(() => { }); // silently fall back to defaults
  }, []);

  // Dynamic options from posts data
  const regionOptions = useMemo(() => {
    const regions = new Set<string>();
    posts.forEach((p) => { if (p.region) regions.add(p.region); });
    return ["all", ...Array.from(regions).sort()];
  }, [posts]);

  const industryOptions = useMemo(() => {
    const industries = new Set<string>();
    posts.forEach((p) => { if (p.industry) industries.add(p.industry); });
    return Array.from(industries).sort();
  }, [posts]);

  const activeCount = countActiveFilters(
    typeFilter,
    dateCreatedFilter,
    alphabeticalFilter,
    regionFilter,
    industryFilter,
    nextAvailableDateRange
  );
  const hasActiveFilters = activeCount > 0;

  const handleClearAll = () => {
    setTypeFilterAction("all");
    setDateCreatedFilterAction(null);
    setAlphabeticalFilterAction(null);
    setRegionFilterAction("all");
    setIndustryFilterAction([]);
    setNextAvailableDateRangeAction(undefined);
  };

  const toggleIndustry = (industry: string) => {
    if (industryFilter.includes(industry)) {
      setIndustryFilterAction(industryFilter.filter((i) => i !== industry));
    } else {
      setIndustryFilterAction([...industryFilter, industry]);
    }
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setNextAvailableDateRangeAction(range);
    if (range?.from && range?.to) {
      setDatePopoverOpen(false);
    }
  };

  const formatDateRange = () => {
    if (!nextAvailableDateRange?.from) return "Select date range";
    const from = format(nextAvailableDateRange.from, "MMM d");
    const to = nextAvailableDateRange.to ? format(nextAvailableDateRange.to, "MMM d") : "...";
    return `${from} - ${to}`;
  };

  // FIX: toggle date filter — cycling asc → desc → null instead of only asc/desc
  const handleToggleDateFilter = () => {
    if (!dateCreatedFilter) setDateCreatedFilterAction("asc");
    else if (dateCreatedFilter === "asc") setDateCreatedFilterAction("desc");
    else setDateCreatedFilterAction(null);
  };

  return (
    <>
      {/* ── Trigger Button ───────────────────────────────────────────────── */}
      <div className="relative inline-flex">
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          aria-label="Open filters"
          className="cursor-pointer h-8 text-xs font-semibold shrink-0 shadow-sm"
          style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
        >
          <Filter className="h-3.5 w-3.5" />
          Advanced Filter
        </Button>

        {/* Active filter badge */}
        {hasActiveFilters && (
          <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-zinc-900 text-white text-[9px] font-bold flex items-center justify-center pointer-events-none">
            {activeCount}
          </span>
        )}
      </div>

      {/* ── Filter Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 overflow-hidden !w-[95vw] !max-w-[480px] gap-0 border-0 shadow-2xl"
          style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>

          {/* Header */}
          <div className="bg-zinc-900 px-6 pt-5 pb-4">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="bg-white/10 rounded-full p-1.5">
                  <Filter className="h-3.5 w-3.5 text-white" />
                </div>
                <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">
                  Filters
                </DialogTitle>
                {hasActiveFilters && (
                  <span className="ml-auto text-[10px] bg-white/20 text-white px-2 py-0.5 rounded font-semibold">
                    {activeCount} active
                  </span>
                )}
              </div>
            </DialogHeader>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5">

            {/* Type Client */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2">
                Type Client
              </label>
              <Select value={typeFilter} onValueChange={setTypeFilterAction}>
                <SelectTrigger className="w-full text-xs"
                  style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Region Filter */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" /> Region
                </span>
              </label>
              <Select value={regionFilter} onValueChange={setRegionFilterAction}>
                <SelectTrigger className="w-full text-xs" style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {regionOptions.map((opt) => (
                    <SelectItem key={opt} value={opt} className="text-xs">
                      {opt === "all" ? "All Regions" : opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Industry Multi-Select */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2">
                <span className="flex items-center gap-1.5">
                  <Factory className="h-3 w-3" /> Industry
                </span>
              </label>
              <Popover open={industryPopoverOpen} onOpenChange={setIndustryPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full  text-xs justify-between h-9"
                    style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
                  >
                    <span className={industryFilter.length > 0 ? "text-zinc-900" : "text-zinc-400"}>
                      {industryFilter.length > 0
                        ? `${industryFilter.length} selected`
                        : "All Industries"}
                    </span>
                    <ChevronDown className="h-3 w-3 text-zinc-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start" >
                  <Command>
                    <CommandInput placeholder="Search industries..." className="text-xs" />
                    <CommandList className="max-h-48">
                      <CommandEmpty className="text-xs py-2 px-3">No industries found.</CommandEmpty>
                      <CommandGroup>
                        {industryOptions.map((industry) => (
                          <CommandItem
                            key={industry}
                            onSelect={() => toggleIndustry(industry)}
                            className="text-xs cursor-pointer"
                          >
                            <div className="flex items-center gap-2 w-full">
                              <div
                                className={`h-4 w-4 border rounded flex items-center justify-center ${industryFilter.includes(industry)
                                  ? "bg-zinc-900 border-zinc-900"
                                  : "border-zinc-300"
                                  }`}
                              >
                                {industryFilter.includes(industry) && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </div>
                              <span className="flex-1">{industry.replace(/_/g, " ")}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  {industryFilter.length > 0 && (
                    <div className="border-t border-zinc-100 p-2">
                      <button
                        type="button"
                        onClick={() => setIndustryFilterAction([])}
                        className="text-[10px] text-zinc-500 hover:text-zinc-900 underline"
                      >
                        Clear selection
                      </button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {industryFilter.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {industryFilter.map((ind) => (
                    <Badge
                      key={ind}
                      variant="outline"
                      className="rounded-none text-[10px] py-0 px-1.5 cursor-pointer hover:bg-zinc-100"
                      onClick={() => toggleIndustry(ind)}
                    >
                      {ind.replace(/_/g, " ")} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Next Available Date Range */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3" /> Next Available Date
                </span>
              </label>
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full text-xs justify-between h-9 ${nextAvailableDateRange?.from ? "text-zinc-900" : "text-zinc-400"
                      }`}
                    style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
                  >
                    <span>{formatDateRange()}</span>
                    <CalendarDays className="h-3 w-3 text-zinc-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-none" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={nextAvailableDateRange?.from}
                    selected={nextAvailableDateRange}
                    onSelect={handleDateRangeSelect}
                    numberOfMonths={2}
                  />
                  {nextAvailableDateRange?.from && (
                    <div className="border-t border-zinc-100 p-2 flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500">
                        {nextAvailableDateRange.to
                          ? `${format(nextAvailableDateRange.from, "MMM d, yyyy")} - ${format(nextAvailableDateRange.to, "MMM d, yyyy")}`
                          : `From ${format(nextAvailableDateRange.from, "MMM d, yyyy")}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setNextAvailableDateRangeAction(undefined)}
                        className="text-[10px] text-zinc-500 hover:text-zinc-900 underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-100" />

            {/* Sort & Date filters */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block mb-3">
                Sort &amp; Order
              </label>

              <div className="space-y-2">
                {/* Alphabetical */}
                <div>
                  <p className="text-[10px] text-zinc-400 mb-1.5">Alphabetical</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { value: "none", label: "None", icon: null },
                      { value: "asc", label: "A → Z", icon: <ArrowUpAZ className="h-3 w-3" /> },
                      { value: "desc", label: "Z → A", icon: <ArrowDownAZ className="h-3 w-3" /> },
                    ].map((opt) => {
                      const current = alphabeticalFilter ?? "none";
                      const isActive = current === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setAlphabeticalFilterAction(opt.value === "none" ? null : opt.value)
                          }
                          className={`
                            flex items-center justify-center gap-1.5 px-2 py-2
                            text-[11px] font-medium border transition-colors
                            ${isActive
                              ? "bg-zinc-900 text-white border-zinc-900"
                              : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                            }
                          `}
                          style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date Created */}
                <div>
                  <p className="text-[10px] text-zinc-400 mb-1.5">Date Created</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { value: null, label: "None", icon: null },
                      { value: "asc", label: "Oldest", icon: <CalendarArrowUp className="h-3 w-3" /> },
                      { value: "desc", label: "Newest", icon: <CalendarArrowDown className="h-3 w-3" /> },
                    ].map((opt) => {
                      const isActive = dateCreatedFilter === opt.value;
                      return (
                        <button
                          key={opt.value ?? "none"}
                          type="button"
                          onClick={() => setDateCreatedFilterAction(opt.value)}
                          className={`
                            flex items-center justify-center gap-1.5 px-2 py-2
                            text-[11px] font-medium border transition-colors
                            ${isActive
                              ? "bg-zinc-900 text-white border-zinc-900"
                              : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                            }
                          `}
                          style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Active filters summary */}
            {hasActiveFilters && (
              <div className="bg-zinc-50 border border-zinc-200 px-3 py-2 flex items-center gap-2"
                style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
                <CheckCircle2 className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                <p className="text-xs text-zinc-600 flex-1">
                  {activeCount} filter{activeCount > 1 ? "s" : ""} active
                </p>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[10px] text-zinc-500 hover:text-zinc-900 underline font-medium"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t border-zinc-100 flex gap-2">
            {hasActiveFilters && (
              <Button
                variant="outline"
                className="flex-1 text-xs h-10 border-zinc-200"
                style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
                onClick={handleClearAll}
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Clear All
              </Button>
            )}
            <Button
              className="flex-1 text-xs h-10 bg-zinc-900 hover:bg-zinc-800"
              style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
              onClick={() => setOpen(false)}
            >
              Apply Filters
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </>
  );
}
"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X, CheckCircle2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskListDialogProps {
  filterStatus: string;
  filterTypeActivity: string;
  filterSource: string;
  filterTypeClient: string;
  filterCallStatus: string;
  filterQuotationStatus: string;
  setFilterStatus: React.Dispatch<React.SetStateAction<string>>;
  setFilterTypeActivity: React.Dispatch<React.SetStateAction<string>>;
  setFilterSource: React.Dispatch<React.SetStateAction<string>>;
  setFilterTypeClient: React.Dispatch<React.SetStateAction<string>>;
  setFilterCallStatus: React.Dispatch<React.SetStateAction<string>>;
  setFilterQuotationStatus: React.Dispatch<React.SetStateAction<string>>;
  statusOptions: string[];
  typeActivityOptions: string[];
  sourceOptions: string[];
  typeClientOptions: string[];
  callStatusOptions: string[];
  quotationStatusOptions: string[];
  itemsPerPage: number;
  setItemsPerPage: React.Dispatch<React.SetStateAction<number>>;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

// ─── Status color map ─────────────────────────────────────────────────────────

function getStatusDot(status: string): string {
  switch (status) {
    case "Delivered":   return "bg-emerald-500";
    case "SO-Done":     return "bg-amber-400";
    case "Quote-Done":  return "bg-blue-600";
    case "On Progress":
    case "Assisted":    return "bg-orange-500";
    case "Cancelled":   return "bg-red-600";
    case "Completed":   return "bg-teal-600";
    case "Pending":     return "bg-slate-400";
    default:            return "bg-zinc-400";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100, 200, 500];

export const TaskListDialog: React.FC<TaskListDialogProps> = ({
  filterStatus,
  filterTypeActivity,
  filterSource,
  filterTypeClient,
  filterCallStatus,
  filterQuotationStatus,
  setFilterStatus,
  setFilterTypeActivity,
  setFilterSource,
  setFilterTypeClient,
  setFilterCallStatus,
  setFilterQuotationStatus,
  statusOptions,
  typeActivityOptions,
  sourceOptions,
  typeClientOptions,
  callStatusOptions,
  quotationStatusOptions,
  itemsPerPage,
  setItemsPerPage,
  setCurrentPage,
}) => {
  const [open, setOpen] = useState(false);

  const activeCount =
    (filterStatus !== "all" ? 1 : 0) +
    (filterTypeActivity !== "all" ? 1 : 0) +
    (filterSource !== "all" ? 1 : 0) +
    (filterTypeClient !== "all" ? 1 : 0) +
    (filterCallStatus !== "all" ? 1 : 0) +
    (filterQuotationStatus !== "all" ? 1 : 0) +
    (itemsPerPage !== 10 ? 1 : 0); // Default is 10

  const hasActiveFilters = activeCount > 0;

  const handleClearAll = () => {
    setFilterStatus("all");
    setFilterTypeActivity("all");
    setFilterSource("all");
    setFilterTypeClient("all");
    setFilterCallStatus("all");
    setFilterQuotationStatus("all");
    setItemsPerPage(10);
  };

  return (
    <>
      {/* ── Trigger button ───────────────────────────────────────────── */}
      <div className="relative inline-flex items-center gap-2 pr-2">
        <Button
          variant="outline"
          size="sm"
          aria-label="Open filters"
          className="rounded-full h-9 w-9 p-0 relative border-zinc-200 bg-white hover:bg-zinc-50 transition-all shadow-sm active:scale-95"
          onClick={() => setOpen(true)}
        >
          <Filter className="h-4 w-4 text-zinc-600" />
        </Button>
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Advance Filter</span>

        {/* Active filter badge */}
        {hasActiveFilters && (
          <span className="absolute -top-1.5 -left-1.5 h-5 w-5 rounded-full bg-zinc-900 text-white text-[9px] font-bold flex items-center justify-center pointer-events-none shadow-md">
            {activeCount}
          </span>
        )}
      </div>

      {/* ── Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-sm rounded-2xl p-0 overflow-hidden gap-0 border-none shadow-2xl">

          {/* Header */}
          <div className="bg-white px-6 pt-6 pb-4 border-b border-zinc-100">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-zinc-100 rounded-full p-2">
                  <Filter className="h-4 w-4 text-zinc-900" />
                </div>
                <DialogTitle className="text-zinc-900 text-sm font-bold tracking-tight">
                  Filter Activities
                </DialogTitle>
                {hasActiveFilters && (
                  <span className="ml-auto text-[10px] bg-zinc-900 text-white px-2.5 py-1 rounded-full font-bold shadow-sm">
                    {activeCount} active
                  </span>
                )}
              </div>
              <DialogDescription className="text-zinc-500 text-xs font-medium">
                Adjust your view by status, type, and more.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Body - 2 Column Grid */}
          <div className="px-6 py-6 bg-white">
            <div className="grid grid-cols-2 gap-5 mb-6">

              {/* Status filter - only show if has options */}
              {statusOptions.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2 ml-1">
                    Status
                  </label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full rounded-full text-xs h-9 border-zinc-200 bg-zinc-50/50 focus:ring-zinc-200">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all" className="text-xs">All</SelectItem>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status} className="text-xs">
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${getStatusDot(status)}`} />
                            {status.replace("-", " ")}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Activity type filter - only show if has options */}
              {typeActivityOptions.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2 ml-1">
                    Activity Type
                  </label>
                  <Select value={filterTypeActivity} onValueChange={setFilterTypeActivity}>
                    <SelectTrigger className="w-full rounded-full text-xs h-9 border-zinc-200 bg-zinc-50/50 focus:ring-zinc-200">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all" className="text-xs">All</SelectItem>
                      {typeActivityOptions.map((type) => (
                        <SelectItem key={type} value={type} className="text-xs">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Source filter - only show if has options */}
              {sourceOptions.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2 ml-1">
                    Source
                  </label>
                  <Select value={filterSource} onValueChange={setFilterSource}>
                    <SelectTrigger className="w-full rounded-full text-xs h-9 border-zinc-200 bg-zinc-50/50 focus:ring-zinc-200">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all" className="text-xs">All</SelectItem>
                      {sourceOptions.map((source) => (
                        <SelectItem key={source} value={source} className="text-xs">
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Type Client filter - only show if has options */}
              {typeClientOptions.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2 ml-1">
                    Client Type
                  </label>
                  <Select value={filterTypeClient} onValueChange={setFilterTypeClient}>
                    <SelectTrigger className="w-full rounded-full text-xs h-9 border-zinc-200 bg-zinc-50/50 focus:ring-zinc-200">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all" className="text-xs">All</SelectItem>
                      {typeClientOptions.map((type) => (
                        <SelectItem key={type} value={type} className="text-xs">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Call Status filter - only show if has options */}
              {callStatusOptions.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2 ml-1">
                    Call Status
                  </label>
                  <Select value={filterCallStatus} onValueChange={setFilterCallStatus}>
                    <SelectTrigger className="w-full rounded-full text-xs h-9 border-zinc-200 bg-zinc-50/50 focus:ring-zinc-200">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all" className="text-xs">All</SelectItem>
                      {callStatusOptions.map((status) => (
                        <SelectItem key={status} value={status} className="text-xs">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Quotation Status filter - only show if has options */}
              {quotationStatusOptions.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2 ml-1">
                    Quotation Status
                  </label>
                  <Select value={filterQuotationStatus} onValueChange={setFilterQuotationStatus}>
                    <SelectTrigger className="w-full rounded-full text-xs h-9 border-zinc-200 bg-zinc-50/50 focus:ring-zinc-200">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all" className="text-xs">All</SelectItem>
                      {quotationStatusOptions.map((status) => (
                        <SelectItem key={status} value={status} className="text-xs">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Rows per page - always show */}
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2 ml-1">
                  Rows Per Page
                </label>
                <Select 
                  value={String(itemsPerPage)} 
                  onValueChange={(val) => {
                    setItemsPerPage(Number(val));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-full rounded-full text-xs h-9 border-zinc-200 bg-zinc-50/50 focus:ring-zinc-200">
                    <SelectValue placeholder="10" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {ITEMS_PER_PAGE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-xs font-medium">
                        {n} items
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>

            {/* Active filters summary */}
            {hasActiveFilters && (
              <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-100 px-4 py-3 rounded-xl">
                <div className="bg-zinc-200 rounded-full p-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
                </div>
                <p className="text-xs text-zinc-600 flex-1 font-medium">
                  {activeCount} setting{activeCount > 1 ? "s" : ""} active
                </p>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[10px] text-zinc-400 hover:text-zinc-900 font-bold uppercase tracking-widest transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-5 border-t border-zinc-100 flex gap-3 bg-zinc-50/50">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                className="rounded-full flex-1 text-xs h-11 font-bold text-zinc-500 hover:bg-zinc-100"
                onClick={handleClearAll}
              >
                <X className="h-4 w-4 mr-2" />
                Reset
              </Button>
            )}
            <Button
              className="rounded-full flex-1 text-xs h-11 bg-zinc-900 hover:bg-zinc-800 font-bold text-white shadow-lg shadow-zinc-200"
              onClick={() => setOpen(false)}
            >
              Apply Filters
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </>
  );
};
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Camera, ChevronDown, ChevronUp } from "lucide-react";
import { type DateRange } from "react-day-picker";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimeLog = {
  Type: string;
  Status: string;
  date_created: string;
  Location: string;
  PhotoURL?: string;
};

type TimeLogProps = {
  timeLogs: TimeLog[];
  loadingLogs: boolean;
  errorLogs: string | null;
  dateCreatedFilterRange?: DateRange | undefined;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

// Filter a log entry against a DateRange
function inDateRange(dateStr: string, range: DateRange | undefined): boolean {
  if (!range?.from && !range?.to) return true;

  // date_created from MongoDB can be a Timestamp object or ISO string
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;

  const from = range?.from ? new Date(range.from) : null;
  const to = range?.to ? new Date(range.to) : null;

  // Single-day selection
  if (from && to && isSameDay(from, to)) return isSameDay(date, from);

  // Normalize to start/end of day for inclusive range
  if (from) {
    const startOfFrom = new Date(from);
    startOfFrom.setHours(0, 0, 0, 0);
    if (date < startOfFrom) return false;
  }
  if (to) {
    const endOfTo = new Date(to);
    endOfTo.setHours(23, 59, 59, 999);
    if (date > endOfTo) return false;
  }

  return true;
}

// ─── Type styles ──────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  "Time In": { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  "Time Out": { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-400" },
};

function getTypeStyle(type: string) {
  return TYPE_STYLES[type] ?? { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400" };
}

// ─── Log Row ──────────────────────────────────────────────────────────────────

function LogRow({ log, onView }: { log: TimeLog; onView: (log: TimeLog) => void }) {
  const [expanded, setExpanded] = useState(false);
  const style = getTypeStyle(log.Type);

  const [tableStyles, setTableStyles] = useState({
    table_border_radius: "16",
  });

  useEffect(() => {
    fetch("/api/table-styles")
      .then((res) => res.json())
      .then((data) => {
        if (data?.table_styles) setTableStyles(data.table_styles);
      })
      .catch(() => { }); // silently fall back to defaults
  }, []);

  return (
    <div className="border border-slate-200 overflow-hidden transition-shadow hover:shadow-sm"
      style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/60 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
          <span className={`text-[11px] font-bold uppercase tracking-wide ${style.text}`}>
            {log.Type}
          </span>
          <span className="text-[11px] text-slate-400 truncate">
            {fmtDateTime(log.date_created)}
          </span>
        </div>
        <span className="text-slate-400 shrink-0">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className={`border-t border-slate-100 px-4 py-3 space-y-2 ${style.bg}`}>
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <Clock size={11} className="text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-500 w-14 shrink-0">Status</span>
            <span>{log.Status || "—"}</span>
          </div>
          <div className="flex items-start gap-2 text-[11px] text-slate-600">
            <MapPin size={11} className="text-slate-400 shrink-0 mt-px" />
            <span className="font-semibold text-slate-500 w-14 shrink-0">Location</span>
            <span className="break-words">{log.Location || "—"}</span>
          </div>
          {log.PhotoURL && (
            <div className="flex items-center gap-2 text-[11px]">
              <Camera size={11} className="text-slate-400 shrink-0" />
              <button
                onClick={() => onView(log)}
                className="text-indigo-600 font-semibold hover:text-indigo-800 hover:underline transition-colors"
              >
                View Photo ↗
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TimeLogComponent({
  timeLogs,
  loadingLogs,
  errorLogs,
  dateCreatedFilterRange,
}: TimeLogProps) {
  const [selectedLog, setSelectedLog] = useState<TimeLog | null>(null);
  const [open, setOpen] = useState(false);

  const handleView = (log: TimeLog) => {
    setSelectedLog(log);
    setOpen(true);
  };

  // Apply date range filter — date_created is a MongoDB Timestamp (ISO string)
  const filteredLogs = useMemo(() => {
    if (!dateCreatedFilterRange?.from && !dateCreatedFilterRange?.to) return timeLogs;
    return timeLogs.filter((log) => inDateRange(log.date_created, dateCreatedFilterRange));
  }, [timeLogs, dateCreatedFilterRange]);

  const timeInCount = filteredLogs.filter((l) => l.Status === "Login").length;
  const timeOutCount = filteredLogs.filter((l) => l.Status === "Logout").length;

  const hasDateFilter = !!(dateCreatedFilterRange?.from || dateCreatedFilterRange?.to);
  const [tableStyles, setTableStyles] = useState({
    table_border_radius: "16",
  });

  return (
    <>
      <div className="space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Acculog</h2>
            {hasDateFilter && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                Filtered · {filteredLogs.length} of {timeLogs.length} logs
              </p>
            )}
          </div>
          {filteredLogs.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Badge className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                In: {timeInCount}
              </Badge>
              <Badge className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100">
                Out: {timeOutCount}
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        {loadingLogs ? (
          <div className="flex justify-center items-center h-24 text-xs text-slate-400">
            Loading logs...
          </div>
        ) : errorLogs ? (
          <div className="flex justify-center items-center h-24 text-xs text-red-500">
            {errorLogs}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-slate-300">
            <Clock size={28} strokeWidth={1} />
            <p className="text-xs font-medium">
              {hasDateFilter ? "No logs in selected date range" : "No time logs found"}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-auto pr-0.5">
            {filteredLogs.map((log, i) => (
              <LogRow key={i} log={log} onView={handleView} />
            ))}
          </div>
        )}
      </div>

      {/* ── Photo / Detail Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Clock size={14} className="text-indigo-500" />
              Time Log Details
            </DialogTitle>
            {selectedLog && (
              <DialogDescription className="text-xs text-slate-500">
                {selectedLog.Type} · {fmtDateTime(selectedLog.date_created)}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-3 py-1">
              <div className="border border-slate-200 bg-slate-50 divide-y divide-slate-100 overflow-hidden text-[11px]" style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span className="font-semibold text-slate-500 w-16 shrink-0">Type</span>
                  <span className={`font-bold uppercase ${getTypeStyle(selectedLog.Type).text}`}>
                    {selectedLog.Type}
                  </span>
                </div>
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span className="font-semibold text-slate-500 w-16 shrink-0">Status</span>
                  <span className="text-slate-700">{selectedLog.Status || "—"}</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span className="font-semibold text-slate-500 w-16 shrink-0">Date</span>
                  <span className="text-slate-700">{fmtDateTime(selectedLog.date_created)}</span>
                </div>
                <div className="flex items-start gap-3 px-4 py-2.5">
                  <span className="font-semibold text-slate-500 w-16 shrink-0 pt-px">Location</span>
                  <span className="text-slate-700 break-words leading-relaxed">
                    {selectedLog.Location || "—"}
                  </span>
                </div>
              </div>

              {selectedLog.PhotoURL ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                    <Camera size={11} /> Photo
                  </p>
                  <img
                    src={selectedLog.PhotoURL}
                    alt="Time Log Photo"
                    className="w-full rounded-xl border border-slate-200 object-cover max-h-64"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-20 gap-1.5 text-slate-300 rounded-xl border border-dashed border-slate-200">
                  <Camera size={20} strokeWidth={1} />
                  <p className="text-[11px]">No photo attached</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  CalendarDays,
  SlidersHorizontal,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CCGItem {
  id: number;
  activity_reference_number?: string;
  referenceid: string;
  tsm: string;
  manager: string;
  type_activity?: string;
  date_updated: string;
  date_created?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  company_name?: string;
  remarks?: string;
  // source discriminator added by the API (normalized)
  _source?: "history" | "meetings" | "documentation" | "spf_request";
}

interface Account {
  id: string;
  company_name: string;
  contact_person: string;
  type_client: string;
  next_available_date?: string;
  region?: string;
  industry?: string;
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTime(date: Date) {
  let h = date.getHours();
  const min = String(date.getMinutes()).padStart(2, "0");
  const sec = String(date.getSeconds()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min}:${sec} ${ampm}`;
}

function formatHourLabel(h: number) {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:00 ${ampm}`;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}


// Status badge styling
const STATUS_STYLES: Record<string, string> = {
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Pending: "bg-amber-100  text-amber-700  border-amber-200",
  Cancelled: "bg-red-100    text-red-700    border-red-200",
  Active: "bg-blue-100   text-blue-700   border-blue-200",
};

// Cluster config for scheduled accounts
const CLUSTER_CONFIG: Record<string, { color: string; bg: string; textColor: string }> = {
  "top 50": { color: "#f59e0b", bg: "#fef3c7", textColor: "#92400e" },
  "next 30": { color: "#3b82f6", bg: "#dbeafe", textColor: "#1e40af" },
  "balance 20": { color: "#8b5cf6", bg: "#ede9fe", textColor: "#5b21b6" },
  "new client": { color: "#10b981", bg: "#d1fae5", textColor: "#065f46" },
  "tsa client": { color: "#ef4444", bg: "#fee2e2", textColor: "#991b1b" },
  "csr client": { color: "#f97316", bg: "#ffedd5", textColor: "#9a3412" },
};

function getClusterStyle(typeClient: string) {
  return (
    CLUSTER_CONFIG[typeClient?.toLowerCase()] ?? {
      color: "#6b7280",
      bg: "#f3f4f6",
      textColor: "#374151",
    }
  );
}

// Helper function to calculate duration
function calculateDuration(startDate: Date, endDate: Date): string {
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const hours = Math.floor(diffSecs / 3600);
  const minutes = Math.floor((diffSecs % 3600) / 60);
  const seconds = diffSecs % 60;
  
  if (hours > 0) {
    if (minutes > 0 && seconds > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (seconds > 0) {
      return `${hours}h ${seconds}s`;
    } else {
      return `${hours}h`;
    }
  } else if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

// ─── Event Card ───────────────────────────────────────────────────────────────

const EventCard: React.FC<{ ev: CCGItem }> = ({ ev }) => {
  const isDocumentation = ev._source === "documentation";
  const isSpf = ev._source === "spf_request";
  const isMeeting = ev.type_activity === "Meeting" && ev.start_date && ev.end_date;
  const statusClass =
    STATUS_STYLES[ev.status ?? ""] ?? "bg-slate-100 text-slate-600 border-slate-200";

  let timeDisplay = null;

  if (isMeeting) {
    const startDate = parseDate(ev.start_date!);
    const endDate = parseDate(ev.end_date!);
    if (startDate && endDate) {
      timeDisplay = (
        <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
          <Clock size={10} />
          {formatTime(startDate)} - {formatTime(endDate)}
        </span>
      );
    }
  } else if (ev.start_date && ev.end_date) {
    const startDate = parseDate(ev.start_date);
    const endDate = parseDate(ev.end_date);
    if (startDate && endDate) {
      timeDisplay = (
        <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
          <Clock size={10} />
          Duration: {calculateDuration(startDate, endDate)}
        </span>
      );
    }
  } else {
    const eventDate = parseDate(ev.end_date || ev.start_date || ((isDocumentation || isSpf) ? ev.date_created : undefined));
    if (eventDate) {
      timeDisplay = (
        <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
          <Clock size={10} />
          {formatTime(eventDate)}
        </span>
      );
    }
  }

  return (
    <div className={`group relative rounded-xl border bg-white px-4 py-3 shadow-sm hover:shadow-md transition-all duration-150 ${isDocumentation ? "border-sky-400" : isSpf ? "border-purple-400" : "border-green-400"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isDocumentation && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-sky-100 text-sky-700 border border-sky-200 shrink-0">
                Doc
              </span>
            )}
            {isSpf && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-purple-100 text-purple-700 border border-purple-200 shrink-0">
                SPF
              </span>
            )}
            <p className="text-xs font-bold text-slate-800 truncate">
              {ev.company_name || "—"}
            </p>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            {ev.type_activity ?? ev.activity_reference_number ?? "—"}
          </p>
          {ev.remarks && (
            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 capitalize">
              {ev.remarks}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {!isMeeting && timeDisplay}
          {!isDocumentation && !isSpf && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${statusClass}`}
            >
              {ev.status || "—"}
            </span>
          )}
        </div>
      </div>
      {isMeeting && timeDisplay && (
        <div className={`mt-2 pt-2 border-t ${isDocumentation ? "border-sky-100" : isSpf ? "border-purple-100" : "border-green-100"}`}>
          {timeDisplay}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const CCG: React.FC<{
  referenceid: string;
  target_quota?: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
  accounts?: Account[];
}> = ({
  referenceid,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
  accounts = [],
}) => {
  const [activities, setActivities] = useState<CCGItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTypeActivity, setFilterTypeActivity] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showScheduledDialog, setShowScheduledDialog] = useState(false);

  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);

  const currentHourRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchActivities = useCallback(() => {
    if (!referenceid) {
      setActivities([]);
      return;
    }

    setLoading(true);
    setError(null);

    const from = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
      : null;
    const to = dateCreatedFilterRange?.to
      ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
      : null;

    const url = new URL(
      "/api/activity/tsa/calendar/fetch",
      window.location.origin
    );
    url.searchParams.append("referenceid", referenceid);
    if (from && to) {
      url.searchParams.append("from", from);
      url.searchParams.append("to", to);
    }

    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch activities");
        return res.json();
      })
      .then((data) => setActivities(data.activities || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [referenceid, dateCreatedFilterRange]);

  // ── Realtime ───────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchActivities();
    if (!referenceid) return;

    const handlePostgresChanges = (payload: any) => {
      const newRec = payload.new as CCGItem;
      const oldRec = payload.old as CCGItem;
      setActivities((curr) => {
        switch (payload.eventType) {
          case "INSERT":
            return curr.some((a) => a.id === newRec.id) ? curr : [...curr, newRec];
          case "UPDATE":
            return curr.map((a) => (a.id === newRec.id ? newRec : a));
          case "DELETE":
            return curr.filter((a) => a.id !== oldRec.id);
          default:
            return curr;
        }
      });
    };

    const historyChannel = supabase
      .channel(`public:history:referenceid=eq.${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "history",
          filter: `referenceid=eq.${referenceid}`,
        },
        handlePostgresChanges
      )
      .subscribe();

    const meetingsChannel = supabase
      .channel(`public:meetings:referenceid=eq.${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meetings",
          filter: `referenceid=eq.${referenceid}`,
        },
        handlePostgresChanges
      )
      .subscribe();

    const documentationChannel = supabase
      .channel(`public:documentation:referenceid=eq.${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documentation",
          filter: `referenceid=eq.${referenceid}`,
        },
        (payload: any) => {
          // Normalize documentation records to match CCGItem shape
          const normalize = (rec: any): CCGItem => ({
            ...rec,
            date_updated: rec.date_created,
            _source: "documentation" as const,
          });
          const newRec = payload.new ? normalize(payload.new) : null;
          const oldRec = payload.old as CCGItem;
          setActivities((curr) => {
            switch (payload.eventType) {
              case "INSERT":
                return newRec && curr.some((a) => a.id === newRec.id && a._source === "documentation")
                  ? curr
                  : newRec ? [...curr, newRec] : curr;
              case "UPDATE":
                return newRec
                  ? curr.map((a) => (a.id === newRec.id && a._source === "documentation" ? newRec : a))
                  : curr;
              case "DELETE":
                return curr.filter((a) => !(a.id === oldRec.id && a._source === "documentation"));
              default:
                return curr;
            }
          });
        }
      )
      .subscribe();

    const spfChannel = supabase
      .channel(`public:spf_request:referenceid=eq.${referenceid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "spf_request",
          filter: `referenceid=eq.${referenceid}`,
        },
        (payload: any) => {
          const normalize = (rec: any): CCGItem => ({
            ...rec,
            type_activity: "SPF Creation",
            activity_reference_number: rec.spf_number,
            company_name: rec.customer_name,
            remarks: [rec.special_instructions, rec.item_description].filter(Boolean).join(" | "),
            date_updated: rec.date_updated || rec.date_created,
            _source: "spf_request" as const,
          });
          const newRec = payload.new ? normalize(payload.new) : null;
          const oldRec = payload.old as CCGItem;
          setActivities((curr) => {
            switch (payload.eventType) {
              case "INSERT":
                return newRec && curr.some((a) => a.id === newRec.id && a._source === "spf_request")
                  ? curr
                  : newRec ? [...curr, newRec] : curr;
              case "UPDATE":
                return newRec
                  ? curr.map((a) => (a.id === newRec.id && a._source === "spf_request" ? newRec : a))
                  : curr;
              case "DELETE":
                return curr.filter((a) => !(a.id === oldRec.id && a._source === "spf_request"));
              default:
                return curr;
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(historyChannel);
      supabase.removeChannel(meetingsChannel);
      supabase.removeChannel(documentationChannel);
      supabase.removeChannel(spfChannel);
    };
  }, [referenceid, fetchActivities]);

  // ── Derived Data ───────────────────────────────────────────────────────────

  const sortedActivities = useMemo(
    () =>
      [...activities].sort((a, b) => {
        const aDateStr = (a._source === "documentation" || a._source === "spf_request")
          ? (a.date_created || a.date_updated)
          : (a.end_date || a.date_updated);
        const bDateStr = (b._source === "documentation" || b._source === "spf_request")
          ? (b.date_created || b.date_updated)
          : (b.end_date || b.date_updated);
        const aDate = parseDate(aDateStr);
        const bDate = parseDate(bDateStr);
        if (!aDate || !bDate) return 0;
        return bDate.getTime() - aDate.getTime();
      }),
    [activities]
  );

  const statusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          sortedActivities
            .map((a) => a.status)
            .filter((s): s is string => typeof s === "string" && s.length > 0)
        )
      ).sort(),
    [sortedActivities]
  );

  const typeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          sortedActivities
            .map((a) => a.type_activity)
            .filter((t): t is string => typeof t === "string" && t.length > 0)
        )
      ).sort(),
    [sortedActivities]
  );

  const filteredActivities = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return sortedActivities.filter((item) => {
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      if (
        filterTypeActivity !== "all" &&
        item.type_activity !== filterTypeActivity
      )
        return false;
      if (s) {
        const haystack = [
          item.company_name,
          item.type_activity,
          item.status,
          item.remarks,
          item.activity_reference_number,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(s)) return false;
      }
      return true;
    });
  }, [sortedActivities, searchTerm, filterStatus, filterTypeActivity]);

  const allEventsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    
    for (const item of sortedActivities) {
      // documentation and spf_request items use date_created; others use end_date or date_updated
      const dateStr = (item._source === "documentation" || item._source === "spf_request")
        ? (item.date_created || item.date_updated)
        : (item.end_date || item.date_updated);
      const eventDate = parseDate(dateStr);
      if (!eventDate) continue;
      
      const key = formatDateLocal(eventDate);
      map[key] = (map[key] ?? 0) + 1;
    }
    
    return map;
  }, [sortedActivities]);

  // ── Scheduled Accounts ───────────────────────────────────────────────────────
  const scheduledAccountsByDate = useMemo(() => {
    const map: Record<string, Account[]> = {};
    for (const account of accounts) {
      if (account.next_available_date) {
        const dateObj = new Date(account.next_available_date);
        if (!isNaN(dateObj.getTime())) {
          const key = formatDateLocal(dateObj);
          if (!map[key]) map[key] = [];
          map[key].push(account);
        }
      }
    }
    return map;
  }, [accounts]);

  const selectedDateAccounts = useMemo(() => {
    if (!selectedDate) return [];
    const selectedDateStr = formatDateLocal(selectedDate);
    return scheduledAccountsByDate[selectedDateStr] || [];
  }, [scheduledAccountsByDate, selectedDate]);

  const selectedDateStr = selectedDate ? formatDateLocal(selectedDate) : null;

  const selectedDayEvents = useMemo(() => {
    if (!selectedDateStr) return [];
    return filteredActivities.filter((item) => {
      const dateStr = (item._source === "documentation" || item._source === "spf_request")
        ? (item.date_created || item.date_updated)
        : (item.end_date || item.date_updated);
      const eventDate = parseDate(dateStr);
      return eventDate ? formatDateLocal(eventDate) === selectedDateStr : false;
    });
  }, [filteredActivities, selectedDateStr]);

  // ── Calendar helpers ───────────────────────────────────────────────────────

  const daysInMonth = useMemo(
    () => getDaysInMonth(currentYear, currentMonth),
    [currentYear, currentMonth]
  );
  const firstWeekday = useMemo(
    () => getFirstWeekday(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else setCurrentMonth((m) => m - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else setCurrentMonth((m) => m + 1);
    setSelectedDate(null);
  };

  const nowDate = new Date();
  const currentHour = nowDate.getHours();
  const isToday =
    selectedDate &&
    selectedDate.getDate() === nowDate.getDate() &&
    selectedDate.getMonth() === nowDate.getMonth() &&
    selectedDate.getFullYear() === nowDate.getFullYear();

  useEffect(() => {
    if (isToday && currentHourRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        currentHourRef.current.offsetTop - 40;
    }
  }, [selectedDate, isToday]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row gap-0 rounded-2xl overflow-hidden border border-green-400 shadow-lg bg-white min-h-[680px]">
      {/* ── LEFT: Calendar panel ── */}
      <div className="lg:w-[320px] shrink-0 border-r border-green-200 bg-white flex flex-col">
        {/* Month nav */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-green-50 transition-colors text-slate-500 hover:text-green-600"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-800 tracking-wide">
              {new Date(currentYear, currentMonth).toLocaleString("default", {
                month: "long",
              })}
            </p>
            <p className="text-xs text-slate-400">{currentYear}</p>
          </div>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-green-50 transition-colors text-slate-500 hover:text-green-600"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 px-4 mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div
              key={i}
              className="text-center text-[11px] font-bold text-slate-400 py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-y-0.5 px-4 pb-5">
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isSelected =
              selectedDate &&
              selectedDate.getDate() === day &&
              selectedDate.getMonth() === currentMonth &&
              selectedDate.getFullYear() === currentYear;
            const isTodayCell =
              day === today.getDate() &&
              currentMonth === today.getMonth() &&
              currentYear === today.getFullYear();
            const eventCount = allEventsByDate[dateKey] ?? 0;
            const scheduledCount = scheduledAccountsByDate[dateKey]?.length ?? 0;
            const hasEvents = eventCount > 0;
            const hasScheduled = scheduledCount > 0;

            return (
              <button
                key={day}
                type="button"
                onClick={() =>
                  setSelectedDate(new Date(currentYear, currentMonth, day))
                }
                className={`relative flex flex-col items-center justify-center rounded-xl h-10 w-full text-xs font-semibold transition-all duration-100
                  ${
                    isSelected
                      ? "bg-green-600 text-white shadow-md shadow-green-200"
                      : isTodayCell
                        ? "bg-green-50 text-green-700 ring-1 ring-green-300"
                        : "text-slate-700 hover:bg-green-50"
                  }`}
              >
                {day}
                {/* Event dots */}
                <div className="absolute bottom-1 flex gap-0.5">
                  {hasEvents && (
                    <span className={`w-1 h-1 rounded-full ${isSelected ? "bg-white/70" : "bg-green-400"}`} />
                  )}
                  {hasScheduled && (
                    <span className={`w-1 h-1 rounded-full ${isSelected ? "bg-purple-300" : "bg-purple-500"}`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Month summary */}
        <div className="mt-auto border-t border-green-200 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-500">
            <CalendarDays size={13} />
            <span className="text-xs">
              {new Date(currentYear, currentMonth).toLocaleString("default", {
                month: "long",
              })}{" "}
              total
            </span>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
              {Object.entries(allEventsByDate)
                .filter(([k]) =>
                  k.startsWith(
                    `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`
                  )
                )
                .reduce((acc, [, v]) => acc + v, 0)}{" "}
              events
            </Badge>
            <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-purple-200 text-purple-600">
              {Object.entries(scheduledAccountsByDate)
                .filter(([k]) =>
                  k.startsWith(
                    `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`
                  )
                )
                .reduce((acc, [, v]) => acc + v.length, 0)}{" "}
              scheduled
            </Badge>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Timeline panel ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Panel header */}
        <div className="border-b border-green-200 px-5 pt-4 pb-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                {selectedDate
                  ? selectedDate.toLocaleDateString("en-PH", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Select a date"}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedDate
                  ? `${selectedDayEvents.length} event${selectedDayEvents.length !== 1 ? "s" : ""}`
                  : "No date selected"}
                {selectedDate && selectedDateAccounts.length > 0 && (
                  <span className="ml-2 text-purple-600 font-medium">
                    · {selectedDateAccounts.length} scheduled
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors
                ${
                  showFilters
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-green-300 hover:text-green-600"
                }`}
            >
              <SlidersHorizontal size={12} />
              Filters
            </button>
          </div>

          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              placeholder="Search company, activity, remarks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50 border-green-200 focus:bg-white focus:border-green-400"
            />
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-7 w-[150px] text-xs border-green-200">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filterTypeActivity}
                onValueChange={setFilterTypeActivity}
              >
                <SelectTrigger className="h-7 w-[170px] text-xs border-green-200">
                  <SelectValue placeholder="All Activity Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activity Types</SelectItem>
                  {typeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(filterStatus !== "all" ||
                filterTypeActivity !== "all" ||
                searchTerm) && (
                <button
                  onClick={() => {
                    setFilterStatus("all");
                    setFilterTypeActivity("all");
                    setSearchTerm("");
                  }}
                  className="h-7 px-3 text-[11px] font-semibold text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* Timeline body */}
        <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
          {loading ? (
            <div className="flex items-center justify-center h-full py-20 text-slate-400 text-xs gap-2">
              <span className="animate-spin text-lg">⏳</span> Loading...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full py-20 text-red-400 text-xs">
              {error}
            </div>
          ) : !selectedDate ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300 py-20">
              <CalendarDays size={40} strokeWidth={1} />
              <p className="text-sm font-medium">Pick a day on the calendar</p>
            </div>
          ) : (
            <div className="px-4 py-3 space-y-0">
              {/* Scheduled Accounts Section */}
              {selectedDateAccounts.length > 0 && (
                <div className="mb-4 pb-4 border-b border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Scheduled Accounts ({selectedDateAccounts.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {selectedDateAccounts.slice(0, 2).map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-2 rounded-lg border border-green-100 bg-white hover:bg-green-50 transition-colors"
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-800 uppercase">
                            {account.company_name}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {account.contact_person}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] rounded-none"
                          style={{
                            borderColor: getClusterStyle(account.type_client).color + "40",
                            background: getClusterStyle(account.type_client).bg,
                            color: getClusterStyle(account.type_client).textColor,
                          }}
                        >
                          {account.type_client}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  {selectedDateAccounts.length > 2 && (
                    <button
                      onClick={() => setShowScheduledDialog(true)}
                      className="mt-2 w-full text-center text-[10px] text-purple-600 font-medium hover:text-purple-800 hover:underline transition-colors py-1"
                    >
                      View {selectedDateAccounts.length - 2} more...
                    </button>
                  )}
                </div>
              )}

              {/* Scheduled Accounts Dialog */}
              <Dialog open={showScheduledDialog} onOpenChange={setShowScheduledDialog}>
                <DialogContent className="w-full max-w-md rounded-none p-0 overflow-hidden gap-0">
                  <div className="bg-purple-900 px-6 py-4">
                    <DialogHeader>
                      <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Scheduled Accounts
                      </DialogTitle>
                    </DialogHeader>
                  </div>
                  <div className="px-6 py-4">
                    <p className="text-xs text-slate-500 mb-3">
                      {selectedDate?.toLocaleDateString("en-PH", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      <span className="ml-2 text-purple-600 font-semibold">
                        ({selectedDateAccounts.length} accounts)
                      </span>
                    </p>
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {selectedDateAccounts.map((account) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between p-3 border border-green-100 rounded-lg hover:bg-green-50 transition-colors"
                        >
                          <div>
                            <p className="text-xs font-semibold text-slate-800 uppercase">
                              {account.company_name}
                            </p>
                            <p className="text-[10px] text-slate-500">{account.contact_person}</p>
                            {account.industry && (
                              <p className="text-[9px] text-slate-400 mt-0.5">{account.industry}</p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[10px] rounded-none"
                            style={{
                              borderColor: getClusterStyle(account.type_client).color + "40",
                              background: getClusterStyle(account.type_client).bg,
                              color: getClusterStyle(account.type_client).textColor,
                            }}
                          >
                            {account.type_client}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="px-6 py-3 border-t border-green-100 bg-green-50 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-none text-xs"
                      onClick={() => setShowScheduledDialog(false)}
                    >
                      Close
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              {/* Simple timeline with all events */}
              {Array.from({ length: 24 }, (_, h) => h).map((hour) => {
                const isCurrentHour = !!isToday && hour === currentHour;
                const hourEvents = selectedDayEvents.filter((event) => {
                  const dateStr = event._source === "documentation"
                    ? (event.date_created || event.date_updated)
                    : (event.end_date || event.date_updated);
                  const eventDate = parseDate(dateStr);
                  return eventDate ? eventDate.getHours() === hour : false;
                });
                const hasEvents = hourEvents.length > 0;

                return (
                  <div
                    key={hour}
                    ref={isCurrentHour ? currentHourRef : null}
                    className={`flex gap-3 min-h-[48px] group ${isCurrentHour ? "relative" : ""}`}
                  >
                    <div className="flex flex-col items-center w-14 shrink-0 pt-1">
                      <span
                        className={`text-[10px] font-bold leading-none select-none ${isCurrentHour ? "text-green-600" : "text-slate-400"}`}
                      >
                        {formatHourLabel(hour)}
                      </span>
                      <div
                        className={`flex-1 w-px mt-1.5 ${isCurrentHour ? "bg-green-400" : hasEvents ? "bg-green-300" : "bg-green-100"}`}
                      />
                    </div>
                    <div className="flex-1 pb-2 pt-0.5 space-y-1.5">
                      {isCurrentHour && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-500 shadow-md shadow-green-300 animate-pulse" />
                          <span className="text-[10px] text-green-500 font-bold tracking-wider uppercase">
                            Now · {formatTime(nowDate)}
                          </span>
                        </div>
                      )}
                      {hasEvents ? (
                        hourEvents.map((event) => (
                          <EventCard key={event.id} ev={event} />
                        ))
                      ) : (
                        <div className="text-[11px] text-slate-200 pt-1 select-none">
                          â
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

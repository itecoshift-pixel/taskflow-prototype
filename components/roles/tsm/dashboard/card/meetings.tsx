"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { supabase } from "@/utils/supabase";
import { CalendarDays, Clock, ChevronDown, ChevronUp } from "lucide-react";

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture?: string;
}

interface Meeting {
  start_date?: string | null;
  end_date?: string | null;
  remarks?: string | null;
  type_activity?: string | null;
  date_created?: string | null;
}

interface Props {
  agents: Agent[];
  selectedAgent: string;
  dateCreatedFilterRange?: { from?: Date; to?: Date } | null;
  setDateCreatedFilterRangeAction?: (range: { from?: Date; to?: Date } | undefined) => void;
  formatDate?: (dateStr?: string | null) => string;
}

const defaultFormatDate = (dateStr?: string | null) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
};

const getDuration = (start?: string | null, end?: string | null): string => {
  if (!start || !end) return "—";
  const s = new Date(start), e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "—";
  const mins = Math.floor((e.getTime() - s.getTime()) / 60000);
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Use local date string comparison to avoid UTC offset issues (e.g. PH timezone)
const toLocalDateOnly = (dateStr?: string | null): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const todayLocalStr = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const isToday = (dateStr?: string | null): boolean =>
  !!dateStr && toLocalDateOnly(dateStr) === todayLocalStr();

const TYPE_COLORS: Record<string, string> = {
  "call": "bg-blue-100 text-blue-700",
  "visit": "bg-indigo-100 text-indigo-700",
  "demo": "bg-purple-100 text-purple-700",
  "follow-up": "bg-amber-100 text-amber-700",
  "meeting": "bg-green-100 text-green-700",
};

const getTypeColor = (type?: string | null) => {
  if (!type) return "bg-gray-100 text-gray-500";
  const key = type.toLowerCase();
  for (const [k, v] of Object.entries(TYPE_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "bg-gray-100 text-gray-600";
};

export function AgentMeetings({
  agents,
  selectedAgent,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
  formatDate,
}: Props) {
  const [agentMeetingMap, setAgentMeetingMap] = useState<Record<string, Meeting[]>>({});
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fmt = formatDate ?? defaultFormatDate;
  const hasDateRange = !!(dateCreatedFilterRange?.from);

  const toggleAgent = (refId: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      next.has(refId) ? next.delete(refId) : next.add(refId);
      return next;
    });
  };

  const fetchAllMeetingsForAgent = async (agentId: string): Promise<Meeting[]> => {
    let all: Meeting[] = [];
    let fromBatch = 0;
    const batch = 5000;

    const fromDateStr = dateCreatedFilterRange?.from ? dateCreatedFilterRange.from.toISOString().split("T")[0] : "";
    const toDateStr = dateCreatedFilterRange?.to ? dateCreatedFilterRange.to.toISOString().split("T")[0] : fromDateStr;

    while (true) {
      let queryBuilder = supabase
        .from("meetings")
        .select("*")
        .eq("referenceid", agentId)
        .order("date_created", { ascending: false });

      if (fromDateStr) queryBuilder = queryBuilder.gte("date_created", fromDateStr);
      if (toDateStr) {
        const d = new Date(toDateStr);
        d.setHours(23, 59, 59, 999);
        queryBuilder = queryBuilder.lte("date_created", d.toISOString());
      }

      const { data, error } = await queryBuilder.range(fromBatch, fromBatch + batch - 1);

      if (error || !data || data.length === 0) break;

      all = all.concat(data.map((row: any) => ({
        start_date: row.start_date ?? null,
        end_date: row.end_date ?? null,
        remarks: row.remarks ?? "—",
        type_activity: row.type_activity ?? "—",
        date_created: row.date_created ?? null,
      })));

      if (data.length < batch) break;
      fromBatch += batch;
    }

    return all;
  };

  useEffect(() => {
    if (!agents.length) return;

    setAgentMeetingMap({});
    setExpandedAgents(new Set());
    setLoading(true);

    const agentsToFetch = selectedAgent === "all"
      ? agents
      : agents.filter((a) => a.ReferenceID === selectedAgent);

    (async () => {
      for (const agent of agentsToFetch) {
        let meetings = await fetchAllMeetingsForAgent(agent.ReferenceID);

        // Filter: date range if set, otherwise only today
        if (hasDateRange) {
          const start = new Date(dateCreatedFilterRange!.from!);
          start.setHours(0, 0, 0, 0);
          const end = new Date(dateCreatedFilterRange!.to || dateCreatedFilterRange!.from!);
          end.setHours(23, 59, 59, 999);
          meetings = meetings.filter((m) => {
            if (!m.date_created) return false;
            const d = new Date(m.date_created);
            return d >= start && d <= end;
          });
        } else {
          meetings = meetings.filter((m) => isToday(m.date_created));
        }

        setAgentMeetingMap((prev) => ({ ...prev, [agent.ReferenceID]: meetings }));
      }
      setLoading(false);
    })();
  }, [agents, selectedAgent, dateCreatedFilterRange]);

  const agentsWithMeetings = useMemo(
    () => agents.filter(
      (a) => Array.isArray(agentMeetingMap[a.ReferenceID]) &&
        agentMeetingMap[a.ReferenceID].length > 0
    ),
    [agents, agentMeetingMap]
  );

  const totalMeetings = useMemo(
    () => agentsWithMeetings.reduce((sum, a) => sum + (agentMeetingMap[a.ReferenceID]?.length ?? 0), 0),
    [agentsWithMeetings, agentMeetingMap]
  );

  return (
    <Card className="rounded-xl border shadow-sm">
      {/* Header */}
      <CardHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Meetings</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {hasDateRange ? "Filtered by selected date range" : "Showing today's meetings"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
            {loading ? (
              <span className="text-gray-400">Loading...</span>
            ) : (
              <span><strong>{totalMeetings}</strong> meeting{totalMeetings !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {loading && (
          <div className="flex items-center justify-center py-10 text-xs text-gray-400">
            Loading meetings...
          </div>
        )}

        {!loading && agentsWithMeetings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-xs text-gray-400">
            <CalendarDays className="w-8 h-8 text-gray-200" />
            <p>{hasDateRange ? "No meetings found in selected date range." : "No meetings today."}</p>
          </div>
        )}

        {!loading && agentsWithMeetings.length > 0 && (
          <div className="space-y-3">
            {agentsWithMeetings.map((agent) => {
              const meetings = agentMeetingMap[agent.ReferenceID] || [];
              const isExpanded = expandedAgents.has(agent.ReferenceID);
              const shown = hasDateRange ? meetings : isExpanded ? meetings : meetings.slice(0, 1);
              const hasMore = !hasDateRange && meetings.length > 1;

              return (
                <div key={agent.ReferenceID} className="rounded-xl border border-gray-100 overflow-hidden">
                  {/* Agent row */}
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <img
                      src={agent.profilePicture || "/Taskflow.png"}
                      alt={`${agent.Firstname} ${agent.Lastname}`}
                      className="h-8 w-8 rounded-full object-cover border border-white shadow-sm flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 capitalize truncate">
                        {agent.Firstname} {agent.Lastname}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {meetings.length} meeting{meetings.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {hasMore && (
                      <button
                        onClick={() => toggleAgent(agent.ReferenceID)}
                        className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 font-medium transition"
                      >
                        {isExpanded ? (
                          <><ChevronUp className="w-3 h-3" /> Less</>
                        ) : (
                          <><ChevronDown className="w-3 h-3" /> +{meetings.length - 1} more</>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Meetings table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-white">
                          <TableHead className="text-[10px] text-gray-400 font-medium">Type</TableHead>
                          <TableHead className="text-[10px] text-gray-400 font-medium">Start</TableHead>
                          <TableHead className="text-[10px] text-gray-400 font-medium">End</TableHead>
                          <TableHead className="text-[10px] text-gray-400 font-medium">Duration</TableHead>
                          <TableHead className="text-[10px] text-gray-400 font-medium">Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shown.map((meeting, idx) => (
                          <TableRow key={idx} className="hover:bg-gray-50/50 text-xs font-mono">
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getTypeColor(meeting.type_activity)}`}>
                                {meeting.type_activity || "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-gray-600 whitespace-nowrap">
                              {fmt(meeting.start_date)}
                            </TableCell>
                            <TableCell className="text-gray-600 whitespace-nowrap">
                              {fmt(meeting.end_date)}
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1 text-gray-500">
                                <Clock className="w-3 h-3 text-gray-300" />
                                {getDuration(meeting.start_date, meeting.end_date)}
                              </span>
                            </TableCell>
                            <TableCell className="text-gray-400 max-w-[200px] truncate">
                              {meeting.remarks || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
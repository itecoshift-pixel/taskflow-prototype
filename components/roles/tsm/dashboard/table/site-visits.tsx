"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MapPin } from "lucide-react";

interface TaskLogItem {
  ReferenceID: string;
  Type: string;
  SiteVisitAccount?: string;
  Location?: string;
  date_created: string;
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture?: string;
}

interface SiteVisitsProps {
  agents: Agent[];
  dateCreatedFilterRange: { from?: Date; to?: Date } | null;
  referenceid: string; // TSM or Manager reference ID
  isManager?: boolean; // If true, referenceid is Manager ID
}

// Helper to get agent name
const getAgentName = (refId: string, agents: Agent[]) => {
  const agent = agents.find((a) => a.ReferenceID.toLowerCase() === refId.toLowerCase());
  return agent ? `${agent.Firstname} ${agent.Lastname}` : refId;
};

// Helper to get agent profile picture
const getAgentPicture = (refId: string, agents: Agent[]) => {
  const agent = agents.find((a) => a.ReferenceID.toLowerCase() === refId.toLowerCase());
  return agent?.profilePicture || "/Taskflow.png";
};

// Helper to check if agent exists in agents list
const agentExists = (refId: string, agents: Agent[]): boolean => {
  return agents.some((a) => a.ReferenceID.toLowerCase() === refId.toLowerCase());
};

// Extract date part only (YYYY-MM-DD)
const toDateKey = (dateStr: string): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const SiteVisits: React.FC<SiteVisitsProps> = ({
  agents,
  dateCreatedFilterRange,
  referenceid,
  isManager = false,
}) => {
  const [taskLogs, setTaskLogs] = useState<TaskLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Fetch TaskLog data from MongoDB
  useEffect(() => {
    if (!referenceid) return;

    const fetchTaskLogs = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = new URL("/api/tsm/tasklog/fetch", window.location.origin);
        if (isManager) {
          url.searchParams.append("manager", referenceid);
        } else {
          url.searchParams.append("tsm", referenceid);
        }
        url.searchParams.append("type", "Client Visit");
        
        // Only add date params if filter is set - use local date format to avoid timezone issues
        if (dateCreatedFilterRange?.from) {
          const fromDate = new Date(dateCreatedFilterRange.from);
          const fromStr = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}-${String(fromDate.getDate()).padStart(2, "0")}`;
          url.searchParams.append("from", fromStr);
        }
        if (dateCreatedFilterRange?.to) {
          const toDate = new Date(dateCreatedFilterRange.to);
          const toStr = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`;
          url.searchParams.append("to", toStr);
        }

        console.log("[Frontend] Fetching from:", url.toString());
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Failed to fetch task logs");
        
        const data = await res.json();
        console.log("[Frontend] Received taskLogs:", data.taskLogs?.length, data.taskLogs);
        setTaskLogs(data.taskLogs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error fetching task logs");
      } finally {
        setLoading(false);
      }
    };

    fetchTaskLogs();
  }, [referenceid, dateCreatedFilterRange]);

  // Process and count site visits per agent
  const siteVisitData = useMemo(() => {
    // Group by agent and count unique SiteVisitAccount per day
    const agentVisitMap = new Map<
      string,
      { agentName: string; picture: string; visits: Set<string>; count: number }
    >();

    taskLogs.forEach((visit) => {
      // Count all Client Visit records, use SiteVisitAccount if available
      const refId = visit.ReferenceID.toLowerCase();
      const dateKey = toDateKey(visit.date_created);
      // Use SiteVisitAccount if available, otherwise use a placeholder to count the visit
      const siteAccount = visit.SiteVisitAccount?.trim() || "(No Account Specified)";
      
      // Unique key: agent + date + site_account
      const uniqueKey = `${refId}_${dateKey}_${siteAccount.toLowerCase()}`;

      if (!agentVisitMap.has(refId)) {
        agentVisitMap.set(refId, {
          agentName: getAgentName(refId, agents),
          picture: getAgentPicture(refId, agents),
          visits: new Set(),
          count: 0,
        });
      }

      const agentData = agentVisitMap.get(refId)!;
      
      // Only count unique SiteVisitAccount per day per agent
      if (!agentData.visits.has(uniqueKey)) {
        agentData.visits.add(uniqueKey);
        agentData.count += 1;
      }
    });

    // Convert to array, filter out agents without name info, and sort by count (descending)
    return Array.from(agentVisitMap.entries())
      .filter(([refId]) => agentExists(refId, agents)) // Only show agents with name info
      .map(([refId, data]) => ({
        refId,
        agentName: data.agentName,
        picture: data.picture,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [taskLogs, agents]);

  // Get detailed visits for selected agent - group by SiteVisitAccount
  const selectedAgentVisits = useMemo(() => {
    if (!selectedAgent) return [];
    
    // Filter valid visits
    const visits = taskLogs.filter(log => 
      log.ReferenceID.toLowerCase() === selectedAgent.toLowerCase() &&
      log.SiteVisitAccount &&
      log.SiteVisitAccount.trim() !== ""
    );

    // Group by SiteVisitAccount
    const grouped = new Map<string, { account: string; dates: Date[]; location?: string }>();
    
    visits.forEach(visit => {
      const account = visit.SiteVisitAccount!; // Already filtered above
      if (!grouped.has(account)) {
        grouped.set(account, { 
          account, 
          dates: [],
          location: visit.Location 
        });
      }
      const group = grouped.get(account)!;
      group.dates.push(new Date(visit.date_created));
    });

    // Convert to array with date range info
    return Array.from(grouped.values()).map(group => {
      const sortedDates = group.dates.sort((a, b) => a.getTime() - b.getTime());
      const earliest = sortedDates[0];
      const latest = sortedDates[sortedDates.length - 1];
      
      return {
        account: group.account,
        location: group.location,
        earliest,
        latest,
        isRange: sortedDates.length > 1,
        count: sortedDates.length
      };
    });
  }, [taskLogs, selectedAgent]);

  const totalVisits = siteVisitData.reduce((sum, item) => sum + item.count, 0);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <Card className="rounded-xl border shadow-sm overflow-hidden">
      <CardHeader className="px-5 pt-5 pb-3 border-b bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Site Visits</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Unique site visits per agent
              </p>
            </div>
          </div>
          {totalVisits > 0 && (
            <div className="text-right">
              <span className="text-2xl font-bold text-gray-900 font-mono">
                {totalVisits}
              </span>
              <p className="text-[10px] text-gray-400">total visits</p>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs italic">Loading site visits...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-10 text-red-500">
            <p className="text-xs">{error}</p>
          </div>
        ) : siteVisitData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <MapPin className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs italic">No site visits for selected date</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-gray-500 pl-5">
                    Agent
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-gray-500 text-right pr-5">
                    Visits
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {siteVisitData.map((item) => (
                  <React.Fragment key={item.refId}>
                    <TableRow
                      className={`text-xs hover:bg-gray-50/50 border-b border-gray-100 cursor-pointer transition-colors ${
                        selectedAgent === item.refId ? "bg-green-50 hover:bg-green-50" : ""
                      }`}
                      onClick={() => setSelectedAgent(selectedAgent === item.refId ? null : item.refId)}
                    >
                      <TableCell className="pl-5 py-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={item.picture}
                            alt={item.agentName}
                            className="w-7 h-7 rounded-full object-cover border border-gray-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/Taskflow.png";
                            }}
                          />
                          <span className="font-medium text-gray-700 capitalize">
                            {item.agentName}
                          </span>
                          {selectedAgent === item.refId && (
                            <span className="text-[10px] text-green-600 font-medium ml-2">▼</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-5 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-green-100 text-green-700 font-bold text-xs">
                          {item.count}
                        </span>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded details for selected agent */}
                    {selectedAgent === item.refId && selectedAgentVisits.length > 0 && (
                      <TableRow className="bg-gray-50/70">
                        <TableCell colSpan={2} className="p-0">
                          <div className="px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                Site Visit Details ({selectedAgentVisits.length})
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAgent(null);
                                }}
                                className="text-[10px] text-gray-400 hover:text-gray-600"
                              >
                                Close ✕
                              </button>
                            </div>
                            <div className="space-y-2">
                              {selectedAgentVisits.map((visit, idx) => (
                                <div
                                  key={idx}
                                  className="bg-white rounded-lg border border-gray-100 p-3 text-xs"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-gray-800 truncate">
                                        {visit.account}
                                      </p>
                                      {visit.location && (
                                        <p className="text-gray-500 mt-0.5 truncate">
                                          📍 {visit.location}
                                        </p>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0 text-right">
                                      {visit.isRange ? (
                                        <>
                                          <div>{visit.earliest.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</div>
                                          <div>-</div>
                                          <div>{visit.latest.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</div>
                                        </>
                                      ) : (
                                        visit.earliest.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
                                      )}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

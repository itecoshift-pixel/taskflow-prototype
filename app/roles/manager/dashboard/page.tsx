"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCcw, Loader2, List } from "lucide-react";
import { sileo } from "sileo";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams, useRouter } from "next/navigation";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { ReportSummary } from "@/components/roles/manager/dashboard/report-summary";
import { AIInsightsButton, type AIInsightsMetrics } from "@/components/roles/manager/dashboard/ai-insights-button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Activity {
  account_reference_number: string;
  company_name?: string;
  date_created?: string;
  type_activity?: string;
  type_client?: string;
  [key: string]: any;
}

interface ClientSegments {
  top50: number;
  next30: number;
  balance20: number;
  csrClient: number;
  newClient: number;
  tsaClient: number;
  outbound: number;
}

interface Denominators {
  total: number;
  top50: number;
  next30: number;
  bal20: number;
  csrClient: number;
  newClient: number;
  tsaClient: number;
  daily: number;
  weekly: number;
  monthly: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatHoursToHMS = (hours: number): string => {
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
};

type TimeByActivity = Record<string, number>;

const computeTimeByActivity = (activities: any[]): TimeByActivity =>
  activities.reduce((acc, act) => {
    if (!act.start_date || !act.end_date || !act.type_activity) return acc;
    const start = new Date(act.start_date).getTime();
    const end = new Date(act.end_date).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return acc;
    acc[act.type_activity] = (acc[act.type_activity] || 0) + (end - start);
    return acc;
  }, {} as TimeByActivity);

const isOutboundTouchbase = (a: any): boolean =>
  a.source === "Outbound - Touchbase" && a.call_status === "Successful";

const getFixedCount = (refId: string, date: Date): number => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const feb2026: Record<string, number> = {
    "RT-NCR-815758": 11,
    "MF-PH-840897": 7,
    "AB-NCR-288130": 11,
    "AS-NCR-146592": 4,
    "MP-CDO-613398": 4,
    "JG-NCR-713768": 1,
    "JM-CBU-702043": 3,
  };
  const marchOnwards: Record<string, number> = {
    "RT-NCR-815758": 12,
    "MF-PH-840897": 5,
    "AB-NCR-288130": 11,
    "AS-NCR-146592": 4,
    "MP-CDO-613398": 4,
    "JG-NCR-713768": 1,
    "JM-CBU-702043": 2,
  };

  if (year === 2026 && month === 2) return feb2026[refId] ?? 0;
  if (year > 2026 || (year === 2026 && month >= 3)) return marchOnwards[refId] ?? 0;
  return 0;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 border border-gray-100">
    <span className="text-[10px] text-gray-500 uppercase font-medium">{label}</span>
    <span className="text-[11px] font-bold text-gray-800">{value}</span>
  </div>
);

const SectionCard = ({
  title, badge, children, accent,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
}) => (
  <li className={`bg-white border border-gray-200 shadow-sm overflow-hidden ${accent ? `border-l-4 ${accent}` : ""}`}>
    <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100 bg-gray-50">
      <span className="text-[10px] font-black uppercase tracking-wider text-gray-700">{title}</span>
      {badge}
    </div>
    <div className="p-3">{children}</div>
  </li>
);

// ─── Main Component ───────────────────────────────────────────────────────────

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const queryUserId = searchParams?.get("id") ?? "";
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];

  // ── Manager Tab Dates ───────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(today);

  // ── TSM Tab Dates ────────────────────────────────────────────────────────
  const [tsmFromDate, setTsmFromDate] = useState<string>(today);
  const [tsmToDate, setTsmToDate] = useState<string>(today);

  // ── Agent Tab Dates ──────────────────────────────────────────────────────
  const [agentFromDate, setAgentFromDate] = useState<string>(today);
  const [agentToDate, setAgentToDate] = useState<string>(today);

  const [userDetails, setUserDetails] = useState({
    referenceid: "", firstname: "", lastname: "", role: "",
  });

  const [activities, setActivities] = useState<any[]>([]);
  const [clusterAccounts, setClusterAccounts] = useState<Activity[]>([]);
  const [uniqueActivitiesList, setUniqueActivitiesList] = useState<Activity[]>([]);

  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingOverdue, setLoadingOverdue] = useState(false);
  const [loadingCsrMetrics, setLoadingCsrMetrics] = useState(false);
  const [loadingTime, setLoadingTime] = useState(false);

  const [timeByActivity, setTimeByActivity] = useState<TimeByActivity>({});
  const [timeConsumedMs, setTimeConsumedMs] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [newClientCount, setNewClientCount] = useState(0);
  const [outboundDaily, setOutboundDaily] = useState(0);
  const [outboundWeekly, setOutboundWeekly] = useState(0);
  const [outboundMonthly, setOutboundMonthly] = useState(0);
  const [uniqueClientReach, setUniqueClientReach] = useState(0);

  const [clientSegments, setClientSegments] = useState<ClientSegments>({
    top50: 0, next30: 0, balance20: 0,
    csrClient: 0, newClient: 0, tsaClient: 0,
    outbound: 0,
  });

  const [denominators, setDenominators] = useState<Denominators>({
    total: 0, top50: 0, next30: 0, bal20: 0,
    csrClient: 0, newClient: 0, tsaClient: 0,
    daily: 0, weekly: 0, monthly: 0,
  });

  const [pendingClientApprovalCount, setPendingClientApprovalCount] = useState(0);
  const [spfPendingClientApproval, setSpfPendingClientApproval] = useState(0);
  const [spfPendingProcurement, setSpfPendingProcurement] = useState(0);
  const [spfPendingPD, setSpfPendingPD] = useState(0);

  const [orderCompleteCount, setOrderCompleteCount] = useState(0);
  const [convertToSOCount, setConvertToSOCount] = useState(0);
  const [declinedCount, setDeclinedCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);

  const [avgResponseTime, setAvgResponseTime] = useState(0);
  const [avgNonQuotationHT, setAvgNonQuotationHT] = useState(0);
  const [avgQuotationHT, setAvgQuotationHT] = useState(0);
  const [avgSpfHT, setAvgSpfHT] = useState(0);

  const [overdueByCompany, setOverdueByCompany] = useState<Record<string, number>>({});
  const [overdueCount, setOverdueCount] = useState(0);
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const [coverageDialogSource, setCoverageDialogSource] = useState<"covered" | "uncovered" | null>(null);
  const [coveredAccounts, setCoveredAccounts] = useState<Activity[]>([]);
  const [uncoveredAccounts, setUncoveredAccounts] = useState<Activity[]>([]);
  const [newClientByCompany, setNewClientByCompany] = useState<Record<string, number>>({});
  const [showAllNewClients, setShowAllNewClients] = useState(false);

  // ── Tab State ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"manager" | "tsm" | "agent">("manager");

  // ── TSM-specific states ───────────────────────────────────────────────────
  const [agents, setAgents] = useState<Array<{ Firstname: string; Lastname: string; ReferenceID: string; Position: string; Status: string }>>([]);
  const [selectedRefId, setSelectedRefId] = useState<string>("");
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentsByTsm, setAgentsByTsm] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("tsm_report_agentsByTsm") || "{}");
    } catch { return {}; }
  });

  // ── Agent-specific states ────────────────────────────────────────────────
  const [agentUsers, setAgentUsers] = useState<Array<{
  Firstname: string; Lastname: string; ReferenceID: string;
  Position: string; Status: string;
  TSM?: string; Tsm?: string; tsm?: string;
}>>([]);
  const [selectedAgentRefId, setSelectedAgentRefId] = useState<string>("");
  const [loadingAgentUsers, setLoadingAgentUsers] = useState(false);

  // ── Manager states ──────────────────────────────────────────────────────
  const [totalAgents, setTotalAgents] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem("tsm_totalAgents")) || 0;
  });

  const [workingDays, setWorkingDays] = useState<number>(() => {
    if (typeof window === "undefined") return 26;
    return Number(localStorage.getItem("tsm_workingDays")) || 26;
  });

  useEffect(() => {
    localStorage.setItem("tsm_totalAgents", String(totalAgents));
  }, [totalAgents]);

  useEffect(() => {
    localStorage.setItem("tsm_workingDays", String(workingDays));
  }, [workingDays]);

  useEffect(() => {
    localStorage.setItem("tsm_report_agentsByTsm", JSON.stringify(agentsByTsm));
  }, [agentsByTsm]);

  useEffect(() => {
    localStorage.setItem("tsa_workingDays", String(workingDays));
  }, [workingDays]);

  // ── Sync userId from URL ──────────────────────────────────────────────────

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  // ── Fetch user ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return;
    setLoadingUser(true);
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => setUserDetails({
        referenceid: data.ReferenceID || "",
        role: data.Role || "",
        firstname: data.Firstname || "",
        lastname: data.Lastname || "",
      }))
      .catch(() => sileo.error({ title: "Error", description: "Failed to load user.", duration: 4000, position: "top-center" }))
      .finally(() => setLoadingUser(false));
  }, [userId]);

  // ── Fetch agents under manager (for TSM tab) ─────────────────────────────

  useEffect(() => {
    if (!userDetails.referenceid || activeTab !== "tsm") return;
    setLoadingAgents(true);
    fetch(`/api/activity/manager/breaches/fetch-tsm?id=${encodeURIComponent(userDetails.referenceid)}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => {
        const active = data.filter((a: any) => (a.Status || "").toLowerCase() === "active");
        setAgents(active);
        if (active.length > 0 && !selectedRefId) setSelectedRefId(active[0].ReferenceID);
      })
      .catch(() => console.error("Failed to fetch tsm"))
      .finally(() => setLoadingAgents(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDetails.referenceid, activeTab]);

  // ── Fetch agent users under manager (for Agent tab) ────────────────────

  useEffect(() => {
    if (!userDetails.referenceid || activeTab !== "agent") return;
    setLoadingAgentUsers(true);
    fetch(`/api/activity/manager/breaches/fetch-agent?id=${encodeURIComponent(userDetails.referenceid)}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => {
        const active = data.filter((a: any) => (a.Status || "").toLowerCase() === "active");
        setAgentUsers(active);
        if (active.length > 0 && !selectedAgentRefId) setSelectedAgentRefId(active[0].ReferenceID);
      })
      .catch(() => console.error("Failed to fetch agents"))
      .finally(() => setLoadingAgentUsers(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDetails.referenceid, activeTab]);

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchClusterData = useCallback(async (refId: string) => {
    if (!refId) return;
    try {
      const PAGE_SIZE = 1000;
      let offset = 0;
      let allAccounts: any[] = [];
      let hasMore = true;

      while (hasMore) {
        const res = await fetch(
          `/api/com-fetch-manager-account?manager=${encodeURIComponent(refId)}&limit=${PAGE_SIZE}&offset=${offset}`
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        const batch: any[] = data.data || [];
        allAccounts = [...allAccounts, ...batch];
        hasMore = batch.length === PAGE_SIZE;
        offset += PAGE_SIZE;
      }

      const active = allAccounts.filter(
        (a: any) => (a.status || "").toLowerCase() === "active"
      );

      const countByType = (val: string) =>
        active.filter(
          (a: any) => (a.type_client || "").trim().toLowerCase() === val
        ).length;

      setDenominators((prev) => ({
        ...prev,
        total: active.length,
        top50: countByType("top 50"),
        next30: countByType("next 30"),
        bal20: countByType("balance 20"),
        csrClient: countByType("csr client"),
        newClient: countByType("new client"),
        tsaClient: countByType("tsa client"),
      }));

      setClusterAccounts(
        active.map((a: any) => ({
          account_reference_number: a.account_reference_number,
          company_name: a.company_name,
          type_client: (a.type_client || "").toLowerCase().replace(/\s+/g, ""),
        }))
      );
    } catch {
      sileo.error({
        title: "Error",
        description: "Failed to fetch cluster.",
        duration: 4000,
        position: "top-center",
      });
    }
  }, []);

  const fetchActivities = useCallback(async (refId: string) => {
    if (!refId) return;
    setLoadingActivities(true);
    try {
      const res = await fetch(`/api/activity/manager/breaches/fetch?manager=${encodeURIComponent(refId)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setActivities(data.activities || []);
    } catch {
      sileo.error({ title: "Error", description: "Failed to fetch activities.", duration: 4000, position: "top-center" });
    } finally {
      setLoadingActivities(false);
    }
  }, []);

  const fetchOverdue = useCallback(async (refId: string, from?: string, to?: string) => {
    if (!refId) return;
    setLoadingOverdue(true);
    try {
      let url = `/api/activity/manager/breaches/fetch-activity?manager=${encodeURIComponent(refId)}`;
      if (from && to) {
        url = `/api/activity/manager/breaches/fetch-activity?manager=${encodeURIComponent(refId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const acts: any[] = data.activities || [];
      const grouped: Record<string, number> = {};
      acts.forEach((a) => {
        const c = a.company_name || "Unknown";
        grouped[c] = (grouped[c] || 0) + 1;
      });
      setOverdueByCompany(grouped);
      setOverdueCount(acts.length);
    } catch {
      sileo.error({ title: "Error", description: "Failed to fetch overdue.", duration: 4000, position: "top-center" });
    } finally {
      setLoadingOverdue(false);
    }
  }, []);

  // ── TSM-specific fetch helpers ────────────────────────────────────────────

  // Fetch TSA agents under this TSM, then aggregate their cluster accounts
  const fetchTsmClusterData = useCallback(async (refId: string) => {
    if (!refId) return;
    try {
      // Step 1 — get all active TSA agents under this TSM
      const agentRes = await fetch(`/api/activity/tsm/breaches/fetch-agent?id=${encodeURIComponent(refId)}`);
      if (!agentRes.ok) throw new Error("Failed to fetch agents");
      const agentData: { ReferenceID: string; Status: string }[] = await agentRes.json();
      const activeAgents = agentData.filter((a) => (a.Status || "").toLowerCase() === "active");

      if (activeAgents.length === 0) {
        setClusterAccounts([]);
        setDenominators((prev) => ({ ...prev, total: 0, top50: 0, next30: 0, bal20: 0, csrClient: 0, newClient: 0, tsaClient: 0 }));
        return;
      }

      // Step 2 — fetch cluster accounts for each TSA in parallel
      const excludedStatuses = ["removed", "approved for deletion", "subject for transfer"];
      const allowedTypes = ["top 50", "next 30", "balance 20", "tsa client", "csr client", "new client"];

      const results = await Promise.all(
        activeAgents.map((agent) =>
          fetch(`/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(agent.ReferenceID)}`)
            .then((r) => r.ok ? r.json() : { data: [] })
            .then((d) => (d.data || []) as any[])
            .catch(() => [] as any[])
        )
      );

      // Step 3 — flatten, filter, normalize
      const allAccounts: Activity[] = results
        .flat()
        .filter((a: any) => {
          const status = (a.status || "").toLowerCase();
          const typeClient = (a.type_client || "").toLowerCase();
          if (!a.status || !a.type_client) return false;
          if (excludedStatuses.includes(status)) return false;
          if (!allowedTypes.includes(typeClient)) return false;
          return true;
        })
        .map((a: any) => ({
          account_reference_number: a.account_reference_number,
          company_name: a.company_name,
          type_client: (a.type_client || "").toLowerCase().replace(/\s+/g, ""),
        }));

      const countByType = (val: string) =>
        allAccounts.filter((a) => a.type_client === val).length;

      setDenominators((prev) => ({
        ...prev,
        total: allAccounts.length,
        top50: countByType("top50"),
        next30: countByType("next30"),
        bal20: countByType("balance20"),
        csrClient: countByType("csrclient"),
        newClient: countByType("newclient"),
        tsaClient: countByType("tsaclient"),
      }));

      setClusterAccounts(allAccounts);
    } catch { /* silent */ }
  }, []);

  const fetchTsmActivities = useCallback(async (refId: string) => {
    if (!refId) return;
    setLoadingActivities(true);
    try {
      const res = await fetch(`/api/activity/manager/breaches/fetch-activity-tsm?tsm=${encodeURIComponent(refId)}&fetchAll=true`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setActivities(data.activities || []);
    } catch {
      sileo.error({ title: "Error", description: "Failed to fetch activities.", duration: 4000, position: "top-center" });
    } finally {
      setLoadingActivities(false);
    }
  }, []);

  const fetchTsmOverdue = useCallback(async (refId: string, from: string, to: string) => {
    if (!refId || !from || !to) return;
    setLoadingOverdue(true);
    try {
      const url = `/api/activity/manager/breaches/fetch-activity-tsm?tsm=${encodeURIComponent(refId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const acts: any[] = data.activities || [];
      const grouped: Record<string, number> = {};
      acts.forEach((a) => { const c = a.company_name || "Unknown"; grouped[c] = (grouped[c] || 0) + 1; });
      setOverdueByCompany(grouped);
      setOverdueCount(acts.length);
    } catch { /* silent */ } finally {
      setLoadingOverdue(false);
    }
  }, []);

  const fetchTsmCsrMetrics = useCallback(async (refId: string, from: string, to: string) => {
    if (!refId) return;
    setLoadingCsrMetrics(true);
    try {
      const res = await fetch(
        `/api/activity/manager/breaches/fetch-ecodesk-tsm?manager=${encodeURIComponent(refId)}&referenceid=${encodeURIComponent(refId)}`
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`CSR metrics request failed (${res.status}): ${body}`);
      }
      const result = await res.json();
      const data: any[] = result.data || [];

      const excluded = [
        "CustomerFeedback/Recommendation", "Job Inquiry", "Job Applicants",
        "Supplier/Vendor Product Offer", "Internal Whistle Blower",
        "Threats/Extortion/Intimidation", "Prank Call",
      ];

      const fromTs = new Date(from).getTime();
      const toDateObj = new Date(to); toDateObj.setHours(23, 59, 59, 999);
      const toTs = toDateObj.getTime();

      let rtTotal = 0, rtCount = 0;
      let nqTotal = 0, nqCount = 0;
      let qTotal = 0, qCount = 0;
      let spfTotal = 0, spfCount = 0;

      data.forEach((row) => {
        if (row.status !== "Closed" && row.status !== "Converted into Sales") return;
        const created = new Date(row.date_created).getTime();
        if (isNaN(created) || created < fromTs || created > toTs) return;
        if (excluded.includes(row.wrap_up)) return;

        const tsaAck = new Date(row.tsa_acknowledge_date).getTime();
        const endorsed = new Date(row.ticket_endorsed).getTime();
        if (!isNaN(tsaAck) && !isNaN(endorsed) && tsaAck >= endorsed) {
          rtTotal += (tsaAck - endorsed) / 3600000; rtCount++;
        }

        const received = new Date(row.ticket_received).getTime();
        const tsaHandle = new Date(row.tsa_handling_time).getTime();
        const tsmHandle = new Date(row.tsm_handling_time).getTime();
        let baseHT = 0;
        if (!isNaN(tsaHandle) && !isNaN(received) && tsaHandle >= received) {
          baseHT = (tsaHandle - received) / 3600000;
        } else if (!isNaN(tsmHandle) && !isNaN(received) && tsmHandle >= received) {
          baseHT = (tsmHandle - received) / 3600000;
        }
        if (!baseHT) return;

        const remarks = (row.remarks || "").toUpperCase();
        if (remarks === "QUOTATION FOR APPROVAL" || remarks === "SOLD") {
          qTotal += baseHT; qCount++;
        } else if (remarks.includes("SPF")) {
          spfTotal += baseHT; spfCount++;
        } else {
          nqTotal += baseHT; nqCount++;
        }
      });

      setAvgResponseTime(rtCount ? rtTotal / rtCount : 0);
      setAvgNonQuotationHT(nqCount ? nqTotal / nqCount : 0);
      setAvgQuotationHT(qCount ? qTotal / qCount : 0);
      setAvgSpfHT(spfCount ? spfTotal / spfCount : 0);
    } catch (err) {
      console.error("CSR metrics error:", err);
    } finally {
      setLoadingCsrMetrics(false);
    }
  }, []);

  // ── Agent-specific fetch helpers ─────────────────────────────────────────

  const fetchAgentClusterData = useCallback(async (refId: string) => {
    if (!refId) return;
    try {
      const res = await fetch(`/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(refId)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const active: any[] = (data.data || []).filter((a: any) => (a.status || "").toLowerCase() === "active");
      const countByType = (val: string) =>
        active.filter((a) => (a.type_client || "").trim().toLowerCase() === val).length;
      setDenominators((prev) => ({
        ...prev,
        total: active.length,
        top50: countByType("top 50"),
        next30: countByType("next 30"),
        bal20: countByType("balance 20"),
        csrClient: countByType("csr client"),
        newClient: countByType("new client"),
        tsaClient: countByType("tsa client"),
      }));
      setClusterAccounts(
        active.map((a) => ({
          account_reference_number: a.account_reference_number,
          company_name: a.company_name,
          type_client: (a.type_client || "").toLowerCase().replace(/\s+/g, ""),
        }))
      );
    } catch { /* silent */ }
  }, []);

  const fetchAgentActivities = useCallback(async (refId: string) => {
    if (!refId) return;
    setLoadingActivities(true);
    try {
      const res = await fetch(`/api/activity/tsa/breaches/fetch?referenceid=${encodeURIComponent(refId)}&fetchAll=true`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setActivities(data.activities || []);
    } catch {
      sileo.error({ title: "Error", description: "Failed to fetch activities.", duration: 4000, position: "top-center" });
    } finally {
      setLoadingActivities(false);
    }
  }, []);

  const fetchAgentOverdue = useCallback(async (refId: string, from: string, to: string) => {
    if (!refId || !from || !to) return;
    setLoadingOverdue(true);
    try {
      const url = `/api/activity/tsa/breaches/fetch-activity?referenceid=${encodeURIComponent(refId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const acts: any[] = data.activities || [];
      const grouped: Record<string, number> = {};
      acts.forEach((a) => { const c = a.company_name || "Unknown"; grouped[c] = (grouped[c] || 0) + 1; });
      setOverdueByCompany(grouped);
      setOverdueCount(acts.length);
    } catch { /* silent */ } finally {
      setLoadingOverdue(false);
    }
  }, []);

  const fetchAgentCsrMetrics = useCallback(async (refId: string, from: string, to: string) => {
    if (!refId) return;
    setLoadingCsrMetrics(true);
    try {
      const res = await fetch(
        `/api/activity/manager/breaches/fetch-ecodesk-agent?agent=${encodeURIComponent(refId)}&referenceid=${encodeURIComponent(refId)}`
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`CSR metrics request failed (${res.status}): ${body}`);
      }
      const result = await res.json();
      const data: any[] = result.data || [];

      const excluded = [
        "CustomerFeedback/Recommendation", "Job Inquiry", "Job Applicants",
        "Supplier/Vendor Product Offer", "Internal Whistle Blower",
        "Threats/Extortion/Intimidation", "Prank Call",
      ];

      const fromTs = new Date(from).getTime();
      const toDateObj = new Date(to); toDateObj.setHours(23, 59, 59, 999);
      const toTs = toDateObj.getTime();

      let rtTotal = 0, rtCount = 0;
      let nqTotal = 0, nqCount = 0;
      let qTotal = 0, qCount = 0;
      let spfTotal = 0, spfCount = 0;

      data.forEach((row) => {
        if (row.status !== "Closed" && row.status !== "Converted into Sales") return;
        const created = new Date(row.date_created).getTime();
        if (isNaN(created) || created < fromTs || created > toTs) return;
        if (excluded.includes(row.wrap_up)) return;

        const tsaAck = new Date(row.tsa_acknowledge_date).getTime();
        const endorsed = new Date(row.ticket_endorsed).getTime();
        if (!isNaN(tsaAck) && !isNaN(endorsed) && tsaAck >= endorsed) {
          rtTotal += (tsaAck - endorsed) / 3600000; rtCount++;
        }

        const received = new Date(row.ticket_received).getTime();
        const tsaHandle = new Date(row.tsa_handling_time).getTime();
        const tsmHandle = new Date(row.tsm_handling_time).getTime();
        let baseHT = 0;
        if (!isNaN(tsaHandle) && !isNaN(received) && tsaHandle >= received) {
          baseHT = (tsaHandle - received) / 3600000;
        } else if (!isNaN(tsmHandle) && !isNaN(received) && tsmHandle >= received) {
          baseHT = (tsmHandle - received) / 3600000;
        }
        if (!baseHT) return;

        const remarks = (row.remarks || "").toUpperCase();
        if (remarks === "QUOTATION FOR APPROVAL" || remarks === "SOLD") {
          qTotal += baseHT; qCount++;
        } else if (remarks.includes("SPF")) {
          spfTotal += baseHT; spfCount++;
        } else {
          nqTotal += baseHT; nqCount++;
        }
      });

      setAvgResponseTime(rtCount ? rtTotal / rtCount : 0);
      setAvgNonQuotationHT(nqCount ? nqTotal / nqCount : 0);
      setAvgQuotationHT(qCount ? qTotal / qCount : 0);
      setAvgSpfHT(spfCount ? spfTotal / spfCount : 0);
    } catch (err) {
      sileo.error({ title: "Error", description: "Failed to fetch CSR metrics.", duration: 3000, position: "top-center" });
    } finally {
      setLoadingCsrMetrics(false);
    }
  }, []);

  const fetchCsrMetrics = useCallback(async (refId: string, from: string, to: string) => {
    if (!refId) return;
    setLoadingCsrMetrics(true);
    try {
      const res = await fetch(`/api/activity/manager/breaches/fetch-ecodesk?referenceid=${encodeURIComponent(refId)}`);
      if (!res.ok) throw new Error();
      const result = await res.json();
      const data: any[] = result.data || [];

      const excluded = [
        "CustomerFeedback/Recommendation", "Job Inquiry", "Job Applicants",
        "Supplier/Vendor Product Offer", "Internal Whistle Blower",
        "Threats/Extortion/Intimidation", "Prank Call",
      ];

      const fromTs = new Date(from).getTime();
      const toDateObj = new Date(to); toDateObj.setHours(23, 59, 59, 999);
      const toTs = toDateObj.getTime();

      let rtTotal = 0, rtCount = 0;
      let nqTotal = 0, nqCount = 0;
      let qTotal = 0, qCount = 0;
      let spfTotal = 0, spfCount = 0;

      data.forEach((row) => {
        if (row.status !== "Closed" && row.status !== "Converted into Sales") return;
        const created = new Date(row.date_created).getTime();
        if (isNaN(created) || created < fromTs || created > toTs) return;
        if (excluded.includes(row.wrap_up)) return;

        const tsaAck = new Date(row.tsa_acknowledge_date).getTime();
        const endorsed = new Date(row.ticket_endorsed).getTime();
        if (!isNaN(tsaAck) && !isNaN(endorsed) && tsaAck >= endorsed) {
          rtTotal += (tsaAck - endorsed) / 3600000;
          rtCount++;
        }

        const received = new Date(row.ticket_received).getTime();
        const tsaHandle = new Date(row.tsa_handling_time).getTime();
        const tsmHandle = new Date(row.tsm_handling_time).getTime();

        let baseHT = 0;
        if (!isNaN(tsaHandle) && !isNaN(received) && tsaHandle >= received) {
          baseHT = (tsaHandle - received) / 3600000;
        } else if (!isNaN(tsmHandle) && !isNaN(received) && tsmHandle >= received) {
          baseHT = (tsmHandle - received) / 3600000;
        }
        if (!baseHT) return;

        const remarks = (row.remarks || "").toUpperCase();
        if (remarks === "QUOTATION FOR APPROVAL" || remarks === "SOLD") {
          qTotal += baseHT; qCount++;
        } else if (remarks.includes("SPF")) {
          spfTotal += baseHT; spfCount++;
        } else {
          nqTotal += baseHT; nqCount++;
        }
      });

      setAvgResponseTime(rtCount ? rtTotal / rtCount : 0);
      setAvgNonQuotationHT(nqCount ? nqTotal / nqCount : 0);
      setAvgQuotationHT(qCount ? qTotal / qCount : 0);
      setAvgSpfHT(spfCount ? spfTotal / spfCount : 0);
    } catch {
      console.error("CSR metrics error");
    } finally {
      setLoadingCsrMetrics(false);
    }
  }, []);

  // ── Auto-fetch Manager tab ────────────────────────────────────────────────

  useEffect(() => {
    const refId = userDetails.referenceid;
    if (!refId || activeTab !== "manager") return;
    fetchClusterData(refId);
    fetchActivities(refId);
    fetchOverdue(refId, fromDate, toDate);
    fetchCsrMetrics(refId, fromDate, toDate);
  }, [userDetails.referenceid, fromDate, toDate, activeTab, fetchClusterData, fetchActivities, fetchOverdue, fetchCsrMetrics]);

  // ── Auto-fetch TSM tab ──────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedRefId || activeTab !== "tsm") return;
    setActivities([]);
    setOverdueByCompany({});
    setOverdueCount(0);
    fetchTsmClusterData(selectedRefId);
    fetchTsmActivities(selectedRefId);
    fetchTsmOverdue(selectedRefId, tsmFromDate, tsmToDate);
    fetchTsmCsrMetrics(selectedRefId, tsmFromDate, tsmToDate);
  }, [selectedRefId, tsmFromDate, tsmToDate, activeTab, fetchTsmClusterData, fetchTsmActivities, fetchTsmOverdue, fetchTsmCsrMetrics]);

  // ── Auto-fetch Agent tab ─────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedAgentRefId || activeTab !== "agent") return;
    setActivities([]);
    setOverdueByCompany({});
    setOverdueCount(0);
    fetchAgentClusterData(selectedAgentRefId);
    fetchAgentActivities(selectedAgentRefId);
    fetchAgentOverdue(selectedAgentRefId, agentFromDate, agentToDate);
    fetchAgentCsrMetrics(selectedAgentRefId, agentFromDate, agentToDate);
  }, [selectedAgentRefId, agentFromDate, agentToDate, activeTab, fetchAgentClusterData, fetchAgentActivities, fetchAgentOverdue, fetchAgentCsrMetrics]);

  // ── Compute outbound + time metrics ───────────────────────────────────────

  useEffect(() => {
    if (!activities.length) {
      setOutboundDaily(0); setOutboundWeekly(0); setOutboundMonthly(0);
      setTimeByActivity({}); setTimeConsumedMs(0);
      setTotalSales(0); setNewClientCount(0);
      return;
    }

    setLoadingTime(true);
    try {
      const currentFromDate = activeTab === "manager" ? fromDate : activeTab === "tsm" ? tsmFromDate : agentFromDate;
      const currentToDate = activeTab === "manager" ? toDate : activeTab === "tsm" ? tsmToDate : agentToDate;

      const rangeStart = new Date(currentFromDate); rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd = new Date(currentToDate); rangeEnd.setHours(23, 59, 59, 999);

      const fixedCount = getFixedCount(userDetails.referenceid, new Date(currentFromDate));

      const rangeActivities = activities.filter((act) => {
        const t = new Date(act.date_created).getTime();
        return t >= rangeStart.getTime() && t <= rangeEnd.getTime();
      });

      const grouped = computeTimeByActivity(rangeActivities);
      setTimeByActivity(grouped);
      setTimeConsumedMs(Object.values(grouped).reduce((s, ms) => s + ms, 0));

      let sales = 0;
      rangeActivities.forEach((act) => {
        if (act.status === "Delivered") sales += Number(act.actual_sales) || 0;
      });
      setTotalSales(sales);

      // All outbound counts use the SELECTED date range (not calendar periods)
      const dailyCount = rangeActivities.filter(isOutboundTouchbase).length;

      // Weekly and monthly counts also respect the selected date range
      // If range is within a week, weekly = daily; if within a month, monthly = daily
      const weeklyCount = dailyCount;
      const monthlyCount = dailyCount;

      const agentCount = activeTab === "manager"
        ? (totalAgents > 0 ? totalAgents : (fixedCount || 1))
        : (agentsByTsm[selectedRefId] || 1);

      // Calculate days in selected range
      const daysInRange = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)));

      // Proportional denominators based on selected range
      const dailyDenom = agentCount * 20 * daysInRange;
      const weeklyDenom = agentCount * 20 * daysInRange; // Same as daily since we're using selected range
      const monthlyDenom = agentCount * 20 * daysInRange; // Same as daily since we're using selected range

      setOutboundDaily(dailyCount);
      setOutboundWeekly(weeklyCount);
      setOutboundMonthly(monthlyCount);
      setDenominators((prev) => ({
        ...prev,
        daily: dailyDenom,
        weekly: weeklyDenom,
        monthly: monthlyDenom,
      }));

      setPendingClientApprovalCount(
        activities.filter((a) => a.status === "Quote-Done" && a.quotation_status === "Pending Client Approval").length
      );
      setSpfPendingClientApproval(
        activities.filter((a) => a.call_type === "Quotation with SPF Preparation" && a.quotation_status === "Pending Client Approval").length
      );
      setSpfPendingProcurement(
        activities.filter((a) => a.call_type === "Quotation with SPF Preparation" && a.quotation_status === "Pending Procurement").length
      );
      setSpfPendingPD(
        activities.filter((a) => a.call_type === "Quotation with SPF Preparation" && a.quotation_status === "Pending PD").length
      );
      setOrderCompleteCount(
        activities.filter((a) => a.quotation_status === "Order Complete").length
      );
      setConvertToSOCount(
        activities.filter((a) => a.quotation_status === "Convert to SO").length
      );
      setDeclinedCount(
        activities.filter((a) => a.quotation_status === "Declined").length
      );
      setCancelledCount(
        activities.filter((a) => a.quotation_status === "Cancelled").length
      );
    } finally {
      setLoadingTime(false);
    }
  }, [activities, fromDate, toDate, tsmFromDate, tsmToDate, agentFromDate, agentToDate, userDetails.referenceid, totalAgents, workingDays, activeTab, agentsByTsm, selectedRefId, selectedAgentRefId]);

  // ── Territory coverage ────────────────────────────────────────────────────────────────────────────
  //
  // Scope: the selected date range for the active tab.
  // - "Covered"     = cluster accounts whose company_name matches ANY activity
  //                   company_name within that range (case-insensitive,
  //                   trailing dots stripped, whitespace collapsed).
  // - "Not Reached" = the rest

  // Normalize a company name: lowercase → collapse whitespace → strip trailing dot(s)
  const normalizeCompany = (name: string): string =>
    (name || "").toLowerCase().replace(/\s+/g, " ").trim().replace(/\.+$/, "");

  useEffect(() => {
    if (!clusterAccounts.length) {
      setUniqueClientReach(0);
      setUniqueActivitiesList([]);
      setCoveredAccounts([]);
      setUncoveredAccounts([]);
      setClientSegments({ top50: 0, next30: 0, balance20: 0, csrClient: 0, newClient: 0, tsaClient: 0, outbound: 0 });
      return;
    }

    const currentFromDate = activeTab === "manager" ? fromDate : activeTab === "tsm" ? tsmFromDate : agentFromDate;
    const currentToDate   = activeTab === "manager" ? toDate   : activeTab === "tsm" ? tsmToDate   : agentToDate;

    const rangeStart = new Date(currentFromDate); rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd   = new Date(currentToDate);   rangeEnd.setHours(23, 59, 59, 999);

    // Step 1 — collect normalized company names touched within the range
    const touchedCompanyNames = new Set<string>();
    const byActivityRef: Record<string, any> = {};

    activities.forEach((act) => {
      if (!act.company_name || !act.date_created) return;
      const t = new Date(act.date_created).getTime();
      if (isNaN(t) || t < rangeStart.getTime() || t > rangeEnd.getTime()) return;

      touchedCompanyNames.add(normalizeCompany(act.company_name));

      if (act.activity_reference_number) {
        byActivityRef[act.activity_reference_number] = act;
      }
    });

    setUniqueActivitiesList(Object.values(byActivityRef));

    // Step 2 — covered / uncovered split by normalized company_name
    const covered = clusterAccounts.filter((acc) =>
      acc.company_name && touchedCompanyNames.has(normalizeCompany(acc.company_name))
    );
    const uncovered = clusterAccounts.filter((acc) =>
      !acc.company_name || !touchedCompanyNames.has(normalizeCompany(acc.company_name))
    );

    setCoveredAccounts(covered);
    setUncoveredAccounts(uncovered);

    // Step 3 — segment counts from covered cluster accounts
    const seg = { top50: 0, next30: 0, balance20: 0, csrClient: 0, newClient: 0, tsaClient: 0 };
    covered.forEach((acc) => {
      const type = acc.type_client ?? "";
      if      (type === "top50")     seg.top50++;
      else if (type === "next30")    seg.next30++;
      else if (type === "balance20") seg.balance20++;
      else if (type === "csrclient") seg.csrClient++;
      else if (type === "newclient") seg.newClient++;
      else if (type === "tsaclient") seg.tsaClient++;
    });

    setUniqueClientReach(covered.length);
    setClientSegments({ ...seg, outbound: covered.length });
  }, [activities, fromDate, toDate, tsmFromDate, tsmToDate, agentFromDate, agentToDate,
    activeTab,
  ]);

  // ── New clients ───────────────────────────────────────────────────────────

  useEffect(() => {
    const currentFromDate = activeTab === "manager" ? fromDate : activeTab === "tsm" ? tsmFromDate : agentFromDate;
    const currentToDate = activeTab === "manager" ? toDate : activeTab === "tsm" ? tsmToDate : agentToDate;

    if (!activities.length || !currentFromDate || !currentToDate) {
      setNewClientByCompany({}); setNewClientCount(0); return;
    }

    const rangeStart = new Date(currentFromDate); rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(currentToDate); rangeEnd.setHours(23, 59, 59, 999);
    const allowed = ["Assisted", "Quote-Done", "SO-Done", "Delivered"];

    const grouped: Record<string, number> = {};
    let total = 0;

    activities.forEach((act) => {
      const t = new Date(act.date_created).getTime();
      if (
        allowed.includes(act.status) &&
        act.type_client === "New Client" &&
        t >= rangeStart.getTime() && t <= rangeEnd.getTime()
      ) {
        const company = act.company_name || "Unknown";
        grouped[company] = (grouped[company] || 0) + 1;
        total++;
      }
    });

    setNewClientByCompany(grouped);
    setNewClientCount(total);
  }, [activities, fromDate, toDate, tsmFromDate, tsmToDate, agentFromDate, agentToDate, activeTab]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const overdueEntries = Object.entries(overdueByCompany);
  const visibleOverdue = showAllOverdue ? overdueEntries : overdueEntries.slice(0, 5);
  const newClientEntries = Object.entries(newClientByCompany);
  const visibleNewClients = showAllNewClients ? newClientEntries : newClientEntries.slice(0, 5);
  const isAnySyncing = loadingActivities || loadingOverdue || loadingAgents || loadingAgentUsers;

  const handleManualSync = () => {
    if (activeTab === "manager") {
      const refId = userDetails.referenceid;
      if (!refId) return;
      fetchClusterData(refId);
      fetchActivities(refId);
      fetchOverdue(refId, fromDate, toDate);
      fetchCsrMetrics(refId, fromDate, toDate);
      sileo.success({
        title: "Syncing",
        description: `Refreshing data for ${userDetails.lastname}, ${userDetails.firstname}`,
        duration: 3000,
        position: "top-right",
      });
    } else if (activeTab === "tsm") {
      if (!selectedRefId) return;
      fetchTsmClusterData(selectedRefId);
      fetchTsmActivities(selectedRefId);
      fetchTsmOverdue(selectedRefId, tsmFromDate, tsmToDate);
      fetchTsmCsrMetrics(selectedRefId, tsmFromDate, tsmToDate);
      const selectedAgent = agents.find((a) => a.ReferenceID === selectedRefId);
      sileo.success({
        title: "Syncing",
        description: `Refreshing data for ${selectedAgent?.Lastname ?? ""}, ${selectedAgent?.Firstname ?? ""}`,
        duration: 3000,
        position: "top-right",
      });
    } else {
      if (!selectedAgentRefId) return;
      fetchAgentClusterData(selectedAgentRefId);
      fetchAgentActivities(selectedAgentRefId);
      fetchAgentOverdue(selectedAgentRefId, agentFromDate, agentToDate);
      fetchAgentCsrMetrics(selectedAgentRefId, agentFromDate, agentToDate);
      const selectedAgentUser = agentUsers.find((a) => a.ReferenceID === selectedAgentRefId);
      sileo.success({
        title: "Syncing",
        description: `Refreshing data for ${selectedAgentUser?.Lastname ?? ""}, ${selectedAgentUser?.Firstname ?? ""}`,
        duration: 3000,
        position: "top-right",
      });
    }
  };

  const buildCompaniesUrl = (activity: "with" | "without"): string => {
  const params = new URLSearchParams();
  if (userId) params.set("id", userId);

  if (activeTab === "tsm" && selectedRefId) {
    params.set("tsm", selectedRefId);
    // No agent selected yet — companies page will land at TSAs level for this TSM
  } else if (activeTab === "agent" && selectedAgentRefId) {
    const agentUser = agentUsers.find((a) => a.ReferenceID === selectedAgentRefId);
    const tsmRef = agentUser?.TSM || agentUser?.Tsm || agentUser?.tsm || "";
    if (tsmRef) params.set("tsm", tsmRef);
    params.set("agent", selectedAgentRefId);
  }

  params.set("activity", activity);
  return `/roles/manager/companies/all?${params.toString()}`;
};

  const dailyPct = denominators.daily > 0
    ? Math.min(100, Math.round((outboundDaily / denominators.daily) * 100))
    : 0;
  const selectedAgent = agents.find((a) => a.ReferenceID === selectedRefId);
  const selectedAgentUser = agentUsers.find((a) => a.ReferenceID === selectedAgentRefId);

  // ── AI Insights metrics snapshot ────────────────────────────────────────────────────────────────────────────
  const _aiFromDate = activeTab === "manager" ? fromDate : activeTab === "tsm" ? tsmFromDate : agentFromDate;
  const _aiToDate   = activeTab === "manager" ? toDate   : activeTab === "tsm" ? tsmToDate   : agentToDate;

  const aiMetrics = {
    tab: activeTab,
    fromDate: _aiFromDate,
    toDate: _aiToDate,
    viewingName:
      activeTab === "tsm" && selectedAgent
        ? `${selectedAgent.Lastname}, ${selectedAgent.Firstname}`
        : activeTab === "agent" && selectedAgentUser
        ? `${selectedAgentUser.Lastname}, ${selectedAgentUser.Firstname}`
        : `${userDetails.lastname}, ${userDetails.firstname}`,
    totalAccounts: denominators.total,
    coveredAccounts: coveredAccounts.length,
    uncoveredAccounts: uncoveredAccounts.length,
    seg: {
      top50: clientSegments.top50,
      next30: clientSegments.next30,
      balance20: clientSegments.balance20,
      csrClient: clientSegments.csrClient,
      newClient: clientSegments.newClient,
      tsaClient: clientSegments.tsaClient,
    },
    denom: {
      top50: denominators.top50,
      next30: denominators.next30,
      bal20: denominators.bal20,
      csrClient: denominators.csrClient,
      newClient: denominators.newClient,
      tsaClient: denominators.tsaClient,
    },
    totalSales,
    outboundDaily,
    newClientCount,
    pendingClientApproval: pendingClientApprovalCount,
    orderComplete: orderCompleteCount,
    convertToSO: convertToSOCount,
    declined: declinedCount,
    cancelled: cancelledCount,
    avgResponseTime: formatHoursToHMS(avgResponseTime),
    avgNonQuotationHT: formatHoursToHMS(avgNonQuotationHT),
    avgQuotationHT: formatHoursToHMS(avgQuotationHT),
    avgSpfHT: formatHoursToHMS(avgSpfHT),
    overdueCount,
    overdueByCompany,
    newClientByCompany,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <ProtectedPageWrapper>
        <SidebarLeft />
        <SidebarInset className="overflow-hidden">
          <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b">
            <div className="flex flex-1 items-center gap-2 px-3">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="line-clamp-1">
                      Dashboard - {activeTab === "manager" ? "Manager Reports" : "TSM Reports"}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 overflow-hidden ml-4">
                <button
                  onClick={() => setActiveTab("manager")}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-colors ${activeTab === "manager"
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                >
                  Manager Reports
                </button>
                <button
                  onClick={() => setActiveTab("tsm")}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-colors ${activeTab === "tsm"
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                >
                  TSM Reports
                </button>
                <button
                  onClick={() => setActiveTab("agent")}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-colors ${activeTab === "agent"
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                >
                  Agent Reports
                </button>
              </div>
            </div>
          </header>

          <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            <div className="space-y-4 pb-4">

              {/* ── SYNC PANEL ──────────────────────────────────────────────────── */}
              <div className="bg-gray-50 border border-gray-200 p-3 space-y-3">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                  {activeTab === "manager" ? "Sync Configuration" : "Agent Selection"}
                </h4>

                {activeTab === "manager" ? (
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                        {loadingUser
                          ? "Loading..."
                          : `${userDetails.lastname || "—"}, ${userDetails.firstname || "—"}`}
                      </label>
                      <Input
                        className="h-7 text-[11px] font-mono rounded-none bg-white border-gray-200"
                        value={userDetails.referenceid}
                        disabled
                        placeholder="Reference ID"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                        Total Agents
                      </label>
                      <div className="flex gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          className="h-7 text-[11px] rounded-none bg-white border-gray-200 w-20"
                          value={totalAgents === 0 ? "" : totalAgents}
                          onChange={(e) => setTotalAgents(Number(e.target.value) || 0)}
                          placeholder="e.g. 27"
                        />
                        <select
                          className="h-7 text-[11px] rounded-none bg-white border border-gray-200 px-2 text-gray-700 font-mono flex-1 cursor-pointer"
                          value={workingDays}
                          onChange={(e) => setWorkingDays(Number(e.target.value))}
                        >
                          <option value={26}>26 days</option>
                          <option value={22}>22 days</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                        Start Date
                      </label>
                      <Input
                        type="date"
                        className="h-7 text-[11px] rounded-none bg-white border-gray-200"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                        End Date
                      </label>
                      <Input
                        type="date"
                        className="h-7 text-[11px] rounded-none bg-white border-gray-200"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                      />
                    </div>
                  </div>
                ) : activeTab === "tsm" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                        {loadingUser ? "Loading..." : `TSM: ${userDetails.lastname || "—"}, ${userDetails.firstname || "—"}`}
                      </label>

                      {loadingAgents ? (
                        <div className="flex items-center gap-2 text-gray-400 h-8">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-[10px]">Loading agents...</span>
                        </div>
                      ) : agents.length === 0 ? (
                        <p className="text-[10px] text-gray-400 italic h-8 flex items-center">No agents found</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {agents.map((agent) => {
                            const isActive = agent.ReferenceID === selectedRefId;
                            return (
                              <button
                                key={agent.ReferenceID}
                                onClick={() => setSelectedRefId(agent.ReferenceID)}
                                className={`text-[9px] font-bold uppercase px-2 py-1 border transition-colors ${isActive
                                  ? "bg-gray-900 text-white border-gray-900"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900"
                                  }`}
                              >
                                {agent.Lastname}, {agent.Firstname}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                          Start Date
                        </label>
                        <Input
                          type="date"
                          className="h-7 text-[11px] rounded-none bg-white border-gray-200"
                          value={tsmFromDate}
                          onChange={(e) => setTsmFromDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                          End Date
                        </label>
                        <Input
                          type="date"
                          className="h-7 text-[11px] rounded-none bg-white border-gray-200"
                          value={tsmToDate}
                          onChange={(e) => setTsmToDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                          Agents ({selectedRefId ? (agentsByTsm[selectedRefId] || 0) : "—"})
                        </label>
                        <Input
                          type="number"
                          min={0}
                          className="h-7 text-[11px] rounded-none bg-white border-gray-200"
                          value={selectedRefId ? (agentsByTsm[selectedRefId] || "") : ""}
                          placeholder="e.g. 5"
                          disabled={!selectedRefId}
                          onChange={(e) => {
                            if (!selectedRefId) return;
                            const val = Number(e.target.value) || 0;
                            setAgentsByTsm((prev) => ({ ...prev, [selectedRefId]: val }));
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                          Working Days
                        </label>
                        <select
                          className="h-7 w-full text-[11px] rounded-none bg-white border border-gray-200 px-2 text-gray-700 font-mono cursor-pointer"
                          value={workingDays}
                          onChange={(e) => setWorkingDays(Number(e.target.value))}
                        >
                          <option value={26}>26 days</option>
                          <option value={22}>22 days</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                        {loadingUser ? "Loading..." : `Manager: ${userDetails.lastname || "—"}, ${userDetails.firstname || "—"}`}
                      </label>

                      {loadingAgentUsers ? (
                        <div className="flex items-center gap-2 text-gray-400 h-8">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-[10px]">Loading agents...</span>
                        </div>
                      ) : agentUsers.length === 0 ? (
                        <p className="text-[10px] text-gray-400 italic h-8 flex items-center">No agents found</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {agentUsers.map((agent) => {
                            const isActive = agent.ReferenceID === selectedAgentRefId;
                            return (
                              <button
                                key={agent.ReferenceID}
                                onClick={() => setSelectedAgentRefId(agent.ReferenceID)}
                                className={`text-[9px] font-bold uppercase px-2 py-1 border transition-colors ${isActive
                                  ? "bg-gray-900 text-white border-gray-900"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900"
                                  }`}
                              >
                                {agent.Lastname}, {agent.Firstname}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                          Start Date
                        </label>
                        <Input
                          type="date"
                          className="h-7 text-[11px] rounded-none bg-white border-gray-200"
                          value={agentFromDate}
                          onChange={(e) => setAgentFromDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                          End Date
                        </label>
                        <Input
                          type="date"
                          className="h-7 text-[11px] rounded-none bg-white border-gray-200"
                          value={agentToDate}
                          onChange={(e) => setAgentToDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                          Working Days
                        </label>
                        <select
                          className="h-7 w-full text-[11px] rounded-none bg-white border border-gray-200 px-2 text-gray-700 font-mono cursor-pointer"
                          value={workingDays}
                          onChange={(e) => setWorkingDays(Number(e.target.value))}
                        >
                          <option value={26}>26 days</option>
                          <option value={22}>22 days</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "tsm" && selectedAgent && (
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Viewing: <strong className="text-gray-800">{selectedAgent.Lastname}, {selectedAgent.Firstname}</strong>
                    <span className="font-mono text-gray-400">({selectedRefId})</span>
                  </div>
                )}

                {activeTab === "agent" && selectedAgentUser && (
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Viewing: <strong className="text-gray-800">{selectedAgentUser.Lastname}, {selectedAgentUser.Firstname}</strong>
                    <span className="font-mono text-gray-400">({selectedAgentRefId})</span>
                  </div>
                )}

                <Button
                  className="w-full h-8 bg-gray-900 hover:bg-gray-800 text-[10px] uppercase font-black tracking-wider gap-2 rounded-none"
                  onClick={handleManualSync}
                  disabled={isAnySyncing || (activeTab === "manager" ? !userDetails.referenceid : activeTab === "tsm" ? !selectedRefId : !selectedAgentRefId)}
                >
                  {isAnySyncing
                    ? <Loader2 size={11} className="animate-spin" />
                    : <RefreshCcw size={11} />}
                  {isAnySyncing ? "Syncing..." : "Sync Data"}
                </Button>
                <AIInsightsButton
                  metrics={aiMetrics}
                  disabled={isAnySyncing || (activeTab === "manager" ? !userDetails.referenceid : activeTab === "tsm" ? !selectedRefId : !selectedAgentRefId)}
                />
              </div>

              {/* ── METRICS GRID ────────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">

                {/* LEFT COLUMN */}
                <ul className="list-none space-y-3">

                  {/* Outbound Performance */}
                  <SectionCard title="Outbound Performance">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 uppercase font-medium">Daily Count</span>
                      <span className="text-[20px] font-black text-gray-800">{outboundDaily}</span>
                    </div>
                    <p className="text-[8px] text-gray-400 uppercase font-medium mt-2 tracking-wide">
                      Source: Outbound - Touchbase
                    </p>
                  </SectionCard>

                  {/* Database Coverage */}
                  <SectionCard title="Database Coverage">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[14px] font-black text-blue-700">{coveredAccounts.length}</span>
                        <span className="text-[10px] text-gray-400">of {denominators.total} accounts</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 w-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-500"
                          style={{
                            width: denominators.total
                              ? `${Math.min(100, (coveredAccounts.length / denominators.total) * 100)}%`
                              : "0%",
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 py-2 border-y border-gray-100">
                        <div className="text-center">
                          <p className="text-[9px] text-gray-400 uppercase mb-1">With Activity</p>
                          <p className="text-[16px] font-black text-emerald-600">{coveredAccounts.length}</p>
                          <p className="text-[9px] text-gray-400">
                            {denominators.total ? Math.round((coveredAccounts.length / denominators.total) * 100) : 0}% of total
                          </p>
                        </div>
                        <div className="text-center border-l border-gray-100">
                          <p className="text-[9px] text-gray-400 uppercase mb-1">No Activity</p>
                          <p className="text-[16px] font-black text-amber-600">{uncoveredAccounts.length}</p>
                          <p className="text-[9px] text-gray-400">
                            {denominators.total ? Math.round((uncoveredAccounts.length / denominators.total) * 100) : 0}% of total
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1 mt-2">
                        {[
                          { label: "Top 50", key: "top50", covered: clientSegments.top50, total: denominators.top50 },
                          { label: "Next 30", key: "next30", covered: clientSegments.next30, total: denominators.next30 },
                          { label: "Bal 20", key: "balance20", covered: clientSegments.balance20, total: denominators.bal20 },
                          { label: "CSR", key: "csrclient", covered: clientSegments.csrClient, total: denominators.csrClient },
                          { label: "New", key: "newclient", covered: clientSegments.newClient, total: denominators.newClient },
                          { label: "TSA", key: "tsaclient", covered: clientSegments.tsaClient, total: denominators.tsaClient },
                        ].map(({ label, key, covered, total }) => (
                          <button
                            key={label}
                            onClick={() => setCoverageDialogSource("covered")}
                            className="bg-gray-50 px-2 py-1 text-center border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer group"
                          >
                            <p className="text-[8px] text-gray-400 uppercase group-hover:text-blue-600">{label}</p>
                            <p className="text-[10px] font-black text-gray-700 group-hover:text-blue-700">
                              {covered}<span className="text-gray-400 font-normal group-hover:text-blue-400">/{total}</span>
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </SectionCard>

                  {/* Overdue Activities */}
                  <SectionCard
                    title={`Overdue Activities${overdueCount > 0 ? ` · ${overdueCount}` : ""}`}
                    accent="border-l-red-400"
                    badge={
                      overdueEntries.length > 5 ? (
                        <button
                          onClick={() => setShowAllOverdue(!showAllOverdue)}
                          className="text-[9px] text-blue-600 font-semibold hover:underline"
                        >
                          {showAllOverdue ? "Less" : "More"}
                        </button>
                      ) : undefined
                    }
                  >
                    {loadingOverdue ? (
                      <div className="flex items-center gap-2 text-gray-400 py-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="text-[10px]">Loading...</span>
                      </div>
                    ) : overdueEntries.length === 0 ? (
                      <p className="text-[10px] text-gray-300 italic">No overdue activities</p>
                    ) : (
                      <div className={`space-y-1 ${showAllOverdue ? "max-h-40 overflow-y-auto pr-1" : ""}`}>
                        {visibleOverdue.map(([company, count]) => (
                          <div key={company} className="flex justify-between items-center px-2 py-1 bg-red-50 border border-red-100">
                            <span className="text-[10px] text-gray-600 truncate mr-2">{company}</span>
                            <strong className="text-[10px] text-red-600 shrink-0">{count}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>

                  {/* New Account Development */}
                  <SectionCard
                    title={`New Account Devt${newClientCount > 0 ? ` · ${newClientCount}` : ""}`}
                    badge={
                      newClientEntries.length > 5 ? (
                        <button
                          onClick={() => setShowAllNewClients(!showAllNewClients)}
                          className="text-[9px] text-blue-600 font-semibold hover:underline"
                        >
                          {showAllNewClients ? "Less" : "More"}
                        </button>
                      ) : undefined
                    }
                  >
                    {newClientEntries.length === 0 ? (
                      <p className="text-[10px] text-gray-300 italic">No new clients in selected range</p>
                    ) : (
                      <div className={`space-y-1 ${showAllNewClients ? "max-h-40 overflow-y-auto pr-1" : ""}`}>
                        {visibleNewClients.map(([company, count]) => (
                          <div key={company} className="flex justify-between items-center px-2 py-1 bg-blue-50 border border-blue-100">
                            <span className="text-[10px] text-gray-600 truncate mr-2">{company}</span>
                            <strong className="text-[10px] text-blue-600 shrink-0">{count}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>
                </ul>

                {/* RIGHT COLUMN */}
                <ul className="list-none space-y-3">

                  {/* Time Consumed */}
                  <SectionCard
                    title="Time Consumed"
                    badge={<span className="text-[10px] font-bold text-gray-600">{formatDuration(timeConsumedMs)}</span>}
                  >
                    {loadingTime ? (
                      <div className="flex items-center gap-2 text-gray-400 py-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="text-[10px]">Computing...</span>
                      </div>
                    ) : Object.keys(timeByActivity).length === 0 ? (
                      <p className="text-[10px] text-gray-300 italic">No activities logged in selected range</p>
                    ) : (
                      <div className="space-y-1">
                        {Object.entries(timeByActivity).map(([type, ms]) => (
                          <div key={type} className="flex justify-between items-center px-2 py-1 bg-gray-50 border border-gray-100">
                            <span className="text-[10px] text-gray-500 uppercase font-medium truncate mr-2">{type}</span>
                            <span className="text-[10px] font-bold text-gray-800 shrink-0">{formatDuration(ms)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>

                  {/* Total Sales */}
                  <li className="bg-gray-900 border border-gray-800 shadow-sm overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-700">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Total Sales</span>
                    </div>
                    <div className="px-3 py-3 flex items-baseline gap-1">
                      <span className="text-gray-400 text-sm font-medium">₱</span>
                      <span className="text-white text-2xl font-black tracking-tight tabular-nums">
                        {totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </li>

                  {/* CSR Metrics */}
                  <SectionCard title="CSR Metrics — Handling Times">
                    {loadingCsrMetrics ? (
                      <div className="flex items-center gap-2 text-gray-400 py-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="text-[10px]">Loading metrics...</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <StatRow label="TSA Response Time" value={formatHoursToHMS(avgResponseTime)} />
                        <StatRow label="Non-Quotation HT" value={formatHoursToHMS(avgNonQuotationHT)} />
                        <StatRow label="Quotation HT" value={formatHoursToHMS(avgQuotationHT)} />
                        <StatRow label="SPF Handling Duration" value={formatHoursToHMS(avgSpfHT)} />
                      </div>
                    )}
                  </SectionCard>

                  {/* Closing of Quotation */}
                  <SectionCard title="Closing of Quotation" accent="border-l-red-500">
                    <div className="space-y-1">
                      {[
                        { label: "Pending Client Approval", value: pendingClientApprovalCount },
                        { label: "Order Complete", value: orderCompleteCount },
                        { label: "Convert to SO", value: convertToSOCount },
                        { label: "Declined", value: declinedCount },
                        { label: "Cancelled", value: cancelledCount },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between items-center px-2 py-1.5 border-b border-gray-50 last:border-b-0">
                          <span className="text-[10px] text-red-500 font-medium">{label}</span>
                          <span className={`text-[11px] font-black ${value > 0 ? "text-red-600" : "text-gray-400"}`}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  {/* Report Summary */}
                  
                </ul>
              </div>

              {/* ── COVERAGE DIALOG ─────────────────────────────────────────────── */}
              {(() => {
                const isCovered = coverageDialogSource === "covered";
                const isUncovered = coverageDialogSource === "uncovered";
                const dialogOpen = isCovered || isUncovered;
                const list = isCovered ? coveredAccounts : uncoveredAccounts;

                const typeLabel = (normalized: string): string => {
                  const map: Record<string, string> = {
                    top50: "Top 50", next30: "Next 30", balance20: "Balance 20",
                    csrclient: "CSR Client", newclient: "New Client", tsaclient: "TSA Client",
                  };
                  return map[normalized] ?? normalized;
                };

                const typeColors: Record<string, string> = {
                  top50: "bg-amber-100 text-amber-700 border-amber-200",
                  next30: "bg-blue-100 text-blue-700 border-blue-200",
                  balance20: "bg-violet-100 text-violet-700 border-violet-200",
                  newclient: "bg-emerald-100 text-emerald-700 border-emerald-200",
                  tsaclient: "bg-rose-100 text-rose-700 border-rose-200",
                  csrclient: "bg-slate-100 text-slate-600 border-slate-200",
                };
                const pillColor = (t: string) =>
                  typeColors[t] ?? "bg-indigo-50 text-indigo-600 border-indigo-200";

                return (
                  <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setCoverageDialogSource(null); }}>
                    <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0 gap-0">
                      <DialogHeader className="px-4 py-3 border-b border-gray-100 shrink-0">
                        <div className="flex items-center justify-between">
                          <DialogTitle className="text-[11px] font-black uppercase tracking-wider text-gray-700">
                            {isCovered ? "Covered Accounts" : "Not Reached Accounts"}
                            <span className="ml-2 text-gray-400 font-normal">{list.length}</span>
                          </DialogTitle>
                          <div className="flex items-center gap-1 rounded-lg border border-gray-200 overflow-hidden">
                            <button
                              onClick={() => setCoverageDialogSource("covered")}
                              className={`px-2.5 py-1 text-[9px] font-bold uppercase transition-colors ${isCovered ? "bg-emerald-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                            >
                              Covered · {coveredAccounts.length}
                            </button>
                            <button
                              onClick={() => setCoverageDialogSource("uncovered")}
                              className={`px-2.5 py-1 text-[9px] font-bold uppercase transition-colors ${isUncovered ? "bg-amber-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                            >
                              Not Reached · {uncoveredAccounts.length}
                            </button>
                          </div>
                        </div>
                      </DialogHeader>

                      {list.length === 0 ? (
                        <p className="text-[11px] text-gray-300 italic px-4 py-6 text-center">
                          {isCovered
                            ? "No accounts reached in selected range."
                            : "All accounts have been reached in selected range."}
                        </p>
                      ) : (
                        <div className="overflow-y-auto flex-1">
                          <table className="w-full text-[10px] border-collapse">
                            <thead className="sticky top-0 bg-gray-50 z-10">
                              <tr>
                                <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-gray-500 border-b border-gray-200 w-[55%]">Company</th>
                                <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-gray-500 border-b border-gray-200 w-[45%]">Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {list.map((acc, i) => (
                                <tr key={`${acc.account_reference_number}-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                  <td className="px-3 py-2 text-gray-700 font-medium border-b border-gray-100">
                                    <span className="block" title={acc.company_name || "—"}>{acc.company_name || "—"}</span>
                                  </td>
                                  <td className="px-3 py-2 border-b border-gray-100">
                                    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${pillColor(acc.type_client ?? "")}`}>
                                      {typeLabel(acc.type_client ?? "—")}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                );
              })()}
            </div>
          </main>

          {/* Report Summary */}

          <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            <ReportSummary
              selectedAgentRefId={
                activeTab === "agent" ? selectedAgentRefId
                : activeTab === "tsm" ? selectedRefId
                : undefined
              }
              agentName={
                activeTab === "agent" && selectedAgentUser
                  ? `${selectedAgentUser.Lastname}, ${selectedAgentUser.Firstname}`
                  : activeTab === "tsm" && selectedAgent
                  ? `${selectedAgent.Lastname}, ${selectedAgent.Firstname}`
                  : undefined
              }
              fromDate={activeTab === "manager" ? fromDate : activeTab === "tsm" ? tsmFromDate : agentFromDate}
              toDate={activeTab === "manager" ? toDate : activeTab === "tsm" ? tsmToDate : agentToDate}
              dbTotal={denominators.total}
              dbActual={coveredAccounts.length}
            />
          </main>
        </SidebarInset>
      </ProtectedPageWrapper>
    </>
  );
}

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <DashboardContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}

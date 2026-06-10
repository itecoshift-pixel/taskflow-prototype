"use client";

import { useState, useEffect, useCallback } from "react";
import { sileo } from "sileo";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardActivity {
  account_reference_number: string;
  company_name?: string;
  date_created?: string;
  type_activity?: string;
  type_client?: string;
  [key: string]: any;
}

export interface ClientSegments {
  top50: number; next30: number; balance20: number;
  csrClient: number; newClient: number; tsaClient: number; outbound: number;
}

export interface Denominators {
  total: number; top50: number; next30: number; bal20: number;
  csrClient: number; newClient: number; tsaClient: number;
  daily: number; weekly: number; monthly: number;
}

export type TimeByActivity = Record<string, number>;

export type DashboardTab = "manager" | "tsm" | "agent";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const formatHoursToHMS = (hours: number): string => {
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
};

const normalizeCompany = (name: string): string =>
  (name || "").toLowerCase().replace(/\s+/g, " ").trim().replace(/\.+$/, "");

const isOutboundTouchbase = (a: any): boolean =>
  a.source === "Outbound - Touchbase" && a.call_status === "Successful";

const computeTimeByActivity = (activities: any[]): TimeByActivity =>
  activities.reduce((acc, act) => {
    if (!act.start_date || !act.end_date || !act.type_activity) return acc;
    const start = new Date(act.start_date).getTime();
    const end   = new Date(act.end_date).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return acc;
    acc[act.type_activity] = (acc[act.type_activity] || 0) + (end - start);
    return acc;
  }, {} as TimeByActivity);

const getFixedCount = (refId: string, date: Date): number => {
  const month = date.getMonth() + 1;
  const year  = date.getFullYear();
  const feb2026: Record<string, number> = {
    "RT-NCR-815758": 11, "MF-PH-840897": 7, "AB-NCR-288130": 11,
    "AS-NCR-146592": 4,  "MP-CDO-613398": 4, "JG-NCR-713768": 1, "JM-CBU-702043": 3,
  };
  const marchOnwards: Record<string, number> = {
    "RT-NCR-815758": 12, "MF-PH-840897": 5, "AB-NCR-288130": 11,
    "AS-NCR-146592": 4,  "MP-CDO-613398": 4, "JG-NCR-713768": 1, "JM-CBU-702043": 2,
  };
  if (year === 2026 && month === 2) return feb2026[refId] ?? 0;
  if (year > 2026 || (year === 2026 && month >= 3)) return marchOnwards[refId] ?? 0;
  return 0;
};

// ── CSR metrics parser (shared across manager/tsm/agent) ─────────────────────
const parseCsrMetrics = (data: any[], from: string, to: string) => {
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
  let qTotal  = 0, qCount  = 0;
  let spfTotal = 0, spfCount = 0;

  data.forEach((row) => {
    if (row.status !== "Closed" && row.status !== "Converted into Sales") return;
    const created = new Date(row.date_created).getTime();
    if (isNaN(created) || created < fromTs || created > toTs) return;
    if (excluded.includes(row.wrap_up)) return;

    const tsaAck   = new Date(row.tsa_acknowledge_date).getTime();
    const endorsed = new Date(row.ticket_endorsed).getTime();
    if (!isNaN(tsaAck) && !isNaN(endorsed) && tsaAck >= endorsed) {
      rtTotal += (tsaAck - endorsed) / 3_600_000; rtCount++;
    }

    const received  = new Date(row.ticket_received).getTime();
    const tsaHandle = new Date(row.tsa_handling_time).getTime();
    const tsmHandle = new Date(row.tsm_handling_time).getTime();
    let baseHT = 0;
    if (!isNaN(tsaHandle) && !isNaN(received) && tsaHandle >= received)
      baseHT = (tsaHandle - received) / 3_600_000;
    else if (!isNaN(tsmHandle) && !isNaN(received) && tsmHandle >= received)
      baseHT = (tsmHandle - received) / 3_600_000;
    if (!baseHT) return;

    const remarks = (row.remarks || "").toUpperCase();
    if (remarks === "QUOTATION FOR APPROVAL" || remarks === "SOLD") { qTotal += baseHT; qCount++; }
    else if (remarks.includes("SPF")) { spfTotal += baseHT; spfCount++; }
    else { nqTotal += baseHT; nqCount++; }
  });

  return {
    avgResponseTime:   rtCount  ? rtTotal  / rtCount  : 0,
    avgNonQuotationHT: nqCount  ? nqTotal  / nqCount  : 0,
    avgQuotationHT:    qCount   ? qTotal   / qCount   : 0,
    avgSpfHT:          spfCount ? spfTotal / spfCount : 0,
  };
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseDashboardDataOptions {
  userId: string;
  activeTab: DashboardTab;
  fromDate: string;
  toDate: string;
  tsmFromDate: string;
  tsmToDate: string;
  agentFromDate: string;
  agentToDate: string;
  selectedRefId: string;
  selectedAgentRefId: string;
  totalAgents: number;
  workingDays: number;
  agentsByTsm: Record<string, number>;
  userReferenceid: string;
}

export function useDashboardData({
  userId,
  activeTab,
  fromDate, toDate,
  tsmFromDate, tsmToDate,
  agentFromDate, agentToDate,
  selectedRefId,
  selectedAgentRefId,
  totalAgents,
  workingDays,
  agentsByTsm,
  userReferenceid,
}: UseDashboardDataOptions) {

  // ── Raw data ──────────────────────────────────────────────────────────────
  const [activities,      setActivities]      = useState<any[]>([]);
  const [clusterAccounts, setClusterAccounts] = useState<DashboardActivity[]>([]);

  // ── Loading flags ─────────────────────────────────────────────────────────
  const [loadingActivities,  setLoadingActivities]  = useState(false);
  const [loadingOverdue,     setLoadingOverdue]      = useState(false);
  const [loadingCsrMetrics,  setLoadingCsrMetrics]  = useState(false);
  const [loadingTime,        setLoadingTime]         = useState(false);

  // ── Derived metrics ───────────────────────────────────────────────────────
  const [timeByActivity,   setTimeByActivity]   = useState<TimeByActivity>({});
  const [timeConsumedMs,   setTimeConsumedMs]   = useState(0);
  const [totalSales,       setTotalSales]       = useState(0);
  const [newClientCount,   setNewClientCount]   = useState(0);
  const [outboundDaily,    setOutboundDaily]    = useState(0);
  const [clientSegments,   setClientSegments]   = useState<ClientSegments>({
    top50: 0, next30: 0, balance20: 0, csrClient: 0, newClient: 0, tsaClient: 0, outbound: 0,
  });
  const [denominators, setDenominators] = useState<Denominators>({
    total: 0, top50: 0, next30: 0, bal20: 0,
    csrClient: 0, newClient: 0, tsaClient: 0, daily: 0, weekly: 0, monthly: 0,
  });
  const [pendingClientApprovalCount, setPendingClientApprovalCount] = useState(0);
  const [orderCompleteCount,         setOrderCompleteCount]         = useState(0);
  const [convertToSOCount,           setConvertToSOCount]           = useState(0);
  const [declinedCount,              setDeclinedCount]              = useState(0);
  const [cancelledCount,             setCancelledCount]             = useState(0);
  const [avgResponseTime,            setAvgResponseTime]            = useState(0);
  const [avgNonQuotationHT,          setAvgNonQuotationHT]          = useState(0);
  const [avgQuotationHT,             setAvgQuotationHT]             = useState(0);
  const [avgSpfHT,                   setAvgSpfHT]                   = useState(0);
  const [overdueByCompany,           setOverdueByCompany]           = useState<Record<string, number>>({});
  const [overdueCount,               setOverdueCount]               = useState(0);
  const [coveredAccounts,            setCoveredAccounts]            = useState<DashboardActivity[]>([]);
  const [uncoveredAccounts,          setUncoveredAccounts]          = useState<DashboardActivity[]>([]);
  const [newClientByCompany,         setNewClientByCompany]         = useState<Record<string, number>>({});

  // ── Active date range helpers ─────────────────────────────────────────────
  const activeFrom = activeTab === "manager" ? fromDate : activeTab === "tsm" ? tsmFromDate : agentFromDate;
  const activeTo   = activeTab === "manager" ? toDate   : activeTab === "tsm" ? tsmToDate   : agentToDate;

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────

  const fetchClusterData = useCallback(async (refId: string) => {
    if (!refId) return;
    try {
      const PAGE_SIZE = 1000;
      let offset = 0, allAccounts: any[] = [], hasMore = true;
      while (hasMore) {
        const res = await fetch(`/api/com-fetch-manager-account?manager=${encodeURIComponent(refId)}&limit=${PAGE_SIZE}&offset=${offset}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        const batch: any[] = data.data || [];
        allAccounts = [...allAccounts, ...batch];
        hasMore = batch.length === PAGE_SIZE;
        offset += PAGE_SIZE;
      }
      const active = allAccounts.filter((a: any) => (a.status || "").toLowerCase() === "active");
      const byType = (v: string) => active.filter((a: any) => (a.type_client || "").trim().toLowerCase() === v).length;
      setDenominators((p) => ({ ...p, total: active.length, top50: byType("top 50"), next30: byType("next 30"), bal20: byType("balance 20"), csrClient: byType("csr client"), newClient: byType("new client"), tsaClient: byType("tsa client") }));
      setClusterAccounts(active.map((a: any) => ({ account_reference_number: a.account_reference_number, company_name: a.company_name, type_client: (a.type_client || "").toLowerCase().replace(/\s+/g, "") })));
    } catch { sileo.error({ title: "Error", description: "Failed to fetch cluster.", duration: 4000, position: "top-center" }); }
  }, []);

  const fetchActivities = useCallback(async (refId: string) => {
    if (!refId) return;
    setLoadingActivities(true);
    try {
      const res = await fetch(`/api/activity/manager/breaches/fetch?manager=${encodeURIComponent(refId)}`);
      if (!res.ok) throw new Error();
      setActivities((await res.json()).activities || []);
    } catch { sileo.error({ title: "Error", description: "Failed to fetch activities.", duration: 4000, position: "top-center" }); }
    finally { setLoadingActivities(false); }
  }, []);

  const fetchOverdue = useCallback(async (refId: string, from: string, to: string) => {
    if (!refId) return;
    setLoadingOverdue(true);
    try {
      const url = `/api/activity/manager/breaches/fetch-activity?manager=${encodeURIComponent(refId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const acts: any[] = (await res.json()).activities || [];
      const grouped: Record<string, number> = {};
      acts.forEach((a) => { const c = a.company_name || "Unknown"; grouped[c] = (grouped[c] || 0) + 1; });
      setOverdueByCompany(grouped);
      setOverdueCount(acts.length);
    } catch { sileo.error({ title: "Error", description: "Failed to fetch overdue.", duration: 4000, position: "top-center" }); }
    finally { setLoadingOverdue(false); }
  }, []);

  const fetchCsrMetrics = useCallback(async (refId: string, from: string, to: string) => {
    if (!refId) return;
    setLoadingCsrMetrics(true);
    try {
      const res = await fetch(`/api/activity/manager/breaches/fetch-ecodesk?referenceid=${encodeURIComponent(refId)}`);
      if (!res.ok) throw new Error();
      const metrics = parseCsrMetrics((await res.json()).data || [], from, to);
      setAvgResponseTime(metrics.avgResponseTime);
      setAvgNonQuotationHT(metrics.avgNonQuotationHT);
      setAvgQuotationHT(metrics.avgQuotationHT);
      setAvgSpfHT(metrics.avgSpfHT);
    } catch { /* silent */ } finally { setLoadingCsrMetrics(false); }
  }, []);

  // ── TSM variants ──────────────────────────────────────────────────────────

  const fetchTsmClusterData = useCallback(async (refId: string) => {
    if (!refId) return;
    try {
      const agentRes = await fetch(`/api/activity/tsm/breaches/fetch-agent?id=${encodeURIComponent(refId)}`);
      if (!agentRes.ok) throw new Error();
      const agentData: { ReferenceID: string; Status: string }[] = await agentRes.json();
      const activeAgents = agentData.filter((a) => (a.Status || "").toLowerCase() === "active");
      if (!activeAgents.length) { setClusterAccounts([]); setDenominators((p) => ({ ...p, total: 0, top50: 0, next30: 0, bal20: 0, csrClient: 0, newClient: 0, tsaClient: 0 })); return; }
      const excluded = ["removed", "approved for deletion", "subject for transfer"];
      const allowed  = ["top 50", "next 30", "balance 20", "tsa client", "csr client", "new client"];
      const results = await Promise.all(activeAgents.map((ag) =>
        fetch(`/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(ag.ReferenceID)}`)
          .then((r) => r.ok ? r.json() : { data: [] }).then((d) => (d.data || []) as any[]).catch(() => [] as any[])
      ));
      const allAccounts: DashboardActivity[] = results.flat()
        .filter((a: any) => { const s = (a.status || "").toLowerCase(); const t = (a.type_client || "").toLowerCase(); return a.status && a.type_client && !excluded.includes(s) && allowed.includes(t); })
        .map((a: any) => ({ account_reference_number: a.account_reference_number, company_name: a.company_name, type_client: (a.type_client || "").toLowerCase().replace(/\s+/g, "") }));
      const byType = (v: string) => allAccounts.filter((a) => a.type_client === v).length;
      setDenominators((p) => ({ ...p, total: allAccounts.length, top50: byType("top50"), next30: byType("next30"), bal20: byType("balance20"), csrClient: byType("csrclient"), newClient: byType("newclient"), tsaClient: byType("tsaclient") }));
      setClusterAccounts(allAccounts);
    } catch { /* silent */ }
  }, []);

  const fetchTsmActivities = useCallback(async (refId: string) => {
    if (!refId) return;
    setLoadingActivities(true);
    try {
      const res = await fetch(`/api/activity/manager/breaches/fetch-activity-tsm?tsm=${encodeURIComponent(refId)}&fetchAll=true`);
      if (!res.ok) throw new Error();
      setActivities((await res.json()).activities || []);
    } catch { sileo.error({ title: "Error", description: "Failed to fetch activities.", duration: 4000, position: "top-center" }); }
    finally { setLoadingActivities(false); }
  }, []);

  const fetchTsmOverdue = useCallback(async (refId: string, from: string, to: string) => {
    if (!refId || !from || !to) return;
    setLoadingOverdue(true);
    try {
      const res = await fetch(`/api/activity/manager/breaches/fetch-activity-tsm?tsm=${encodeURIComponent(refId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      if (!res.ok) throw new Error();
      const acts: any[] = (await res.json()).activities || [];
      const grouped: Record<string, number> = {};
      acts.forEach((a) => { const c = a.company_name || "Unknown"; grouped[c] = (grouped[c] || 0) + 1; });
      setOverdueByCompany(grouped);
      setOverdueCount(acts.length);
    } catch { /* silent */ } finally { setLoadingOverdue(false); }
  }, []);

  const fetchTsmCsrMetrics = useCallback(async (refId: string, from: string, to: string) => {
    if (!refId) return;
    setLoadingCsrMetrics(true);
    try {
      const res = await fetch(`/api/activity/manager/breaches/fetch-ecodesk-tsm?manager=${encodeURIComponent(refId)}&referenceid=${encodeURIComponent(refId)}`);
      if (!res.ok) throw new Error();
      const metrics = parseCsrMetrics((await res.json()).data || [], from, to);
      setAvgResponseTime(metrics.avgResponseTime);
      setAvgNonQuotationHT(metrics.avgNonQuotationHT);
      setAvgQuotationHT(metrics.avgQuotationHT);
      setAvgSpfHT(metrics.avgSpfHT);
    } catch { /* silent */ } finally { setLoadingCsrMetrics(false); }
  }, []);

  // ── Agent variants ────────────────────────────────────────────────────────

  const fetchAgentClusterData = useCallback(async (refId: string) => {
    if (!refId) return;
    try {
      const res = await fetch(`/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(refId)}`);
      if (!res.ok) throw new Error();
      const active: any[] = ((await res.json()).data || []).filter((a: any) => (a.status || "").toLowerCase() === "active");
      const byType = (v: string) => active.filter((a) => (a.type_client || "").trim().toLowerCase() === v).length;
      setDenominators((p) => ({ ...p, total: active.length, top50: byType("top 50"), next30: byType("next 30"), bal20: byType("balance 20"), csrClient: byType("csr client"), newClient: byType("new client"), tsaClient: byType("tsa client") }));
      setClusterAccounts(active.map((a) => ({ account_reference_number: a.account_reference_number, company_name: a.company_name, type_client: (a.type_client || "").toLowerCase().replace(/\s+/g, "") })));
    } catch { /* silent */ }
  }, []);

  const fetchAgentActivities = useCallback(async (refId: string) => {
    if (!refId) return;
    setLoadingActivities(true);
    try {
      const res = await fetch(`/api/activity/tsa/breaches/fetch?referenceid=${encodeURIComponent(refId)}&fetchAll=true`);
      if (!res.ok) throw new Error();
      setActivities((await res.json()).activities || []);
    } catch { sileo.error({ title: "Error", description: "Failed to fetch activities.", duration: 4000, position: "top-center" }); }
    finally { setLoadingActivities(false); }
  }, []);

  const fetchAgentOverdue = useCallback(async (refId: string, from: string, to: string) => {
    if (!refId || !from || !to) return;
    setLoadingOverdue(true);
    try {
      const res = await fetch(`/api/activity/tsa/breaches/fetch-activity?referenceid=${encodeURIComponent(refId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      if (!res.ok) throw new Error();
      const acts: any[] = (await res.json()).activities || [];
      const grouped: Record<string, number> = {};
      acts.forEach((a) => { const c = a.company_name || "Unknown"; grouped[c] = (grouped[c] || 0) + 1; });
      setOverdueByCompany(grouped);
      setOverdueCount(acts.length);
    } catch { /* silent */ } finally { setLoadingOverdue(false); }
  }, []);

  const fetchAgentCsrMetrics = useCallback(async (refId: string, from: string, to: string) => {
    if (!refId) return;
    setLoadingCsrMetrics(true);
    try {
      const res = await fetch(`/api/activity/manager/breaches/fetch-ecodesk-agent?agent=${encodeURIComponent(refId)}&referenceid=${encodeURIComponent(refId)}`);
      if (!res.ok) throw new Error();
      const metrics = parseCsrMetrics((await res.json()).data || [], from, to);
      setAvgResponseTime(metrics.avgResponseTime);
      setAvgNonQuotationHT(metrics.avgNonQuotationHT);
      setAvgQuotationHT(metrics.avgQuotationHT);
      setAvgSpfHT(metrics.avgSpfHT);
    } catch { /* silent */ } finally { setLoadingCsrMetrics(false); }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // AUTO-FETCH EFFECTS
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userReferenceid || activeTab !== "manager") return;
    fetchClusterData(userReferenceid);
    fetchActivities(userReferenceid);
    fetchOverdue(userReferenceid, fromDate, toDate);
    fetchCsrMetrics(userReferenceid, fromDate, toDate);
  }, [userReferenceid, fromDate, toDate, activeTab, fetchClusterData, fetchActivities, fetchOverdue, fetchCsrMetrics]);

  useEffect(() => {
    if (!selectedRefId || activeTab !== "tsm") return;
    setActivities([]); setOverdueByCompany({}); setOverdueCount(0);
    fetchTsmClusterData(selectedRefId);
    fetchTsmActivities(selectedRefId);
    fetchTsmOverdue(selectedRefId, tsmFromDate, tsmToDate);
    fetchTsmCsrMetrics(selectedRefId, tsmFromDate, tsmToDate);
  }, [selectedRefId, tsmFromDate, tsmToDate, activeTab, fetchTsmClusterData, fetchTsmActivities, fetchTsmOverdue, fetchTsmCsrMetrics]);

  useEffect(() => {
    if (!selectedAgentRefId || activeTab !== "agent") return;
    setActivities([]); setOverdueByCompany({}); setOverdueCount(0);
    fetchAgentClusterData(selectedAgentRefId);
    fetchAgentActivities(selectedAgentRefId);
    fetchAgentOverdue(selectedAgentRefId, agentFromDate, agentToDate);
    fetchAgentCsrMetrics(selectedAgentRefId, agentFromDate, agentToDate);
  }, [selectedAgentRefId, agentFromDate, agentToDate, activeTab, fetchAgentClusterData, fetchAgentActivities, fetchAgentOverdue, fetchAgentCsrMetrics]);

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTE EFFECTS
  // ─────────────────────────────────────────────────────────────────────────

  // Outbound, time, sales, quotation counts
  useEffect(() => {
    if (!activities.length) {
      setOutboundDaily(0); setTimeByActivity({}); setTimeConsumedMs(0);
      setTotalSales(0); setNewClientCount(0);
      setPendingClientApprovalCount(0); setOrderCompleteCount(0);
      setConvertToSOCount(0); setDeclinedCount(0); setCancelledCount(0);
      return;
    }
    setLoadingTime(true);
    try {
      const rangeStart = new Date(activeFrom); rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd   = new Date(activeTo);   rangeEnd.setHours(23, 59, 59, 999);
      const fixedCount = getFixedCount(userReferenceid, new Date(activeFrom));
      const rangeActs  = activities.filter((a) => { const t = new Date(a.date_created).getTime(); return t >= rangeStart.getTime() && t <= rangeEnd.getTime(); });

      const grouped = computeTimeByActivity(rangeActs);
      setTimeByActivity(grouped);
      setTimeConsumedMs(Object.values(grouped).reduce((s, ms) => s + ms, 0));

      let sales = 0;
      rangeActs.forEach((a) => { if (a.status === "Delivered") sales += Number(a.actual_sales) || 0; });
      setTotalSales(sales);

      const dailyCount = rangeActs.filter(isOutboundTouchbase).length;
      setOutboundDaily(dailyCount);

      const agentCount = activeTab === "manager"
        ? (totalAgents > 0 ? totalAgents : (fixedCount || 1))
        : (agentsByTsm[selectedRefId] || 1);
      const daysInRange = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000));
      const denom = agentCount * 20 * daysInRange;
      setDenominators((p) => ({ ...p, daily: denom, weekly: denom, monthly: denom }));

      setPendingClientApprovalCount(activities.filter((a) => a.status === "Quote-Done" && a.quotation_status === "Pending Client Approval").length);
      setOrderCompleteCount(activities.filter((a) => a.quotation_status === "Order Complete").length);
      setConvertToSOCount(activities.filter((a) => a.quotation_status === "Convert to SO").length);
      setDeclinedCount(activities.filter((a) => a.quotation_status === "Declined").length);
      setCancelledCount(activities.filter((a) => a.quotation_status === "Cancelled").length);
    } finally { setLoadingTime(false); }
  }, [activities, activeFrom, activeTo, userReferenceid, totalAgents, agentsByTsm, selectedRefId, activeTab]);

  // Territory coverage
  useEffect(() => {
    if (!clusterAccounts.length) {
      setCoveredAccounts([]); setUncoveredAccounts([]);
      setClientSegments({ top50: 0, next30: 0, balance20: 0, csrClient: 0, newClient: 0, tsaClient: 0, outbound: 0 });
      return;
    }
    const rangeStart = new Date(activeFrom); rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd   = new Date(activeTo);   rangeEnd.setHours(23, 59, 59, 999);
    const touched = new Set<string>();
    activities.forEach((a) => {
      if (!a.company_name || !a.date_created) return;
      const t = new Date(a.date_created).getTime();
      if (!isNaN(t) && t >= rangeStart.getTime() && t <= rangeEnd.getTime())
        touched.add(normalizeCompany(a.company_name));
    });
    const covered   = clusterAccounts.filter((a) =>  a.company_name && touched.has(normalizeCompany(a.company_name)));
    const uncovered = clusterAccounts.filter((a) => !a.company_name || !touched.has(normalizeCompany(a.company_name)));
    setCoveredAccounts(covered);
    setUncoveredAccounts(uncovered);
    const seg = { top50: 0, next30: 0, balance20: 0, csrClient: 0, newClient: 0, tsaClient: 0 };
    covered.forEach((a) => {
      const t = a.type_client ?? "";
      if      (t === "top50")     seg.top50++;
      else if (t === "next30")    seg.next30++;
      else if (t === "balance20") seg.balance20++;
      else if (t === "csrclient") seg.csrClient++;
      else if (t === "newclient") seg.newClient++;
      else if (t === "tsaclient") seg.tsaClient++;
    });
    setClientSegments({ ...seg, outbound: covered.length });
  }, [activities, clusterAccounts, activeFrom, activeTo]);

  // New clients
  useEffect(() => {
    if (!activities.length) { setNewClientByCompany({}); setNewClientCount(0); return; }
    const rangeStart = new Date(activeFrom); rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd   = new Date(activeTo);   rangeEnd.setHours(23, 59, 59, 999);
    const allowed = ["Assisted", "Quote-Done", "SO-Done", "Delivered"];
    const grouped: Record<string, number> = {};
    let total = 0;
    activities.forEach((a) => {
      const t = new Date(a.date_created).getTime();
      if (allowed.includes(a.status) && a.type_client === "New Client" && t >= rangeStart.getTime() && t <= rangeEnd.getTime()) {
        const c = a.company_name || "Unknown";
        grouped[c] = (grouped[c] || 0) + 1;
        total++;
      }
    });
    setNewClientByCompany(grouped);
    setNewClientCount(total);
  }, [activities, activeFrom, activeTo]);

  // ─────────────────────────────────────────────────────────────────────────
  // MANUAL SYNC
  // ─────────────────────────────────────────────────────────────────────────

  const sync = useCallback(() => {
    if (activeTab === "manager" && userReferenceid) {
      fetchClusterData(userReferenceid);
      fetchActivities(userReferenceid);
      fetchOverdue(userReferenceid, fromDate, toDate);
      fetchCsrMetrics(userReferenceid, fromDate, toDate);
    } else if (activeTab === "tsm" && selectedRefId) {
      fetchTsmClusterData(selectedRefId);
      fetchTsmActivities(selectedRefId);
      fetchTsmOverdue(selectedRefId, tsmFromDate, tsmToDate);
      fetchTsmCsrMetrics(selectedRefId, tsmFromDate, tsmToDate);
    } else if (activeTab === "agent" && selectedAgentRefId) {
      fetchAgentClusterData(selectedAgentRefId);
      fetchAgentActivities(selectedAgentRefId);
      fetchAgentOverdue(selectedAgentRefId, agentFromDate, agentToDate);
      fetchAgentCsrMetrics(selectedAgentRefId, agentFromDate, agentToDate);
    }
  }, [activeTab, userReferenceid, selectedRefId, selectedAgentRefId, fromDate, toDate, tsmFromDate, tsmToDate, agentFromDate, agentToDate,
      fetchClusterData, fetchActivities, fetchOverdue, fetchCsrMetrics,
      fetchTsmClusterData, fetchTsmActivities, fetchTsmOverdue, fetchTsmCsrMetrics,
      fetchAgentClusterData, fetchAgentActivities, fetchAgentOverdue, fetchAgentCsrMetrics]);

  // ─────────────────────────────────────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────────────────────────────────────

  return {
    // loading
    loadingActivities, loadingOverdue, loadingCsrMetrics, loadingTime,
    isAnySyncing: loadingActivities || loadingOverdue,
    // metrics
    outboundDaily, totalSales, timeByActivity, timeConsumedMs,
    coveredAccounts, uncoveredAccounts, clientSegments, denominators,
    overdueByCompany, overdueCount,
    newClientByCompany, newClientCount,
    pendingClientApprovalCount, orderCompleteCount, convertToSOCount, declinedCount, cancelledCount,
    avgResponseTime, avgNonQuotationHT, avgQuotationHT, avgSpfHT,
    // sync
    sync,
  };
}

"use client";

import React, { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCcw, Loader2, Settings } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { sileo } from "sileo";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { ReportSummary } from "@/components/roles/manager/dashboard/report-summary";
import { AIInsightsButton } from "@/components/roles/manager/dashboard/ai-insights-button";
import {
  OutboundPerformance, DatabaseCoverage, OverdueActivities, NewAccountDevt,
  TimeConsumed, TotalSales, CsrMetrics, ClosingQuotation, CoverageDialog,
} from "@/components/roles/manager/dashboard/cards";
import { useDashboardData, formatHoursToHMS, type DashboardTab } from "@/hooks/use-dashboard-data";

// ─── Main Component ───────────────────────────────────────────────────────────

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const queryUserId = searchParams?.get("id") ?? "";  const today = new Date().toISOString().split("T")[0];

  // ── URL sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  // ── Tab & date state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<DashboardTab>("manager");
  const [fromDate, setFromDate]   = useState(today);
  const [toDate, setToDate]       = useState(today);
  const [tsmFromDate, setTsmFromDate] = useState(today);
  const [tsmToDate, setTsmToDate]     = useState(today);
  const [agentFromDate, setAgentFromDate] = useState(today);
  const [agentToDate, setAgentToDate]     = useState(today);

  // ── User state ────────────────────────────────────────────────────────────
  const [userDetails, setUserDetails] = useState({ referenceid: "", firstname: "", lastname: "", role: "" });
  const [loadingUser, setLoadingUser] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoadingUser(true);
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => setUserDetails({ referenceid: d.ReferenceID || "", role: d.Role || "", firstname: d.Firstname || "", lastname: d.Lastname || "" }))
      .catch(() => sileo.error({ title: "Error", description: "Failed to load user.", duration: 4000, position: "top-center" }))
      .finally(() => setLoadingUser(false));
  }, [userId]);

  // ── TSM agent list ────────────────────────────────────────────────────────
  const [agents, setAgents] = useState<Array<{ Firstname: string; Lastname: string; ReferenceID: string; Status: string }>>([]);
  const [selectedRefId, setSelectedRefId] = useState("");
  const [loadingAgents, setLoadingAgents] = useState(false);

  useEffect(() => {
    if (!userDetails.referenceid || activeTab !== "tsm") return;
    setLoadingAgents(true);
    fetch(`/api/activity/manager/breaches/fetch-tsm?id=${encodeURIComponent(userDetails.referenceid)}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        const active = data.filter((a: any) => (a.Status || "").toLowerCase() === "active");
        setAgents(active);
        if (active.length > 0 && !selectedRefId) setSelectedRefId(active[0].ReferenceID);
      })
      .catch(() => {})
      .finally(() => setLoadingAgents(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDetails.referenceid, activeTab]);

  // ── Agent user list ───────────────────────────────────────────────────────
  const [agentUsers, setAgentUsers] = useState<Array<{ Firstname: string; Lastname: string; ReferenceID: string; Status: string; TSM?: string }>>([]);
  const [selectedAgentRefId, setSelectedAgentRefId] = useState("");
  const [loadingAgentUsers, setLoadingAgentUsers] = useState(false);

  useEffect(() => {
    if (!userDetails.referenceid || activeTab !== "agent") return;
    setLoadingAgentUsers(true);
    fetch(`/api/activity/manager/breaches/fetch-agent?id=${encodeURIComponent(userDetails.referenceid)}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        const active = data.filter((a: any) => (a.Status || "").toLowerCase() === "active");
        setAgentUsers(active);
        if (active.length > 0 && !selectedAgentRefId) setSelectedAgentRefId(active[0].ReferenceID);
      })
      .catch(() => {})
      .finally(() => setLoadingAgentUsers(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDetails.referenceid, activeTab]);

  // ── Config state (persisted) ──────────────────────────────────────────────
  const [totalAgents, setTotalAgents] = useState(() =>
    typeof window !== "undefined" ? Number(localStorage.getItem("tsm_totalAgents")) || 0 : 0);
  const [workingDays, setWorkingDays] = useState(() =>
    typeof window !== "undefined" ? Number(localStorage.getItem("tsm_workingDays")) || 26 : 26);
  const [agentsByTsm, setAgentsByTsm] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("tsm_report_agentsByTsm") || "{}"); } catch { return {}; }
  });

  useEffect(() => { localStorage.setItem("tsm_totalAgents", String(totalAgents)); }, [totalAgents]);
  useEffect(() => { localStorage.setItem("tsm_workingDays", String(workingDays)); localStorage.setItem("tsa_workingDays", String(workingDays)); }, [workingDays]);
  useEffect(() => { localStorage.setItem("tsm_report_agentsByTsm", JSON.stringify(agentsByTsm)); }, [agentsByTsm]);

  // ── Coverage dialog state ─────────────────────────────────────────────────
  const [coverageDialogSource, setCoverageDialogSource] = useState<"covered" | "uncovered" | null>(null);

  // ── Dashboard layout settings (persisted) ─────────────────────────────────
  const ALL_CARDS = [
    { key: "outbound",    label: "Outbound Performance" },
    { key: "coverage",    label: "Database Coverage" },
    { key: "overdue",     label: "Overdue Activities" },
    { key: "newaccount",  label: "New Account Devt" },
    { key: "time",        label: "Time Consumed" },
    { key: "sales",       label: "Total Sales" },
    { key: "csr",         label: "CSR Metrics" },
    { key: "quotation",   label: "Closing of Quotation" },
  ] as const;
  type CardKey = typeof ALL_CARDS[number]["key"];

  const [visibleCards, setVisibleCards] = useState<Set<CardKey>>(() => {
    if (typeof window === "undefined") return new Set(ALL_CARDS.map((c) => c.key));
    try {
      const saved = localStorage.getItem("dashboard_visible_cards");
      if (saved) return new Set(JSON.parse(saved) as CardKey[]);
    } catch {}
    return new Set(ALL_CARDS.map((c) => c.key));
  });

  const [settingsOpen, setSettingsOpen] = useState(false);

  const toggleCard = (key: CardKey) => {
    setVisibleCards((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      localStorage.setItem("dashboard_visible_cards", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const show = (key: CardKey) => visibleCards.has(key);

  // ── Data hook ─────────────────────────────────────────────────────────────
  const data = useDashboardData({
    userId: userId ?? "",
    activeTab,
    fromDate, toDate,
    tsmFromDate, tsmToDate,
    agentFromDate, agentToDate,
    selectedRefId,
    selectedAgentRefId,
    totalAgents,
    workingDays,
    agentsByTsm,
    userReferenceid: userDetails.referenceid,
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedAgent     = agents.find((a) => a.ReferenceID === selectedRefId);
  const selectedAgentUser = agentUsers.find((a) => a.ReferenceID === selectedAgentRefId);
  const activeFrom = activeTab === "manager" ? fromDate : activeTab === "tsm" ? tsmFromDate : agentFromDate;
  const activeTo   = activeTab === "manager" ? toDate   : activeTab === "tsm" ? tsmToDate   : agentToDate;
  const canSync    = activeTab === "manager" ? !!userDetails.referenceid : activeTab === "tsm" ? !!selectedRefId : !!selectedAgentRefId;

  const handleSync = () => {
    data.sync();
    const name = activeTab === "manager"
      ? `${userDetails.lastname}, ${userDetails.firstname}`
      : activeTab === "tsm" ? `${selectedAgent?.Lastname ?? ""}, ${selectedAgent?.Firstname ?? ""}` : `${selectedAgentUser?.Lastname ?? ""}, ${selectedAgentUser?.Firstname ?? ""}`;
    sileo.success({ title: "Syncing", description: `Refreshing data for ${name}`, duration: 3000, position: "top-right" });
  };

  const aiMetrics = {
    tab: activeTab, fromDate: activeFrom, toDate: activeTo,
    viewingName: activeTab === "tsm" && selectedAgent
      ? `${selectedAgent.Lastname}, ${selectedAgent.Firstname}`
      : activeTab === "agent" && selectedAgentUser
      ? `${selectedAgentUser.Lastname}, ${selectedAgentUser.Firstname}`
      : `${userDetails.lastname}, ${userDetails.firstname}`,
    totalAccounts: data.denominators.total,
    coveredAccounts: data.coveredAccounts.length,
    uncoveredAccounts: data.uncoveredAccounts.length,
    seg: { top50: data.clientSegments.top50, next30: data.clientSegments.next30, balance20: data.clientSegments.balance20, csrClient: data.clientSegments.csrClient, newClient: data.clientSegments.newClient, tsaClient: data.clientSegments.tsaClient },
    denom: { top50: data.denominators.top50, next30: data.denominators.next30, bal20: data.denominators.bal20, csrClient: data.denominators.csrClient, newClient: data.denominators.newClient, tsaClient: data.denominators.tsaClient },
    totalSales: data.totalSales, outboundDaily: data.outboundDaily, newClientCount: data.newClientCount,
    pendingClientApproval: data.pendingClientApprovalCount, orderComplete: data.orderCompleteCount,
    convertToSO: data.convertToSOCount, declined: data.declinedCount, cancelled: data.cancelledCount,
    avgResponseTime: formatHoursToHMS(data.avgResponseTime), avgNonQuotationHT: formatHoursToHMS(data.avgNonQuotationHT),
    avgQuotationHT: formatHoursToHMS(data.avgQuotationHT), avgSpfHT: formatHoursToHMS(data.avgSpfHT),
    overdueCount: data.overdueCount, overdueByCompany: data.overdueByCompany, newClientByCompany: data.newClientByCompany,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <ProtectedPageWrapper>
        <SidebarLeft />
        <SidebarInset className="overflow-hidden">

          {/* Header + tabs */}
          <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b">
            <div className="flex flex-1 items-center gap-2 px-3">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="line-clamp-1">
                      Dashboard — {activeTab === "manager" ? "Manager" : activeTab === "tsm" ? "TSM" : "Agent"} Reports
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 overflow-hidden ml-4">
                {(["manager", "tsm", "agent"] as DashboardTab[]).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-colors ${activeTab === tab ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                    {tab === "manager" ? "Manager Reports" : tab === "tsm" ? "TSM Reports" : "Agent Reports"}
                  </button>
                ))}
              </div>
            </div>
            {/* Settings button */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="ml-auto mr-3 flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors rounded-md"
              title="Dashboard Settings"
            >
              <Settings size={12} />
              Settings
            </button>
          </header>

          <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            <div className="space-y-4 pb-4">

              {/* Sync / Config panel */}
              <div className="bg-gray-50 border border-gray-200 p-3 space-y-3">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                  {activeTab === "manager" ? "Sync Configuration" : "Agent Selection"}
                </h4>

                {activeTab === "manager" && (
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                        {loadingUser ? "Loading..." : `${userDetails.lastname || "—"}, ${userDetails.firstname || "—"}`}
                      </label>
                      <Input className="h-7 text-[11px] font-mono rounded-none bg-white border-gray-200" value={userDetails.referenceid} disabled placeholder="Reference ID" />
                    </div>
                    <div>
                      <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">Total Agents</label>
                      <div className="flex gap-1.5">
                        <Input type="number" min={0} className="h-7 text-[11px] rounded-none bg-white border-gray-200 w-20" value={totalAgents || ""} onChange={(e) => setTotalAgents(Number(e.target.value) || 0)} placeholder="e.g. 27" />
                        <select className="h-7 text-[11px] rounded-none bg-white border border-gray-200 px-2 text-gray-700 font-mono flex-1 cursor-pointer" value={workingDays} onChange={(e) => setWorkingDays(Number(e.target.value))}>
                          <option value={26}>26 days</option>
                          <option value={22}>22 days</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">Start Date</label>
                      <Input type="date" className="h-7 text-[11px] rounded-none bg-white border-gray-200" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">End Date</label>
                      <Input type="date" className="h-7 text-[11px] rounded-none bg-white border-gray-200" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </div>
                  </div>
                )}

                {activeTab === "tsm" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                        {loadingUser ? "Loading..." : `TSM: ${userDetails.lastname || "—"}, ${userDetails.firstname || "—"}`}
                      </label>
                      {loadingAgents ? (
                        <div className="flex items-center gap-2 text-gray-400 h-8"><Loader2 className="w-3 h-3 animate-spin" /><span className="text-[10px]">Loading agents...</span></div>
                      ) : agents.length === 0 ? (
                        <p className="text-[10px] text-gray-400 italic h-8 flex items-center">No agents found</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {agents.map((a) => (
                            <button key={a.ReferenceID} onClick={() => setSelectedRefId(a.ReferenceID)}
                              className={`text-[9px] font-bold uppercase px-2 py-1 border transition-colors ${a.ReferenceID === selectedRefId ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900"}`}>
                              {a.Lastname}, {a.Firstname}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">Start Date</label>
                        <Input type="date" className="h-7 text-[11px] rounded-none bg-white border-gray-200" value={tsmFromDate} onChange={(e) => setTsmFromDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">End Date</label>
                        <Input type="date" className="h-7 text-[11px] rounded-none bg-white border-gray-200" value={tsmToDate} onChange={(e) => setTsmToDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">Agents ({selectedRefId ? (agentsByTsm[selectedRefId] || 0) : "—"})</label>
                        <Input type="number" min={0} className="h-7 text-[11px] rounded-none bg-white border-gray-200" value={selectedRefId ? (agentsByTsm[selectedRefId] || "") : ""} placeholder="e.g. 5" disabled={!selectedRefId}
                          onChange={(e) => { if (!selectedRefId) return; setAgentsByTsm((p) => ({ ...p, [selectedRefId]: Number(e.target.value) || 0 })); }} />
                      </div>
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">Working Days</label>
                        <select className="h-7 w-full text-[11px] rounded-none bg-white border border-gray-200 px-2 text-gray-700 font-mono cursor-pointer" value={workingDays} onChange={(e) => setWorkingDays(Number(e.target.value))}>
                          <option value={26}>26 days</option><option value={22}>22 days</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "agent" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                        {loadingUser ? "Loading..." : `Manager: ${userDetails.lastname || "—"}, ${userDetails.firstname || "—"}`}
                      </label>
                      {loadingAgentUsers ? (
                        <div className="flex items-center gap-2 text-gray-400 h-8"><Loader2 className="w-3 h-3 animate-spin" /><span className="text-[10px]">Loading agents...</span></div>
                      ) : agentUsers.length === 0 ? (
                        <p className="text-[10px] text-gray-400 italic h-8 flex items-center">No agents found</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {agentUsers.map((a) => (
                            <button key={a.ReferenceID} onClick={() => setSelectedAgentRefId(a.ReferenceID)}
                              className={`text-[9px] font-bold uppercase px-2 py-1 border transition-colors ${a.ReferenceID === selectedAgentRefId ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900"}`}>
                              {a.Lastname}, {a.Firstname}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">Start Date</label>
                        <Input type="date" className="h-7 text-[11px] rounded-none bg-white border-gray-200" value={agentFromDate} onChange={(e) => setAgentFromDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">End Date</label>
                        <Input type="date" className="h-7 text-[11px] rounded-none bg-white border-gray-200" value={agentToDate} onChange={(e) => setAgentToDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">Working Days</label>
                        <select className="h-7 w-full text-[11px] rounded-none bg-white border border-gray-200 px-2 text-gray-700 font-mono cursor-pointer" value={workingDays} onChange={(e) => setWorkingDays(Number(e.target.value))}>
                          <option value={26}>26 days</option><option value={22}>22 days</option>
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

                <Button className="w-full h-8 bg-gray-900 hover:bg-gray-800 text-[10px] uppercase font-black tracking-wider gap-2 rounded-none"
                  onClick={handleSync} disabled={data.isAnySyncing || !canSync}>
                  {data.isAnySyncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCcw size={11} />}
                  {data.isAnySyncing ? "Syncing..." : "Sync Data"}
                </Button>
                <AIInsightsButton metrics={aiMetrics} disabled={data.isAnySyncing || !canSync} />
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-3">
                <ul className="list-none space-y-3">
                  {show("outbound")   && <OutboundPerformance outboundDaily={data.outboundDaily} />}
                  {show("coverage")   && (
                    <DatabaseCoverage
                      coveredCount={data.coveredAccounts.length}
                      uncoveredCount={data.uncoveredAccounts.length}
                      denominators={data.denominators}
                      clientSegments={data.clientSegments}
                      onOpenDialog={setCoverageDialogSource}
                    />
                  )}
                  {show("overdue")    && <OverdueActivities overdueByCompany={data.overdueByCompany} overdueCount={data.overdueCount} loading={data.loadingOverdue} />}
                  {show("newaccount") && <NewAccountDevt newClientByCompany={data.newClientByCompany} newClientCount={data.newClientCount} />}
                </ul>
                <ul className="list-none space-y-3">
                  {show("time")      && <TimeConsumed timeByActivity={data.timeByActivity} timeConsumedMs={data.timeConsumedMs} loading={data.loadingTime} />}
                  {show("sales")     && <TotalSales totalSales={data.totalSales} />}
                  {show("csr")       && <CsrMetrics avgResponseTime={data.avgResponseTime} avgNonQuotationHT={data.avgNonQuotationHT} avgQuotationHT={data.avgQuotationHT} avgSpfHT={data.avgSpfHT} loading={data.loadingCsrMetrics} />}
                  {show("quotation") && <ClosingQuotation pendingClientApprovalCount={data.pendingClientApprovalCount} orderCompleteCount={data.orderCompleteCount} convertToSOCount={data.convertToSOCount} declinedCount={data.declinedCount} cancelledCount={data.cancelledCount} />}
                </ul>
              </div>

              <CoverageDialog
                source={coverageDialogSource}
                onClose={() => setCoverageDialogSource(null)}
                coveredAccounts={data.coveredAccounts}
                uncoveredAccounts={data.uncoveredAccounts}
                onToggle={setCoverageDialogSource}
              />
            </div>
          </main>

          <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            <ReportSummary
              selectedAgentRefId={activeTab === "agent" ? selectedAgentRefId : activeTab === "tsm" ? selectedRefId : undefined}
              agentName={
                activeTab === "agent" && selectedAgentUser ? `${selectedAgentUser.Lastname}, ${selectedAgentUser.Firstname}`
                : activeTab === "tsm" && selectedAgent ? `${selectedAgent.Lastname}, ${selectedAgent.Firstname}`
                : undefined
              }
              fromDate={activeFrom}
              toDate={activeTo}
              dbTotal={data.denominators.total}
              dbActual={data.coveredAccounts.length}
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

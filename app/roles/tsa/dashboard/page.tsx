"use client";

import React, { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { type DateRange } from "react-day-picker";
import { sileo } from "sileo";
import { Settings, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Cards
import { RunningTargetCard } from "@/components/roles/tsa/dashboard/card/running-target";
import { RunningSiCard } from "@/components/roles/tsa/dashboard/card/running-si";
import { RunningSoCard } from "@/components/roles/tsa/dashboard/card/running-so";
import { OutboundTouchbaseCountCard } from "@/components/roles/tsa/dashboard/card/outbound-touchbase-count";
import { SalesPipelineCard } from "@/components/roles/tsa/dashboard/card/sales-pipeline";
import { SiSoAchievementCard } from "@/components/roles/tsa/dashboard/card/si-so-achievement";
import { MonthlySiTrendCard } from "@/components/roles/tsa/dashboard/card/monthly-si-trend";
import { TsaPerformanceDetail } from "@/components/roles/tsa/dashboard/card/tsa-performance-detail";
import { KpiWeightedScores } from "@/components/roles/tsa/dashboard/card/kpi-weighted-scores";

//
import { AccountCard } from "@/components/roles/tsa/dashboard/card/accounts";
import { OutboundTouchbaseCard } from "@/components/roles/tsa/dashboard/card/outbound-touchbase";
import { TimemotionCard } from "@/components/roles/tsa/dashboard/card/time-and-motion";
import { ActivityCard } from "@/components/roles/tsa/dashboard/card/other-activities";
// Charts
import { SourceCard } from "@/components/roles/tsa/dashboard/chart/source";
import { CSRMetricsCard } from "@/components/roles/tsa/dashboard/chart/csr";
// Lists
import { OutboundCallsCard } from "@/components/roles/tsa/dashboard/list/outbound";
import { QuotationCard } from "@/components/roles/tsa/dashboard/list/quotation";
import { SOCard } from "@/components/roles/tsa/dashboard/list/so";
// Maps
import { SiteVisitCard } from "@/components/roles/tsa/dashboard/maps/site-visit";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { UnifiedNotificationBellLazy } from "@/components/unified-notification-bell-lazy";

/* ================= TYPES ================= */

interface UserDetails {
  referenceid: string;
  tsm?: string;
  manager?: string;
  firstname?: string;
  lastname?: string;
}

interface Activity {
  referenceid: string;
  source?: string;
  call_status?: string;
  date_created: string;
  start_date?: string;
  end_date?: string;
  type_activity: string;
  status: string;
  actual_sales: string;
  quotation_number: string;
  quotation_amount: string;
  so_number: string;
  so_amount: string;
  type_client: string;
  activity_reference_number: string;
  company_name?: string;
}

/* ================= HELPERS ================= */

/** Narrows DateRange (optional from/to) into a strict { from, to } object. */
function toStrictRange(
  range: DateRange | undefined
): { from: Date; to: Date } | undefined {
  if (range?.from && range?.to) return { from: range.from, to: range.to };
  return undefined;
}

/** Format a Date to YYYY-MM-DD string for API params. */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* ================= CARD VISIBILITY ================= */

const VISIBILITY_KEY = "tsa_dashboard_visibility";

interface CardVisibility {
  summaryCards:    boolean;
  salesPipeline:   boolean;
  siSoAchievement: boolean;
  monthlySiTrend:  boolean;
  tsaPerformance:  boolean;
  kpiScores:       boolean;
  accountCards:    boolean;
  charts:          boolean;
  outboundList:    boolean;
  quotationList:   boolean;
  soList:          boolean;
  siteVisit:       boolean;
}

// Cards in the AP (KPI) pattern group
const AP_CARDS: (keyof CardVisibility)[] = [
  "summaryCards", "salesPipeline", "siSoAchievement",
  "monthlySiTrend", "tsaPerformance", "kpiScores",
];

// Cards in the BR (Activity) pattern group
const BR_CARDS: (keyof CardVisibility)[] = [
  "accountCards", "charts", "outboundList",
  "quotationList", "soList", "siteVisit",
];

const ALL_VISIBLE: CardVisibility = {
  summaryCards: true, salesPipeline: true, siSoAchievement: true,
  monthlySiTrend: true, tsaPerformance: true, kpiScores: true,
  accountCards: true, charts: true, outboundList: true,
  quotationList: true, soList: true, siteVisit: true,
};

const DEFAULT_VISIBILITY = ALL_VISIBLE;

const CARD_LABELS: Record<keyof CardVisibility, string> = {
  summaryCards:    "Summary Cards (Target, SI, SO, OB Calls)",
  salesPipeline:   "Sales Pipeline",
  siSoAchievement: "SI vs SO Achievement",
  monthlySiTrend:  "Monthly SI Trend",
  tsaPerformance:  "TSA Performance Detail",
  kpiScores:       "KPI Weighted Scores",
  accountCards:    "Account / Activity Cards",
  charts:          "Source & CSR Metrics Charts",
  outboundList:    "Outbound Calls List",
  quotationList:   "Quotation List",
  soList:          "Sales Order List",
  siteVisit:       "Site Visit Map",
};

/**
 * Derive default visibility based on the manager's ReferenceID prefix.
 * AP prefix  → show AP (KPI) cards only
 * BR prefix  → show BR (Activity) cards only
 * anything else / empty → show everything
 */
function defaultForManager(manager?: string): CardVisibility {
  if (!manager) return { ...ALL_VISIBLE };
  const prefix = manager.split("-")[0]?.toUpperCase();
  if (prefix === "AP") {
    const v = { ...ALL_VISIBLE };
    BR_CARDS.forEach((k) => { v[k] = false; });
    return v;
  }
  if (prefix === "BR") {
    const v = { ...ALL_VISIBLE };
    AP_CARDS.forEach((k) => { v[k] = false; });
    return v;
  }
  return { ...ALL_VISIBLE };
}

function loadVisibility(manager?: string): CardVisibility {
  try {
    const raw = localStorage.getItem(VISIBILITY_KEY);
    if (!raw) return defaultForManager(manager);
    return { ...ALL_VISIBLE, ...JSON.parse(raw) };
  } catch {
    return defaultForManager(manager);
  }
}

function saveVisibility(v: CardVisibility) {
  try { localStorage.setItem(VISIBILITY_KEY, JSON.stringify(v)); } catch {}
}

/* ================= MAIN CONTENT ================= */

function DashboardContent() {
  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] =
    React.useState<DateRange | undefined>(undefined);

  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  /* ---- Card visibility ---- */
  const [visibility, setVisibility] = useState<CardVisibility>(DEFAULT_VISIBILITY);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toggleCard = (key: keyof CardVisibility) => {
    setVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Save only the explicit overrides vs manager default
      const managerDef = defaultForManager(userDetails.manager);
      const overrides: Partial<CardVisibility> = {};
      (Object.keys(next) as (keyof CardVisibility)[]).forEach((k) => {
        if (next[k] !== managerDef[k]) overrides[k] = next[k];
      });
      saveVisibility(overrides as CardVisibility);
      return next;
    });
  };

  /* Default to today on first load */
  useEffect(() => {
    if (!dateCreatedFilterRange) {
      const today = new Date();
      setDateCreatedFilterRangeAction({
        from: new Date(today.setHours(0, 0, 0, 0)),
        to: new Date(new Date().setHours(23, 59, 59, 999)),
      });
    }
  }, [dateCreatedFilterRange]);

  /* Sync userId from URL */
  const queryUserId = searchParams?.get("id") ?? "";
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  /* ---- User ---- */
  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
    tsm: "",
    manager: "",
    firstname: "",
    lastname: "",
  });
  const [loadingUser, setLoadingUser] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoadingUser(false);
      return;
    }

    const fetchUserData = async () => {
      setLoadingUser(true);
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error("Failed to fetch user data");
        const data = await res.json();

        setUserDetails({
          referenceid: data.ReferenceID || "",
          tsm: data.TSM || "",
          manager: data.Manager || "",
          firstname: data.Firstname || "",
          lastname: data.Lastname || "",
        });

        // Cache referenceid for the TSA layout notification dialog
        if (data.ReferenceID) {
          sessionStorage.setItem("tsa_referenceid", data.ReferenceID);
        }

        // Always re-derive from manager default on every load.
        // User's manual toggles are stored as *overrides* on top of the manager default.
        const managerDef = defaultForManager(data.Manager || "");
        const overridesRaw = localStorage.getItem(VISIBILITY_KEY);
        if (overridesRaw) {
          try {
            const overrides = JSON.parse(overridesRaw);
            // Detect stale all-true saves (old format before manager-aware defaults)
            const allTrue = Object.values(overrides).every((v) => v === true);
            if (allTrue) {
              // Stale save — clear it and use manager default
              localStorage.removeItem(VISIBILITY_KEY);
              setVisibility(managerDef);
            } else {
              setVisibility({ ...managerDef, ...overrides });
            }
          } catch {
            setVisibility(managerDef);
          }
        } else {
          setVisibility(managerDef);
        }

        sileo.success({
          title: "Success",
          description: "User data loaded successfully!",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
      } catch {
        sileo.error({
          title: "Failed",
          description:
            "Failed to connect to server. Please try again later or refresh your network connection.",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId]);

  /* ---- Sales Quota Target & Quote Target ---- */
  const [salesQuotaTotal, setSalesQuotaTotal] = useState<number>(0);
  const [quoteTarget, setQuoteTarget] = useState<number>(120); // Default target
  const [loadingSalesQuota, setLoadingSalesQuota] = useState(false);

  const fetchSalesQuota = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) {
      setSalesQuotaTotal(0);
      setQuoteTarget(120);
      return;
    }

    setLoadingSalesQuota(true);
    try {
      // Fetch sales quota (for running target)
      const [quotaRes, quotationRes] = await Promise.all([
        fetch(`/api/sales-quota?referenceid=${encodeURIComponent(referenceid)}`),
        fetch(`/api/sales-quotation?referenceid=${encodeURIComponent(referenceid)}`)
      ]);

      if (!quotaRes.ok) throw new Error("Failed to fetch sales quota");
      if (!quotationRes.ok) throw new Error("Failed to fetch sales quotation");

      const quotaData = await quotaRes.json();
      const quotationData = await quotationRes.json();

      setSalesQuotaTotal(Number(quotaData.total) || 0);
      setQuoteTarget(Number(quotationData.quoteTarget) || 0);
    } catch (err) {
      console.error("Error fetching sales data:", err);
    } finally {
      setLoadingSalesQuota(false);
    }
  }, [userDetails.referenceid]);

  useEffect(() => {
    fetchSalesQuota();
  }, [fetchSalesQuota]);

  /* ---- History Totals ---- */
  const [totalActualSales, setTotalActualSales] = useState<number>(0);
  const [totalSoAmount, setTotalSoAmount] = useState<number>(0);
  const [loadingHistory, setLoadingHistory] = useState(false);

  /* ---- Outbound Calls Count & Target ---- */
  const [outboundCallsCount, setOutboundCallsCount] = useState<number>(0);
  const [loadingOutboundCalls, setLoadingOutboundCalls] = useState(false);
  const [outboundCallsTarget, setOutboundCallsTarget] = useState<number>(0);
  const [loadingOutboundCallsTarget, setLoadingOutboundCallsTarget] = useState(false);

  /* ---- Approved Quotes Count ---- */
  const [quotesCount, setQuotesCount] = useState<number>(0);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  /* ---- Calls to Quotes Count ---- */
  const [callsToQuotesCount, setCallsToQuotesCount] = useState<number>(0);
  const [loadingCallsToQuotes, setLoadingCallsToQuotes] = useState(false);

  /* ---- Quote to SO Count ---- */
  const [quoteToSOQuotationCount, setQuoteToSOQuotationCount] = useState<number>(0);
  const [quoteToSOSalesOrderCount, setQuoteToSOSalesOrderCount] = useState<number>(0);
  const [loadingQuoteToSO, setLoadingQuoteToSO] = useState(false);

  /* ---- SO to SI Count ---- */
  const [soToSISalesOrderCount, setSoToSISalesOrderCount] = useState<number>(0);
  const [soToSIDeliveredCount, setSoToSIDeliveredCount] = useState<number>(0);

  const fetchOutboundCalls = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) { setOutboundCallsCount(0); return; }
    setLoadingOutboundCalls(true);
    try {
      const url = new URL("/api/history-outbound", window.location.origin);
      url.searchParams.append("referenceid", referenceid);
      if (dateCreatedFilterRange?.from) url.searchParams.append("from", toDateStr(dateCreatedFilterRange.from));
      if (dateCreatedFilterRange?.to)   url.searchParams.append("to",   toDateStr(dateCreatedFilterRange.to));
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch outbound calls");
      const data = await res.json();
      setOutboundCallsCount(Number(data.count) || 0);
    } catch (err) {
      console.error("Error fetching outbound calls:", err);
    } finally {
      setLoadingOutboundCalls(false);
    }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  const fetchOutboundCallsTarget = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) {
      setOutboundCallsTarget(0);
      return;
    }

    setLoadingOutboundCallsTarget(true);
    try {
      const res = await fetch(`/api/sales-ob?referenceid=${encodeURIComponent(referenceid)}`);
      if (!res.ok) throw new Error("Failed to fetch sales ob target");
      const data = await res.json();
      setOutboundCallsTarget(Number(data.target) || 0);
    } catch (err) {
      console.error("Error fetching sales ob target:", err);
    } finally {
      setLoadingOutboundCallsTarget(false);
    }
  }, [userDetails.referenceid]);

  const fetchApprovedQuotes = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) { setQuotesCount(0); return; }
    setLoadingQuotes(true);
    try {
      const url = new URL("/api/history-quotations", window.location.origin);
      url.searchParams.append("referenceid", referenceid);
      if (dateCreatedFilterRange?.from) url.searchParams.append("from", toDateStr(dateCreatedFilterRange.from));
      if (dateCreatedFilterRange?.to)   url.searchParams.append("to",   toDateStr(dateCreatedFilterRange.to));
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch approved quotations");
      const data = await res.json();
      setQuotesCount(Number(data.count) || 0);
    } catch (err) {
      console.error("Error fetching approved quotations:", err);
    } finally {
      setLoadingQuotes(false);
    }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  const fetchCallsToQuotes = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) { setCallsToQuotesCount(0); return; }
    setLoadingCallsToQuotes(true);
    try {
      const url = new URL("/api/history-calls-to-quotes", window.location.origin);
      url.searchParams.append("referenceid", referenceid);
      if (dateCreatedFilterRange?.from) url.searchParams.append("from", toDateStr(dateCreatedFilterRange.from));
      if (dateCreatedFilterRange?.to)   url.searchParams.append("to",   toDateStr(dateCreatedFilterRange.to));
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch calls to quotes");
      const data = await res.json();
      setCallsToQuotesCount(Number(data.count) || 0);
    } catch (err) {
      console.error("Error fetching calls to quotes:", err);
    } finally {
      setLoadingCallsToQuotes(false);
    }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  const fetchQuoteToSO = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) { setQuoteToSOQuotationCount(0); setQuoteToSOSalesOrderCount(0); return; }
    setLoadingQuoteToSO(true);
    try {
      const url = new URL("/api/history-quote-to-so", window.location.origin);
      url.searchParams.append("referenceid", referenceid);
      if (dateCreatedFilterRange?.from) url.searchParams.append("from", toDateStr(dateCreatedFilterRange.from));
      if (dateCreatedFilterRange?.to)   url.searchParams.append("to",   toDateStr(dateCreatedFilterRange.to));
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch quote to SO");
      const data = await res.json();
      setQuoteToSOQuotationCount(Number(data.quoteToSOQuotationCount) || 0);
      setQuoteToSOSalesOrderCount(Number(data.quoteToSOSalesOrderCount) || 0);
    } catch (err) {
      console.error("Error fetching quote to SO:", err);
    } finally {
      setLoadingQuoteToSO(false);
    }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  const fetchSoToSI = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) { setSoToSISalesOrderCount(0); setSoToSIDeliveredCount(0); return; }
    try {
      const url = new URL("/api/history-so-to-si", window.location.origin);
      url.searchParams.append("referenceid", referenceid);
      if (dateCreatedFilterRange?.from) url.searchParams.append("from", toDateStr(dateCreatedFilterRange.from));
      if (dateCreatedFilterRange?.to)   url.searchParams.append("to",   toDateStr(dateCreatedFilterRange.to));
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch SO to SI");
      const data = await res.json();
      setSoToSISalesOrderCount(Number(data.soToSISalesOrderCount) || 0);
      setSoToSIDeliveredCount(Number(data.soToSIDeliveredCount) || 0);
    } catch (err) {
      console.error("Error fetching SO to SI:", err);
    }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  /* ---- Client Visits Count (current month Login entries) ---- */
  const [clientVisitsCount, setClientVisitsCount] = useState<number>(0);

  /* ---- New Account Development ---- */
  const [newAccountCount, setNewAccountCount]   = useState<number>(0);
  const [newAccountTarget, setNewAccountTarget] = useState<number>(2);
  const [loadingNewAccount, setLoadingNewAccount] = useState(false);

  /* ---- CSR Metrics (lifted from CSRMetricsCard) ---- */
  const [csrAvgResponseTime, setCsrAvgResponseTime] = useState<number>(0);
  const [csrAvgQuotationHT, setCsrAvgQuotationHT] = useState<number>(0);
  const [csrAvgNonQuotationHT, setCsrAvgNonQuotationHT] = useState<number>(0);

  const fetchClientVisits = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) { setClientVisitsCount(0); return; }
    try {
      const res = await fetch(`/api/fetch-tasklog?referenceid=${encodeURIComponent(referenceid)}`);
      if (!res.ok) throw new Error("Failed to fetch client visits");
      const data = await res.json();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const count = (data.siteVisits || []).filter((v: any) => {
        if (v.Status !== "Login") return false;
        const d = new Date(v.date_created);
        return !isNaN(d.getTime()) && d >= monthStart;
      }).length;
      setClientVisitsCount(count);
    } catch (err) {
      console.error("Error fetching client visits:", err);
    }
  }, [userDetails.referenceid]);

  const fetchNewAccount = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) { setNewAccountCount(0); setNewAccountTarget(2); return; }
    setLoadingNewAccount(true);
    try {
      const res = await fetch(`/api/sales-account-development?referenceid=${encodeURIComponent(referenceid)}`);
      if (!res.ok) throw new Error("Failed to fetch new account development");
      const data = await res.json();
      setNewAccountCount(Number(data.count)  || 0);
      setNewAccountTarget(Number(data.target) || 2);
    } catch (err) {
      console.error("Error fetching new account development:", err);
    } finally {
      setLoadingNewAccount(false);
    }
  }, [userDetails.referenceid]);

  useEffect(() => {
    fetchOutboundCalls();
    fetchOutboundCallsTarget();
    fetchApprovedQuotes();
    fetchCallsToQuotes();
    fetchQuoteToSO();
    fetchSoToSI();
    fetchClientVisits();
    fetchNewAccount();
  }, [fetchOutboundCalls, fetchOutboundCallsTarget, fetchApprovedQuotes, fetchCallsToQuotes, fetchQuoteToSO, fetchSoToSI, fetchClientVisits, fetchNewAccount]);

  const fetchHistory = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) { setTotalActualSales(0); setTotalSoAmount(0); return; }
    setLoadingHistory(true);
    try {
      const fromStr = dateCreatedFilterRange?.from ? toDateStr(dateCreatedFilterRange.from) : null;
      const toStr   = dateCreatedFilterRange?.to   ? toDateStr(dateCreatedFilterRange.to)   : null;
      const params  = new URLSearchParams({ referenceid });
      if (fromStr) params.append("from", fromStr);
      if (toStr)   params.append("to",   toStr);

      const [siRes, soRes] = await Promise.all([
        fetch(`/api/history?${params}`),
        fetch(`/api/history-so?${params}`),
      ]);
      if (!siRes.ok) throw new Error("Failed to fetch history si");
      if (!soRes.ok) throw new Error("Failed to fetch history so");
      const siData = await siRes.json();
      const soData = await soRes.json();
      setTotalActualSales(Number(siData.total) || 0);
      setTotalSoAmount(Number(soData.total) || 0);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  /* ---- Activities ---- */
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);

  const fetchActivities = useCallback(() => {
    const { referenceid } = userDetails;
    if (!referenceid) {
      setActivities([]);
      return;
    }

    setLoadingActivities(true);
    setErrorActivities(null);

    const from = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
      : null;
    const to = dateCreatedFilterRange?.to
      ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
      : null;

    const url = new URL(
      "/api/activity/tsa/dashboard/fetch",
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
      .catch((err) => setErrorActivities(err.message))
      .finally(() => setLoadingActivities(false));
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  /* ---- Client-side date filter ---- */
  const filteredActivities = useMemo(() => {
    if (!dateCreatedFilterRange?.from) return activities;

    const from = new Date(dateCreatedFilterRange.from);
    from.setHours(0, 0, 0, 0);
    const to = dateCreatedFilterRange.to
      ? new Date(new Date(dateCreatedFilterRange.to).setHours(23, 59, 59, 999))
      : null;

    return activities.filter((a) => {
      if (!a.date_created) return true;
      const d = new Date(a.date_created);
      if (d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [activities, dateCreatedFilterRange]);

  /* Shared props passed to many cards */
  const cardProps = {
    activities: filteredActivities,
    loading: loadingActivities,
    error: errorActivities,
  };

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset>
        {/* Top bar */}
        <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 z-[50]">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs font-semibold uppercase tracking-wide">
                    KPI Dashboard
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2 px-3">
            <UnifiedNotificationBellLazy />
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
              aria-label="Dashboard settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-4 p-4">

          {/* ── Settings panel (slide-in from right) ── */}
          {settingsOpen && (
            <div className="fixed inset-0 z-[200] flex justify-end">
              {/* backdrop */}
              <div
                className="absolute inset-0 bg-black/20"
                onClick={() => setSettingsOpen(false)}
              />
              {/* panel */}
              <div className="relative w-80 h-full bg-white shadow-2xl flex flex-col z-10">
                {/* header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-700">
                      Dashboard Sections
                    </span>
                  </div>
                  <button
                    onClick={() => setSettingsOpen(false)}
                    className="p-1 rounded hover:bg-gray-200 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                {/* card list */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">
                    Toggle sections to show/hide
                  </p>

                  {/* AP (KPI) group — only show if manager is AP or no manager */}
                  {(AP_CARDS.some(k => visibility[k] !== undefined) &&
                    (!userDetails.manager || userDetails.manager.split("-")[0]?.toUpperCase() !== "BR")) && (
                    <>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 pt-2 pb-1">
                        KPI Pattern
                      </p>
                      {AP_CARDS.map((key) => (
                        <div key={key} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                          <Label htmlFor={`vis-${key}`} className="text-xs text-gray-700 cursor-pointer flex-1 pr-3">
                            {CARD_LABELS[key]}
                          </Label>
                          <Switch id={`vis-${key}`} checked={visibility[key]} onCheckedChange={() => toggleCard(key)} />
                        </div>
                      ))}
                    </>
                  )}

                  {/* BR (Activity) group — only show if manager is BR or no manager */}
                  {(!userDetails.manager || userDetails.manager.split("-")[0]?.toUpperCase() !== "AP") && (
                    <>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 pt-4 pb-1">
                        Activity Pattern
                      </p>
                      {BR_CARDS.map((key) => (
                        <div key={key} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                          <Label htmlFor={`vis-${key}`} className="text-xs text-gray-700 cursor-pointer flex-1 pr-3">
                            {CARD_LABELS[key]}
                          </Label>
                          <Switch id={`vis-${key}`} checked={visibility[key]} onCheckedChange={() => toggleCard(key)} />
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* footer */}
                <div className="px-5 py-3 border-t border-gray-100">
                  <button
                    onClick={() => {
                      const def = defaultForManager(userDetails.manager);
                      saveVisibility(def);
                      setVisibility(def);
                    }}
                    className="w-full text-xs text-gray-500 hover:text-gray-700 py-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Reset to defaults
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Summary cards ── */}
          {visibility.summaryCards && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <RunningTargetCard
                referenceid={userDetails.referenceid}
                total={salesQuotaTotal}
                loading={loadingSalesQuota}
              />
              <RunningSiCard
                referenceid={userDetails.referenceid}
                targetTotal={salesQuotaTotal}
                total={totalActualSales}
                loading={loadingHistory}
              />
              <RunningSoCard
                referenceid={userDetails.referenceid}
                targetTotal={salesQuotaTotal}
                total={totalSoAmount}
                loading={loadingHistory}
              />
              <OutboundTouchbaseCountCard
                referenceid={userDetails.referenceid}
                count={outboundCallsCount}
                target={outboundCallsTarget}
                loading={loadingOutboundCalls}
                loadingTarget={loadingOutboundCallsTarget}
              />
            </div>
          )}


          {visibility.salesPipeline && (
            <SalesPipelineCard
              obCallsCount={outboundCallsCount}
              obCallsTarget={outboundCallsTarget}
              loadingObCalls={loadingOutboundCalls}
              loadingObCallsTarget={loadingOutboundCallsTarget}
              quotesCount={quotesCount}
              quotesTarget={quoteTarget}
              loadingQuotes={loadingQuotes}
              callsToQuotesCount={callsToQuotesCount}
              loadingCallsToQuotes={loadingCallsToQuotes}
              quoteToSOQuotationCount={quoteToSOQuotationCount}
              quoteToSOSalesOrderCount={quoteToSOSalesOrderCount}
              loadingQuoteToSO={loadingQuoteToSO}
              soToSISalesOrderCount={soToSISalesOrderCount}
              soToSIDeliveredCount={soToSIDeliveredCount}
              newAccountCount={newAccountCount}
              newAccountTarget={newAccountTarget}
              loadingNewAccount={loadingNewAccount}
            />
          )}


          {visibility.siSoAchievement && (
            <SiSoAchievementCard
              referenceid={userDetails.referenceid}
              siTarget={70}
              soTarget={30}
            />
          )}

     
          {visibility.monthlySiTrend && (
            <MonthlySiTrendCard referenceid={userDetails.referenceid} />
          )}

  
          {visibility.tsaPerformance && (
            <TsaPerformanceDetail referenceid={userDetails.referenceid} />
          )}

  
          {visibility.kpiScores && (
            <KpiWeightedScores
              name={`${userDetails.firstname} ${userDetails.lastname}`.trim() || userDetails.referenceid}
              loading={loadingOutboundCalls || loadingQuotes || loadingCallsToQuotes || loadingQuoteToSO || loadingSalesQuota || loadingHistory}
              runningTarget={salesQuotaTotal}
              totalActualSales={totalActualSales}
              obCallsCount={outboundCallsCount}
              obCallsTarget={outboundCallsTarget}
              quotesCount={quotesCount}
              quotesTarget={quoteTarget}
              callsToQuotesCount={callsToQuotesCount}
              obCallsForRatio={outboundCallsCount}
              quoteToSOSalesOrderCount={quoteToSOSalesOrderCount}
              quoteToSOQuotationCount={quoteToSOQuotationCount}
              soToSIDeliveredCount={soToSIDeliveredCount}
              soToSISalesOrderCount={soToSISalesOrderCount}
              clientVisits={clientVisitsCount}
              clientVisitsTarget={80}
              avgResponseTime={csrAvgResponseTime}
              avgQuotationHT={csrAvgQuotationHT}
              avgNonQuotationHT={csrAvgNonQuotationHT}
              newAccountCount={newAccountCount}
              newAccountTarget={newAccountTarget}
            />
          )}

          {/* ── Account / Activity Cards ── */}
          {visibility.accountCards && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <AccountCard referenceid={userDetails.referenceid} />
              <OutboundTouchbaseCard {...cardProps} />
              <TimemotionCard
                {...cardProps}
                referenceid={userDetails.referenceid}
                dateRange={dateCreatedFilterRange}
              />
              <ActivityCard {...cardProps} dateRange={dateCreatedFilterRange} />
            </div>
          )}

          {/* ── Charts ── */}
          {visibility.charts && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SourceCard {...cardProps} />
              <CSRMetricsCard
                referenceId={userDetails.referenceid}
                dateRange={dateCreatedFilterRange}
                onMetricsChange={(m) => {
                  setCsrAvgResponseTime(m.avgResponseTime);
                  setCsrAvgQuotationHT(m.avgQuotationHT);
                  setCsrAvgNonQuotationHT(m.avgNonQuotationHT);
                }}
              />
            </div>
          )}

          {/* ── Lists & Map ── */}
          <div className="grid grid-cols-1 gap-4">
            {visibility.outboundList && (
              <OutboundCallsCard
                history={filteredActivities}
                loading={loadingActivities}
                error={errorActivities}
                dateCreatedFilterRange={toStrictRange(dateCreatedFilterRange)}
              />
            )}
            {visibility.quotationList && (
              <QuotationCard {...cardProps} dateRange={dateCreatedFilterRange} />
            )}
            {visibility.soList && (
              <SOCard {...cardProps} dateRange={dateCreatedFilterRange} />
            )}
            {visibility.siteVisit && (
              <SiteVisitCard
                referenceid={userDetails.referenceid}
                dateRange={dateCreatedFilterRange}
              />
            )}
          </div>

        </div>
      </SidebarInset>

      <SidebarRight
        dateCreatedFilterRange={dateCreatedFilterRange}
        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
      />
    </ProtectedPageWrapper>
  );
}

/* ================= PAGE ================= */

export default function Page() {
  return (
    <UserProvider>
      <NotificationProvider>
        <FormatProvider>
          <SidebarProvider>
            <Suspense fallback={<div>Loading...</div>}>
              <DashboardContent />
            </Suspense>
          </SidebarProvider>
        </FormatProvider>
      </NotificationProvider>
    </UserProvider>
  );
}

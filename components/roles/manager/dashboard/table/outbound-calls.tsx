"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Info, Download, Settings2, X, Eye, EyeOff, Users, Columns3, RotateCcw, Target,
} from "lucide-react";
import ExcelJS from "exceljs";

/* ================= TYPES ================= */

interface HistoryItem {
  referenceid: string;
  source: string;
  call_status: string;
  status: string;
  type_activity: string;
  actual_sales?: number | string;
  quotation_amount?: number | string;
  so_amount?: number | string;
  start_date: string;
  end_date: string;
  date_created: string;
  activity_reference_number: string;
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture: string;
}

interface OutboundCardProps {
  history: HistoryItem[];
  agents: Agent[];
  dateCreatedFilterRange?: { from: Date; to: Date };
  setDateCreatedFilterRangeAction?: React.Dispatch<React.SetStateAction<any>>;
}

/* ================= COLUMN CONFIG ================= */

interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: "obTarget",      label: "OB Target",                    visible: true },
  { key: "totalCalls",    label: "Successful Calls",             visible: true },
  { key: "achievement",   label: "Achievement",                  visible: true },
  { key: "numQuotes",     label: "Quote Based on OB Successful", visible: true },
  { key: "callsToQuote",  label: "Calls → Quote %",              visible: true },
  { key: "quoteAmount",   label: "Quote Amount",                 visible: true },
  { key: "numSO",         label: "SO Based on OB Successful",    visible: true },
  { key: "soAmount",      label: "SO Amount",                    visible: true },
  { key: "quoteToSO",     label: "Quote → SO %",                 visible: true },
  { key: "numSI",         label: "SI Based on OB Successful",    visible: true },
  { key: "actualSales",   label: "SI Amount",                    visible: true },
  { key: "soToSI",        label: "SO → SI %",                    visible: true },
];

const STORAGE_KEY = "outbound_computation_config";

/* ================= HELPERS ================= */

const pct = (num: number, den: number) =>
  den > 0 ? ((num / den) * 100).toFixed(2) + "%" : "0.00%";

const convBadge = (count: number) => (
  <span className="ml-1 text-green-600 text-[12px] font-medium">{count}</span>
);

const loadConfig = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      columns: ColumnConfig[];
      obTargetPerDay: number;
      hiddenAgents: string[];
      agentColumnOverrides: Record<string, string[]>;
    };
  } catch {
    return null;
  }
};

const saveConfig = (cfg: {
  columns: ColumnConfig[];
  obTargetPerDay: number;
  hiddenAgents: string[];
  agentColumnOverrides: Record<string, string[]>;
}) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch {}
};

/* ================= SECTION HEADER ================= */

const SectionHeader = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
    {icon}
    <span>{title}</span>
  </div>
);

/* ================= VALIDATION ================= */

const isFinitePositive = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

/* ================= COMPONENT ================= */

export function OutboundCallsTableCard({
  history,
  agents,
  dateCreatedFilterRange,
}: OutboundCardProps) {
  const [showComputation, setShowComputation] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  /* ---- Init config ---- */
  const initConfig = useCallback(() => {
    const saved = loadConfig();
    return {
      columns:              saved?.columns              ?? DEFAULT_COLUMNS.map((c) => ({ ...c })),
      obTargetPerDay:       saved?.obTargetPerDay       ?? null,
      hiddenAgents:         saved?.hiddenAgents         ?? ([] as string[]),
      agentColumnOverrides: saved?.agentColumnOverrides ?? ({} as Record<string, string[]>),
    };
  }, []);

  /* ---- Committed state (drives table) ---- */
  const [columns,              setColumns]              = useState<ColumnConfig[]>(() => initConfig().columns);
  const [obTargetPerDay,       setObTargetPerDay]       = useState<number>(()        => initConfig().obTargetPerDay ?? 20);
  const [hiddenAgents,         setHiddenAgents]         = useState<string[]>(()      => initConfig().hiddenAgents);
  // agentColumnOverrides: { [agentId]: string[] } — columns in the array render as "—" for that agent
  const [agentColumnOverrides, setAgentColumnOverrides] = useState<Record<string, string[]>>(() => initConfig().agentColumnOverrides);
  const [quotaLoading,         setQuotaLoading]         = useState<boolean>(() => initConfig().obTargetPerDay === null);

  /* ---- Fetch quota from API on mount (only if not already saved in localStorage) ---- */
  useEffect(() => {
    if (initConfig().obTargetPerDay !== null) return; // user has a saved override, respect it
    fetch("/api/outbound-quota")
      .then((res) => res.json())
      .then((data) => {
        if (isFinitePositive(data?.outbound_quota)) {
          setObTargetPerDay(data.outbound_quota);
          setDraftObTarget(data.outbound_quota);
        } else {
          console.warn("outbound-quota: received invalid value, falling back to 20", data);
        }
      })
      .catch((err) => {
        console.warn("outbound-quota: fetch failed, falling back to 20", err);
      })
      .finally(() => {
        setQuotaLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Draft state (panel, committed on Save) ---- */
  const [draftColumns,              setDraftColumns]              = useState<ColumnConfig[]>([]);
  const [draftObTarget,             setDraftObTarget]             = useState<number>(20);
  const [draftHiddenAgents,         setDraftHiddenAgents]         = useState<string[]>([]);
  const [draftAgentColumnOverrides, setDraftAgentColumnOverrides] = useState<Record<string, string[]>>({});
  // track which agent's override panel is expanded
  const [expandedOverrideAgent, setExpandedOverrideAgent] = useState<string | null>(null);

  const openPanel = () => {
    setDraftColumns(columns.map((c) => ({ ...c })));
    setDraftObTarget(obTargetPerDay);
    setDraftHiddenAgents([...hiddenAgents]);
    setDraftAgentColumnOverrides(
      Object.fromEntries(Object.entries(agentColumnOverrides).map(([k, v]) => [k, [...v]]))
    );
    setExpandedOverrideAgent(null);
    setShowSettings(true);
  };

  const savePanel = () => {
    setColumns(draftColumns);
    setObTargetPerDay(draftObTarget);
    setHiddenAgents(draftHiddenAgents);
    setAgentColumnOverrides(draftAgentColumnOverrides);
    saveConfig({
      columns: draftColumns,
      obTargetPerDay: draftObTarget,
      hiddenAgents: draftHiddenAgents,
      agentColumnOverrides: draftAgentColumnOverrides,
    });
    setQuotaLoading(false);
    setShowSettings(false);
  };

  const resetPanel = () => {
    setDraftColumns(DEFAULT_COLUMNS.map((c) => ({ ...c })));
    setDraftObTarget(obTargetPerDay);
    setDraftHiddenAgents([]);
    setDraftAgentColumnOverrides({});
  };

  // helper: toggle a column override for an agent in draft state
  const toggleDraftOverride = (agentId: string, colKey: string, zeroed: boolean) => {
    setDraftAgentColumnOverrides((prev) => {
      const current = prev[agentId] ?? [];
      const next = zeroed
        ? current.includes(colKey) ? current : [...current, colKey]
        : current.filter((k) => k !== colKey);
      return { ...prev, [agentId]: next };
    });
  };

  /* ---- Agent map ---- */
  const agentMap = useMemo(() => {
    const map = new Map<string, { name: string; picture: string }>();
    agents.forEach((a) =>
      map.set(a.ReferenceID.toLowerCase(), {
        name: `${a.Firstname} ${a.Lastname}`,
        picture: a.profilePicture,
      })
    );
    return map;
  }, [agents]);

  /* ---- Successful OB calls (date filtered) ---- */
  const successfulOBCalls = useMemo(() => {
    let base = history.filter(
      (h) => h.source === "Outbound - Touchbase" && h.call_status === "Successful"
    );
    if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
      const start = new Date(dateCreatedFilterRange.from); start.setHours(0, 0, 0, 0);
      const end   = new Date(dateCreatedFilterRange.to);   end.setHours(23, 59, 59, 999);
      base = base.filter((h) => { const d = new Date(h.date_created); return d >= start && d <= end; });
    }
    return base;
  }, [history, dateCreatedFilterRange]);

  /* ---- History lookup by ref num ---- */
  const historyByRefNum = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    history.forEach((h) => {
      if (!h.activity_reference_number) return;
      if (!map.has(h.activity_reference_number)) map.set(h.activity_reference_number, []);
      map.get(h.activity_reference_number)!.push(h);
    });
    return map;
  }, [history]);

  /* ---- Days count & OB target ---- */
  const daysCount = useMemo(() => {
    if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
      const start = new Date(dateCreatedFilterRange.from);
      const end = new Date(dateCreatedFilterRange.to);
      let count = 0;
      const current = new Date(start);
      while (current <= end) {
        if (current.getDay() !== 0) count++; // exclude Sundays
        current.setDate(current.getDate() + 1);
      }
      return count || 1;
    }
    return 22; // default working days per month (excluding Sundays)
  }, [dateCreatedFilterRange]);

  const obTarget = obTargetPerDay * daysCount;

  /* ---- Per-agent stats ---- */
  const statsByAgent = useMemo(() => {
    const byAgent: Record<string, HistoryItem[]> = {};
    successfulOBCalls.forEach((h) => {
      const id = h.referenceid?.toLowerCase();
      if (!id) return;
      if (!byAgent[id]) byAgent[id] = [];
      byAgent[id].push(h);
    });

    return Object.entries(byAgent).map(([agentId, obCalls]) => {
      const totalCalls = obCalls.length;
      const obRefNums  = new Set(obCalls.map((c) => c.activity_reference_number).filter(Boolean));

      const quoteRefNums = new Set<string>();
      const soRefNums    = new Set<string>();
      const siRefNums    = new Set<string>();

      obRefNums.forEach((refNum) => {
        const acts = historyByRefNum.get(refNum) ?? [];
        acts.forEach((act) => {
          if (act.status === "Quote-Done")                               quoteRefNums.add(refNum);
          if (act.status === "SO-Done")                                  soRefNums.add(refNum);
          if (act.type_activity === "Delivered / Closed Transaction")    siRefNums.add(refNum);
        });
      });

      const numQuotes = quoteRefNums.size;
      const numSO     = soRefNums.size;
      const numSI     = siRefNums.size;

      let quoteAmount = 0, soAmount = 0, actualSales = 0;

      obRefNums.forEach((refNum) => {
        const acts = historyByRefNum.get(refNum) ?? [];
        acts.forEach((act) => {
          if (act.status === "Quote-Done" && act.quotation_amount) {
            const v = typeof act.quotation_amount === "string" ? parseFloat(act.quotation_amount) : act.quotation_amount;
            if (!isNaN(v)) quoteAmount += v;
          }
          if (act.status === "SO-Done" && act.so_amount) {
            const v = typeof act.so_amount === "string" ? parseFloat(act.so_amount) : act.so_amount;
            if (!isNaN(v)) soAmount += v;
          }
          if (act.type_activity === "Delivered / Closed Transaction" && act.actual_sales) {
            const v = typeof act.actual_sales === "string" ? parseFloat(act.actual_sales as string) : act.actual_sales as number;
            if (!isNaN(v)) actualSales += v;
          }
        });
      });

      const achievement = obTarget > 0 ? (totalCalls / obTarget) * 100 : 0;

      return {
        agentId, totalCalls, numQuotes, numSO, numSI,
        quoteAmount, soAmount, actualSales, achievement,
        callsToQuote: pct(numQuotes, totalCalls),
        quoteToSO:    pct(numSO, numQuotes),
        soToSI:       pct(numSI, numSO),
      };
    });
  }, [successfulOBCalls, historyByRefNum, obTarget]);

  /* ---- Visible agents ---- */
  const visibleStats = useMemo(
    () => statsByAgent.filter((s) => agentMap.has(s.agentId) && !hiddenAgents.includes(s.agentId)),
    [statsByAgent, agentMap, hiddenAgents]
  );

  /* ---- All known agents (for panel list) ---- */
  const allKnownAgents = useMemo(
    () => statsByAgent.filter((s) => agentMap.has(s.agentId)),
    [statsByAgent, agentMap]
  );

  /* ---- Totals ---- */
  const totals = useMemo(() => {
    const totalCalls  = visibleStats.reduce((s, a) => s + a.totalCalls, 0);
    const numQuotes   = visibleStats.reduce((s, a) => s + a.numQuotes, 0);
    const numSO       = visibleStats.reduce((s, a) => s + a.numSO, 0);
    const numSI       = visibleStats.reduce((s, a) => s + a.numSI, 0);
    const totalQuoteAmount = visibleStats.reduce((s, a) => s + a.quoteAmount, 0);
    const totalSoAmount    = visibleStats.reduce((s, a) => s + a.soAmount, 0);
    const totalActualSales = visibleStats.reduce((s, a) => s + a.actualSales, 0);
    return {
      totalCalls, numQuotes, numSO, numSI,
      totalQuoteAmount, totalSoAmount, totalActualSales,
      achievement:  pct(totalCalls, obTarget * visibleStats.length || 1),
      callsToQuote: pct(numQuotes, totalCalls),
      quoteToSO:    pct(numSO, numQuotes),
      soToSI:       pct(numSI, numSO),
    };
  }, [visibleStats, obTarget]);

  /* ---- Column helper (committed state) ---- */
  const col = (key: string) => columns.find((c) => c.key === key)?.visible ?? true;

  /* ---- Cell override helper: returns true if this agent+column should show "—" ---- */
  const isZeroed = (agentId: string, colKey: string) =>
    (agentColumnOverrides[agentId] ?? []).includes(colKey);

  /* ---- Excel Export ---- */
  const exportToExcel = async () => {
    if (visibleStats.length === 0) return;
    try {
      const workbook  = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Outbound Performance");

      const headerDefs = [
        { key: "agent",       header: "Agent",                 width: 25, always: true },
        { key: "target",      header: "OB Target",             width: 12, colKey: "obTarget" },
        { key: "calls",       header: "Successful Calls",      width: 15, colKey: "totalCalls" },
        { key: "achievement", header: "Achievement (%)",       width: 15, colKey: "achievement" },
        { key: "quotes",      header: "Quotes (Based on OB)",  width: 20, colKey: "numQuotes" },
        { key: "c2q",         header: "Calls → Quote (%)",     width: 15, colKey: "callsToQuote" },
        { key: "quoteAmt",    header: "Quote Amount",          width: 18, colKey: "quoteAmount" },
        { key: "so",          header: "SO (Based on OB)",      width: 20, colKey: "numSO" },
        { key: "soAmt",       header: "SO Amount",             width: 18, colKey: "soAmount" },
        { key: "q2so",        header: "Quote → SO (%)",        width: 15, colKey: "quoteToSO" },
        { key: "si",          header: "SI (Based on OB)",      width: 20, colKey: "numSI" },
        { key: "actualSales", header: "Actual Sales",          width: 18, colKey: "actualSales" },
        { key: "so2si",       header: "SO → SI (%)",           width: 15, colKey: "soToSI" },
      ];

      worksheet.columns = headerDefs
        .filter((h) => h.always || col(h.colKey!))
        .map((h) => ({ header: h.header, key: h.key, width: h.width }));

      const headerRow = worksheet.getRow(1);
      headerRow.font      = { bold: true };
      headerRow.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };

      visibleStats.forEach((stat) => {
        const agentName = agentMap.get(stat.agentId)!.name;
        const row: Record<string, any> = { agent: agentName };
        if (col("obTarget"))     row.target       = obTarget;
        if (col("totalCalls"))   row.calls        = stat.totalCalls;
        if (col("achievement"))  row.achievement  = stat.achievement / 100;
        if (col("numQuotes"))    row.quotes       = stat.numQuotes;
        if (col("callsToQuote")) row.c2q          = parseFloat(stat.callsToQuote) / 100;
        if (col("quoteAmount"))  row.quoteAmt     = stat.quoteAmount;
        if (col("numSO"))        row.so           = stat.numSO;
        if (col("soAmount"))     row.soAmt        = stat.soAmount;
        if (col("quoteToSO"))    row.q2so         = parseFloat(stat.quoteToSO) / 100;
        if (col("numSI"))        row.si           = stat.numSI;
        if (col("actualSales"))  row.actualSales  = stat.actualSales;
        if (col("soToSI"))       row.so2si        = parseFloat(stat.soToSI) / 100;
        worksheet.addRow(row);
      });

      const totalRow = worksheet.addRow({
        agent: "TOTAL",
        ...(col("obTarget")     && { target:      obTarget * visibleStats.length }),
        ...(col("totalCalls")   && { calls:       totals.totalCalls }),
        ...(col("achievement")  && { achievement: parseFloat(totals.achievement) / 100 }),
        ...(col("numQuotes")    && { quotes:      totals.numQuotes }),
        ...(col("callsToQuote") && { c2q:         parseFloat(totals.callsToQuote) / 100 }),
        ...(col("quoteAmount")  && { quoteAmt:    totals.totalQuoteAmount }),
        ...(col("numSO")        && { so:          totals.numSO }),
        ...(col("soAmount")     && { soAmt:       totals.totalSoAmount }),
        ...(col("quoteToSO")    && { q2so:        parseFloat(totals.quoteToSO) / 100 }),
        ...(col("numSI")        && { si:          totals.numSI }),
        ...(col("actualSales")  && { actualSales: totals.totalActualSales }),
        ...(col("soToSI")       && { so2si:       parseFloat(totals.soToSI) / 100 }),
      });
      totalRow.font = { bold: true };

      let filename = "Manager_Outbound_Performance";
      if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
        const fromStr = new Date(dateCreatedFilterRange.from).toISOString().split("T")[0];
        const toStr   = new Date(dateCreatedFilterRange.to).toISOString().split("T")[0];
        filename += `_${fromStr}_to_${toStr}`;
      }
      filename += ".xlsx";

      const buffer = await workbook.xlsx.writeBuffer();
      const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url    = window.URL.createObjectURL(blob);
      const link   = document.createElement("a");
      link.href    = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {}
  };

  /* ================= RENDER ================= */
  return (
    <Card className="rounded-xl border shadow-sm">
      {/* Header */}
      <CardHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Outbound Calls (Touchbase)</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Based on <span className="font-medium text-gray-500">Outbound – Touchbase · Successful</span> calls only
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm" onClick={exportToExcel}
              disabled={visibleStats.length === 0}
              className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800 border-green-200 bg-green-50/50 hover:bg-green-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setShowComputation(!showComputation)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
            >
              <Info className="w-3.5 h-3.5" />
              {showComputation ? "Hide" : "Details"}
            </Button>
            <Button
              variant={showSettings ? "default" : "outline"}
              size="sm"
              onClick={openPanel}
              className={`flex items-center gap-1.5 text-xs ${
                showSettings
                  ? "bg-gray-800 text-white hover:bg-gray-700"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Customize
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 relative">
        {/* ── Settings Panel ── */}
        {showSettings && (
          <div className="absolute top-0 right-0 z-20 w-72 h-full min-h-96 bg-white border-l border-gray-200 shadow-xl rounded-r-xl flex flex-col overflow-hidden">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-700">Edit Computation</span>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-1 rounded hover:bg-gray-200 transition-colors">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

              {/* OB Target */}
              <div className="space-y-2">
                <SectionHeader icon={<Target className="w-3.5 h-3.5" />} title="OB Target (per day)" />
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    value={draftObTarget}
                    onChange={(e) => setDraftObTarget(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 h-8 text-xs"
                  />
                  <span className="text-xs text-gray-400">
                    × {daysCount}d = <strong className="text-gray-700">{draftObTarget * daysCount}</strong>
                  </span>
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Column Visibility */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <SectionHeader icon={<Columns3 className="w-3.5 h-3.5" />} title="Column Visibility" />
                  <button
                    className="text-[10px] text-slate-500 hover:underline"
                    onClick={() => setDraftColumns((prev) => prev.map((c) => ({ ...c, visible: true })))}
                  >
                    Show All
                  </button>
                </div>
                <div className="space-y-1.5">
                  {draftColumns.map((c) => (
                    <div key={c.key} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50">
                      <Label htmlFor={`col-${c.key}`} className="text-xs text-gray-600 cursor-pointer select-none">{c.label}</Label>
                      <Switch
                        id={`col-${c.key}`}
                        checked={c.visible}
                        onCheckedChange={(checked) =>
                          setDraftColumns((prev) => prev.map((x) => x.key === c.key ? { ...x, visible: checked } : x))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Agent Visibility */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <SectionHeader icon={<Users className="w-3.5 h-3.5" />} title="Agent Visibility" />
                  <div className="flex gap-2">
                    <button className="text-[10px] text-slate-500 hover:underline" onClick={() => setDraftHiddenAgents([])}>
                      Show All
                    </button>
                    <span className="text-[10px] text-gray-300">|</span>
                    <button className="text-[10px] text-red-400 hover:underline" onClick={() => setDraftHiddenAgents(allKnownAgents.map((a) => a.agentId))}>
                      Hide All
                    </button>
                  </div>
                </div>
                {allKnownAgents.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No agents with data yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {allKnownAgents.map((stat) => {
                      const info     = agentMap.get(stat.agentId)!;
                      const isHidden = draftHiddenAgents.includes(stat.agentId);
                      return (
                        <div key={stat.agentId} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50">
                          <div className="flex items-center gap-2">
                            {info.picture ? (
                              <img src={info.picture} alt={info.name} className="w-6 h-6 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 flex-shrink-0">
                                {info.name[0]}
                              </div>
                            )}
                            <Label htmlFor={`agent-${stat.agentId}`} className="text-xs text-gray-600 capitalize cursor-pointer select-none">
                              {info.name}
                            </Label>
                          </div>
                          <Switch
                            id={`agent-${stat.agentId}`}
                            checked={!isHidden}
                            onCheckedChange={(checked) =>
                              setDraftHiddenAgents((prev) =>
                                checked ? prev.filter((id) => id !== stat.agentId) : [...prev, stat.agentId]
                              )
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <hr className="border-gray-100" />

              {/* Per-Agent Column Overrides */}
              <div className="space-y-2">
                <SectionHeader icon={<EyeOff className="w-3.5 h-3.5" />} title="Zero Out Columns per Agent" />
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Select columns to show as <span className="font-mono font-semibold">—</span> for a specific agent row.
                </p>
                {allKnownAgents.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No agents with data yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {allKnownAgents.map((stat) => {
                      const info = agentMap.get(stat.agentId)!;
                      const overrides = draftAgentColumnOverrides[stat.agentId] ?? [];
                      const isExpanded = expandedOverrideAgent === stat.agentId;
                      const visibleCols = draftColumns.filter((c) => c.visible);
                      return (
                        <div key={stat.agentId} className="rounded-lg border border-gray-100 overflow-hidden">
                          {/* Agent row — click to expand */}
                          <button
                            type="button"
                            onClick={() => setExpandedOverrideAgent(isExpanded ? null : stat.agentId)}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {info.picture ? (
                                <img src={info.picture} alt={info.name} className="w-5 h-5 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[9px] text-gray-400 flex-shrink-0">
                                  {info.name[0]}
                                </div>
                              )}
                              <span className="text-xs text-gray-600 capitalize">{info.name}</span>
                              {overrides.length > 0 && (
                                <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                  {overrides.length} zeroed
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400">{isExpanded ? "▲" : "▼"}</span>
                          </button>
                          {/* Expanded column list */}
                          {isExpanded && (
                            <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2 space-y-1.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-gray-400">Toggle to zero out a column for this agent</span>
                                {overrides.length > 0 && (
                                  <button
                                    type="button"
                                    className="text-[10px] text-red-400 hover:underline"
                                    onClick={() => setDraftAgentColumnOverrides((prev) => ({ ...prev, [stat.agentId]: [] }))}
                                  >
                                    Clear all
                                  </button>
                                )}
                              </div>
                              {visibleCols.map((c) => {
                                const zeroed = overrides.includes(c.key);
                                return (
                                  <div key={c.key} className="flex items-center justify-between rounded border border-gray-100 bg-white px-2.5 py-1.5">
                                    <span className="text-[11px] text-gray-600">{c.label}</span>
                                    <Switch
                                      checked={zeroed}
                                      onCheckedChange={(checked) => toggleDraftOverride(stat.agentId, c.key, checked)}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Panel Footer */}
            <div className="border-t bg-gray-50 px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
              <button
                onClick={resetPanel}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setShowSettings(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="text-xs h-7 bg-slate-600 hover:bg-slate-700 text-white" onClick={savePanel}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        {visibleStats.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-gray-400">
            No outbound records found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 text-[11px]">
                  <TableHead className="text-gray-500">Agent</TableHead>
                  {col("obTarget")     && <TableHead className="text-gray-500 text-center">OB Target</TableHead>}
                  {col("totalCalls")   && <TableHead className="text-gray-500 text-center">Successful Calls</TableHead>}
                  {col("achievement")  && <TableHead className="text-gray-500 text-center">Achievement</TableHead>}
                  {col("numQuotes")    && <TableHead className="text-gray-500 text-center whitespace-normal break-words max-w-[120px]">Quote Based on OB Successful</TableHead>}
                  {col("callsToQuote") && <TableHead className="text-gray-500 text-center">Calls → Quote<span className="block text-[9px] font-normal text-gray-400">(Quotes ÷ Calls)</span></TableHead>}
                  {col("quoteAmount")  && <TableHead className="text-gray-500 text-center">Quote Amount</TableHead>}
                  {col("numSO")        && <TableHead className="text-gray-500 text-center whitespace-normal break-words max-w-[120px]">SO Based on OB Successful</TableHead>}
                  {col("soAmount")     && <TableHead className="text-gray-500 text-center">SO Amount</TableHead>}
                  {col("quoteToSO")    && <TableHead className="text-gray-500 text-center">Quote → SO<span className="block text-[9px] font-normal text-gray-400">(SO ÷ Quotes)</span></TableHead>}
                  {col("numSI")        && <TableHead className="text-gray-500 text-center whitespace-normal break-words max-w-[120px]">SI Based on OB Successful</TableHead>}
                  {col("actualSales")  && <TableHead className="text-gray-500 text-center">SI Amount</TableHead>}
                  {col("soToSI")       && <TableHead className="text-gray-500 text-center">SO → SI<span className="block text-[9px] font-normal text-gray-400">(SI ÷ SO)</span></TableHead>}
                </TableRow>
              </TableHeader>

              <TableBody>
                {visibleStats.map((stat) => {
                  const info = agentMap.get(stat.agentId)!;
                  const z = (colKey: string) => isZeroed(stat.agentId, colKey);
                  return (
                    <TableRow key={stat.agentId} className="text-xs hover:bg-gray-50/50 font-mono">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {info?.picture ? (
                            <img src={info.picture} alt={info.name} className="w-7 h-7 rounded-full object-cover border border-white shadow-sm flex-shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                              {info.name[0]}
                            </div>
                          )}
                          <span className="capitalize text-gray-700">{info.name}</span>
                        </div>
                      </TableCell>
                      {col("obTarget")     && <TableCell className="text-center text-gray-600">{z("obTarget")     ? "—" : quotaLoading ? "…" : obTarget}</TableCell>}
                      {col("totalCalls")   && <TableCell className="text-center font-semibold text-gray-800">{z("totalCalls")   ? "—" : stat.totalCalls}</TableCell>}
                      {col("achievement")  && (
                        <TableCell className="text-center">
                          {z("achievement") ? "—" : (
                            <span className={`font-semibold ${stat.achievement >= 100 ? "text-green-600" : stat.achievement >= 70 ? "text-amber-500" : "text-red-500"}`}>
                              {stat.achievement.toFixed(2)}%
                            </span>
                          )}
                        </TableCell>
                      )}
                      {col("numQuotes")    && <TableCell className="text-center font-bold">{z("numQuotes")    ? "—" : convBadge(stat.numQuotes)}</TableCell>}
                      {col("callsToQuote") && <TableCell className="text-center"><span className="text-gray-700">{z("callsToQuote") ? "—" : stat.callsToQuote}</span></TableCell>}
                      {col("quoteAmount")  && <TableCell className="text-gray-700 text-center">{z("quoteAmount")  ? "—" : stat.quoteAmount.toLocaleString()}</TableCell>}
                      {col("numSO")        && <TableCell className="text-center font-bold">{z("numSO")        ? "—" : convBadge(stat.numSO)}</TableCell>}
                      {col("soAmount")     && <TableCell className="text-center font-semibold text-blue-600">{z("soAmount")     ? "—" : `₱${stat.soAmount.toLocaleString()}`}</TableCell>}
                      {col("quoteToSO")    && <TableCell className="text-center"><span className="text-gray-700">{z("quoteToSO")    ? "—" : stat.quoteToSO}</span></TableCell>}
                      {col("numSI")        && <TableCell className="text-center font-bold">{z("numSI")        ? "—" : convBadge(stat.numSI)}</TableCell>}
                      {col("actualSales")  && <TableCell className="text-center font-semibold text-emerald-600">{z("actualSales")  ? "—" : `₱${stat.actualSales.toLocaleString()}`}</TableCell>}
                      {col("soToSI")       && <TableCell className="text-center"><span className="text-gray-700">{z("soToSI")       ? "—" : stat.soToSI}</span></TableCell>}
                    </TableRow>
                  );
                })}
              </TableBody>

              <TableFooter>
                <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                  <TableCell className="text-gray-700">Total</TableCell>
                  {col("obTarget")     && <TableCell className="text-center text-gray-600">{quotaLoading ? "…" : obTarget * visibleStats.length}</TableCell>}
                  {col("totalCalls")   && <TableCell className="text-center text-gray-800">{totals.totalCalls}</TableCell>}
                  {col("achievement")  && <TableCell className="text-center text-gray-700">{totals.achievement}</TableCell>}
                  {col("numQuotes")    && <TableCell className="text-center">{convBadge(totals.numQuotes)}</TableCell>}
                  {col("callsToQuote") && <TableCell className="text-center">{totals.callsToQuote}</TableCell>}
                  {col("quoteAmount")  && <TableCell className="text-center font-semibold">{totals.totalQuoteAmount.toLocaleString()}</TableCell>}
                  {col("numSO")        && <TableCell className="text-center">{convBadge(totals.numSO)}</TableCell>}
                  {col("soAmount")     && <TableCell className="text-center font-semibold text-blue-600">₱{totals.totalSoAmount.toLocaleString()}</TableCell>}
                  {col("quoteToSO")    && <TableCell className="text-center">{totals.quoteToSO}</TableCell>}
                  {col("numSI")        && <TableCell className="text-center">{convBadge(totals.numSI)}</TableCell>}
                  {col("actualSales")  && <TableCell className="text-center font-semibold text-emerald-600">₱{totals.totalActualSales.toLocaleString()}</TableCell>}
                  {col("soToSI")       && <TableCell className="text-center">{totals.soToSI}</TableCell>}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}

        {/* Computation details */}
        {showComputation && (
          <div className="mt-3 p-4 rounded-xl border border-blue-100 bg-blue-50 text-xs text-blue-900 space-y-1.5">
            <p className="font-semibold text-blue-800 mb-1">Computation Details</p>
            <p><strong>Base data:</strong> All records where <code>source = "Outbound - Touchbase"</code> AND <code>call_status = "Successful"</code> (date filter applied here).</p>
            <p><strong>OB Target:</strong> {obTargetPerDay} × number of days in selected range (current: {daysCount} days = {obTarget}).</p>
            <p><strong>Achievement:</strong> (Successful Calls ÷ OB Target) × 100%</p>
            <p><strong>Calls → Quote %:</strong> Count of unique <code>activity_reference_number</code>s that have ANY activity with <code>status = "Quote - Done"</code> in full history ÷ Successful Calls</p>
            <p><strong>Quote → SO %:</strong> Count of unique refs with <code>status = "SO-Done"</code> ÷ Count of Quoted refs</p>
            <p><strong>SO → SI %:</strong> Count of unique refs with <code>type_activity = "Delivered / Closed Transaction"</code> ÷ Count of SO refs</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

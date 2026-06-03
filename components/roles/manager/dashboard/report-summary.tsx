"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Plus, Trash2, Loader2, RefreshCcw } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "report_summary_sheet_v11";
const MULTIPLIER_KEY = "report_summary_ob_multiplier";
const MIN_COL_WIDTH = 48;
const DEFAULT_COL_WIDTH = 110;
const NAME_COL_WIDTH = 140;
const OB_COL_WIDTH = 100;
const OB_TARGET_COL_WIDTH = 110;
const ACTUAL_OB_COL_WIDTH = 100;
const ACHIEVEMENT_COL_WIDTH = 110;
const QUOTE_OB_COL_WIDTH = 130;
const CALLS_TO_QUOTE_COL_WIDTH = 140;
const SO_OB_COL_WIDTH = 110;
const QUOTE_TO_SO_COL_WIDTH = 140;
const SI_OB_COL_WIDTH = 110;
const SO_TO_SI_COL_WIDTH = 140;
const DB_COVERAGE_COL_WIDTH = 130;
const DB_COL_WIDTH = 100;
const DB_ACTUAL_COL_WIDTH = 100;
const DB_ACHIEVEMENT_COL_WIDTH = 120;
const QUOTE_AMT_TARGET_COL_WIDTH = 150;
const QUOTE_AMT_ACTUAL_COL_WIDTH = 140;
const QUOTE_AMT_ACHIEVEMENT_COL_WIDTH = 120;
const SO_AMT_TARGET_COL_WIDTH = 140;
const SO_AMT_ACTUAL_COL_WIDTH = 130;
const SO_AMT_ACHIEVEMENT_COL_WIDTH = 120;
const SI_AMT_TARGET_COL_WIDTH = 140;
const SI_AMT_ACTUAL_COL_WIDTH = 130;
const SI_AMT_ACHIEVEMENT_COL_WIDTH = 120;
const SV_EXISTING_COL_WIDTH = 130;
const SV_NEW_COL_WIDTH = 120;
const SV_ACTUAL_COL_WIDTH = 120;
const SV_ACHIEVEMENT_COL_WIDTH = 130;
const FALLBACK_QUOTA = 20;
const DEFAULT_MULTIPLIER = 7;

// ─── Types ───────────────────────────────────────────────────────────────────

interface SheetData {
  names: string[];
  actualOb: string[];
  quoteOb: string[];
  soOb: string[];
  siOb: string[];
  dbCoverage: string[];
  dbDatabase: string[];
  dbActual: string[];
  quoteAmtTarget: string[];
  quoteAmtActual: string[];
  soAmtTarget: string[];
  soAmtActual: string[];
  siAmtTarget: string[];
  siAmtActual: string[];
  /** Site Visit Existing — default 20, editable per row */
  svExisting: string[];
  /** Site Visit New — manual entry per row */
  svNew: string[];
  /** Site Visit Actual — manual entry per row */
  svActual: string[];
  extraCols: { label: string; width: number; cells: string[] }[];
}

interface ContextMenu {
  x: number;
  y: number;
  colIdx: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isFinitePositive(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

// Format a raw numeric string with commas for display
function fmtAmt(raw: string): string {
  if (!raw || raw === "0") return raw;
  const num = Number(raw.replace(/,/g, ""));
  if (isNaN(num)) return raw;
  return num % 1 === 0
    ? num.toLocaleString("en-PH")
    : num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Count Mon–Sat working days between two date strings (inclusive)
function countWorkingDays(from?: string, to?: string): number {
  if (!from || !to) return 0;
  const start = new Date(from + "T00:00:00");
  const end   = new Date(to   + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay(); // 0=Sun, 6=Sat
    if (day !== 0) count++;   // exclude Sunday only
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function colLabel(index: number): string {
  let label = "";
  let i = index;
  do {
    label = String.fromCharCode(65 + (i % 26)) + label;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return label;
}

function insertAt<T>(arr: T[], index: number, item: T): T[] {
  return [...arr.slice(0, index), item, ...arr.slice(index)];
}

function evalFormula(
  formula: string,
  rowIdx: number,
  names: string[],
  obQuota: number,
  obMultiplier: number,
  actualOb: string[],
  quoteOb: string[],
  soOb: string[],
  siOb: string[],
  extraCols: SheetData["extraCols"],
  workingDays?: number
): string {
  // Use workingDays if provided, otherwise fall back to obMultiplier
  const effectiveMultiplier = workingDays ?? obMultiplier;
  const getCell = (colIdx: number, rIdx: number): string => {
    if (colIdx === 0) return names[rIdx] ?? "";
    if (colIdx === 1) return names[rIdx]?.trim() ? String(obQuota) : "";
    if (colIdx === 2) return names[rIdx]?.trim() ? String(obQuota * effectiveMultiplier) : "";
    if (colIdx === 3) return actualOb[rIdx] ?? "";
    if (colIdx === 4) {
      const target = obQuota * effectiveMultiplier;
      const actual = Number(actualOb[rIdx] ?? "0");
      if (!names[rIdx]?.trim() || target === 0) return "";
      return ((actual / target) * 100).toFixed(2) + "%";
    }
    if (colIdx === 5) return quoteOb[rIdx] ?? "";
    if (colIdx === 6) {
      const actual = Number(actualOb[rIdx] ?? "0");
      const quote = Number(quoteOb[rIdx] ?? "0");
      if (!names[rIdx]?.trim() || actual === 0) return "";
      return ((quote / actual) * 100).toFixed(2) + "%";
    }
    if (colIdx === 7) return soOb[rIdx] ?? "";
    if (colIdx === 8) {
      const quote = Number(quoteOb[rIdx] ?? "0");
      const so = Number(soOb[rIdx] ?? "0");
      if (!names[rIdx]?.trim() || quote === 0) return "";
      return ((so / quote) * 100).toFixed(2) + "%";
    }
    if (colIdx === 9) return siOb[rIdx] ?? "";
    if (colIdx === 10) {
      const so = Number(soOb[rIdx] ?? "0");
      const si = Number(siOb[rIdx] ?? "0");
      if (!names[rIdx]?.trim() || so === 0) return "";
      return ((si / so) * 100).toFixed(2) + "%";
    }
    const ec = extraCols[colIdx - 11];
    return ec?.cells[rIdx] ?? "";
  };

  try {
    const expr = formula.replace(/([A-Z]+)(\d+)/g, (_, col, row) => {
      const colIdx =
        col.split("").reduce((acc: number, c: string) => acc * 26 + c.charCodeAt(0) - 64, 0) - 1;
      const rIdx = parseInt(row, 10) - 1;
      const totalCols = 11 + extraCols.length;
      if (rIdx < 0 || rIdx >= names.length || colIdx < 0 || colIdx >= totalCols) return "0";
      const raw = getCell(colIdx, rIdx);
      return isNaN(Number(raw)) || raw === "" ? "0" : raw;
    });
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)();
    if (typeof result === "number" && isFinite(result))
      return Number.isInteger(result) ? String(result) : result.toFixed(2);
    return String(result);
  } catch {
    return "#ERR";
  }
}

function initSheet(): SheetData {
  return {
    names: Array(5).fill(""),
    actualOb: Array(5).fill(""),
    quoteOb: Array(5).fill(""),
    soOb: Array(5).fill(""),
    siOb: Array(5).fill(""),
    dbCoverage: Array(5).fill(""),
    dbDatabase: Array(5).fill(""),
    dbActual: Array(5).fill(""),
    quoteAmtTarget: Array(5).fill(""),
    quoteAmtActual: Array(5).fill(""),
    soAmtTarget: Array(5).fill(""),
    soAmtActual: Array(5).fill(""),
    siAmtTarget: Array(5).fill(""),
    siAmtActual: Array(5).fill(""),
    svExisting: Array(5).fill("20"),
    svNew: Array(5).fill(""),
    svActual: Array(5).fill(""),
    extraCols: [
      { label: "L", width: DEFAULT_COL_WIDTH, cells: Array(5).fill("") },
      { label: "M", width: DEFAULT_COL_WIDTH, cells: Array(5).fill("") },
    ],
  };
}

function loadSheet(): SheetData {
  if (typeof window === "undefined") return initSheet();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SheetData;
      const n = parsed.names.length;
      const guard = (arr: string[] | undefined, def = "") =>
        !arr || arr.length !== n ? Array(n).fill(def) : arr;
      parsed.actualOb = guard(parsed.actualOb);
      parsed.quoteOb = guard(parsed.quoteOb);
      parsed.soOb = guard(parsed.soOb);
      parsed.siOb = guard(parsed.siOb);
      parsed.dbCoverage = guard(parsed.dbCoverage);
      parsed.dbDatabase = guard(parsed.dbDatabase);
      parsed.dbActual = guard(parsed.dbActual);
      parsed.quoteAmtTarget = guard(parsed.quoteAmtTarget);
      parsed.quoteAmtActual = guard(parsed.quoteAmtActual);
      parsed.soAmtTarget = guard(parsed.soAmtTarget);
      parsed.soAmtActual = guard(parsed.soAmtActual);
      parsed.siAmtTarget = guard(parsed.siAmtTarget);
      parsed.siAmtActual = guard(parsed.siAmtActual);
      parsed.svExisting = guard(parsed.svExisting, "20");
      parsed.svNew = guard(parsed.svNew);
      parsed.svActual = guard(parsed.svActual);
      return parsed;
    }
  } catch { }
  return initSheet();
}

function saveSheet(sheet: SheetData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sheet));
  } catch { }
}

function loadMultiplier(): number {
  if (typeof window === "undefined") return DEFAULT_MULTIPLIER;
  const v = Number(localStorage.getItem(MULTIPLIER_KEY));
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_MULTIPLIER;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReportSummary({
  selectedAgentRefId,
  agentName,
  fromDate,
  toDate,
  dbTotal,
  dbActual,
}: {
  selectedAgentRefId?: string;
  agentName?: string;
  fromDate?: string;
  toDate?: string;
  dbTotal?: number;   // denominators.total from parent
  dbActual?: number;  // coveredAccounts.length from parent
} = {}) {
  const [sheet, setSheet] = useState<SheetData>(initSheet);
  const [obQuota, setObQuota] = useState<number>(FALLBACK_QUOTA);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [multiplier, setMultiplier] = useState<number>(DEFAULT_MULTIPLIER);
  const [editingMultiplier, setEditingMultiplier] = useState(false);
  const [multiplierInput, setMultiplierInput] = useState("");
  const [fetchingOb, setFetchingOb] = useState(false);
  const multiplierRef = useRef<HTMLInputElement>(null);

  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resizingCol = useRef<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => { setSheet(loadSheet()); }, []);
  useEffect(() => { setMultiplier(loadMultiplier()); }, []);
  useEffect(() => { saveSheet(sheet); }, [sheet]);
  useEffect(() => {
    localStorage.setItem(MULTIPLIER_KEY, String(multiplier));
  }, [multiplier]);
  useEffect(() => { if (editingCell) inputRef.current?.focus(); }, [editingCell]);
  useEffect(() => { if (editingMultiplier) multiplierRef.current?.focus(); }, [editingMultiplier]);

  useEffect(() => {
    fetch("/api/outbound-quota")
      .then((res) => res.json())
      .then((data) => {
        if (isFinitePositive(data?.outbound_quota)) {
          setObQuota(data.outbound_quota);
        } else {
          console.warn("outbound-quota: invalid value, falling back to", FALLBACK_QUOTA, data);
        }
      })
      .catch((err) => {
        console.warn("outbound-quota: fetch failed, falling back to", FALLBACK_QUOTA, err);
      })
      .finally(() => setQuotaLoading(false));
  }, []);

  // ── Auto-fetch Actual OB when agent is selected ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedAgentRefId) return;

    setFetchingOb(true);

    const url = new URL("/api/activity/manager/report-summary/fetch-ob", window.location.origin);
    url.searchParams.set("referenceid", selectedAgentRefId);
    if (fromDate) url.searchParams.set("from", fromDate);
    if (toDate)   url.searchParams.set("to", toDate);

    fetch(url.toString())
      .then((r) => r.json())
      .then((data) => {
        // API now returns { actualOb, quoteOb, soOb, siOb }
        const actualObVal      = String(data.actualOb       ?? 0);
        const quoteObVal       = String(data.quoteOb        ?? 0);
        const soObVal          = String(data.soOb           ?? 0);
        const siObVal          = String(data.siOb           ?? 0);
        const quoteAmtActual   = String(Math.round((data.quoteAmtActual ?? 0) * 100) / 100);
        const soAmtActual      = String(Math.round((data.soAmtActual    ?? 0) * 100) / 100);
        const siAmtActual      = String(Math.round((data.siAmtActual    ?? 0) * 100) / 100);

        setSheet((prev) => {
          // Find the row whose name matches agentName, or use the first empty row
          let rowIdx = agentName
            ? prev.names.findIndex((n) => n.trim().toLowerCase() === agentName.trim().toLowerCase())
            : -1;

          // If not found, use first empty name row; if all filled, append
          if (rowIdx === -1) {
            rowIdx = prev.names.findIndex((n) => !n.trim());
          }

          if (rowIdx === -1) {
            // All rows filled — append a new row
            return {
              ...prev,
              names:    [...prev.names,    agentName ?? selectedAgentRefId ?? ""],
              actualOb: [...prev.actualOb, actualObVal],
              quoteOb:  [...prev.quoteOb,  quoteObVal],
              soOb:     [...prev.soOb,     soObVal],
              siOb:     [...prev.siOb,     siObVal],
              dbCoverage:     [...prev.dbCoverage,     ""],
              dbDatabase:     [...prev.dbDatabase,     ""],
              dbActual:       [...prev.dbActual,       ""],
              quoteAmtTarget: [...prev.quoteAmtTarget, ""],
              quoteAmtActual: [...prev.quoteAmtActual, quoteAmtActual],
              soAmtTarget:    [...prev.soAmtTarget,    ""],
              soAmtActual:    [...prev.soAmtActual,    soAmtActual],
              siAmtTarget:    [...prev.siAmtTarget,    ""],
              siAmtActual:    [...prev.siAmtActual,    siAmtActual],
              svExisting: [...prev.svExisting, "20"],
              svNew:      [...prev.svNew,      ""],
              svActual:   [...prev.svActual,   ""],
              extraCols: prev.extraCols.map((ec) => ({ ...ec, cells: [...ec.cells, ""] })),
            };
          }

          // Update existing row
          const names          = [...prev.names];
          const actualOb       = [...prev.actualOb];
          const quoteOb        = [...prev.quoteOb];
          const soOb           = [...prev.soOb];
          const siOb           = [...prev.siOb];
          const quoteAmtActualArr = [...prev.quoteAmtActual];
          const soAmtActualArr    = [...prev.soAmtActual];
          const siAmtActualArr    = [...prev.siAmtActual];
          if (!names[rowIdx]?.trim() && agentName) names[rowIdx] = agentName;
          actualOb[rowIdx]            = actualObVal;
          quoteOb[rowIdx]             = quoteObVal;
          soOb[rowIdx]                = soObVal;
          siOb[rowIdx]                = siObVal;
          quoteAmtActualArr[rowIdx]   = quoteAmtActual;
          soAmtActualArr[rowIdx]      = soAmtActual;
          siAmtActualArr[rowIdx]      = siAmtActual;
          return { ...prev, names, actualOb, quoteOb, soOb, siOb,
            quoteAmtActual: quoteAmtActualArr,
            soAmtActual: soAmtActualArr,
            siAmtActual: siAmtActualArr,
          };
        });
      })
      .catch(() => { /* silent */ })
      .finally(() => setFetchingOb(false));
  }, [selectedAgentRefId, agentName, fromDate, toDate]);

  // ── Auto-fill DB Coverage from parent props ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (dbTotal === undefined && dbActual === undefined) return;
    if (!agentName && !selectedAgentRefId) return;

    setSheet((prev) => {
      // Find the row by agent name or first empty row
      let rowIdx = agentName
        ? prev.names.findIndex((n) => n.trim().toLowerCase() === agentName.trim().toLowerCase())
        : -1;
      if (rowIdx === -1) rowIdx = prev.names.findIndex((n) => !n.trim());
      if (rowIdx === -1) return prev; // no row to update yet — OB fetch will create it

      const dbDatabase = [...prev.dbDatabase];
      const dbActualArr = [...prev.dbActual];
      if (dbTotal !== undefined)  dbDatabase[rowIdx]  = String(dbTotal);
      if (dbActual !== undefined) dbActualArr[rowIdx] = String(dbActual);
      return { ...prev, dbDatabase: dbDatabase, dbActual: dbActualArr };
    });
  }, [dbTotal, dbActual, agentName, selectedAgentRefId]);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    window.addEventListener("contextmenu", handler);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("contextmenu", handler);
    };
  }, [contextMenu]);

  const rowCount = sheet.names.length;

  // ── Display value for extra cols ─────────────────────────────────────────
  function displayExtra(raw: string, rowIdx: number): string {
    if (raw.startsWith("="))
      return evalFormula(raw.slice(1), rowIdx, sheet.names, obQuota, multiplier, sheet.actualOb, sheet.quoteOb, sheet.soOb, sheet.siOb, sheet.extraCols, (fromDate && toDate) ? countWorkingDays(fromDate, toDate) : multiplier);
    return raw;
  }

  // ── Multiplier editing ───────────────────────────────────────────────────
  function startEditMultiplier() {
    setMultiplierInput(String(multiplier));
    setEditingMultiplier(true);
  }

  function commitMultiplier() {
    const v = Number(multiplierInput);
    if (Number.isFinite(v) && v > 0) setMultiplier(v);
    setEditingMultiplier(false);
  }

  function handleMultiplierKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitMultiplier();
    else if (e.key === "Escape") setEditingMultiplier(false);
  }

  // col encoding:
  //  -1=name, -2=actualOb, -3=quoteOb, -4=soOb, -5=siOb,
  //  -6=dbDatabase, -7=dbActual, -8=dbCoverage,
  //  -9=quoteAmtTarget, -10=quoteAmtActual,
  //  -11=soAmtTarget, -12=soAmtActual,
  //  -13=siAmtTarget, -14=siAmtActual,
  //  -15=svExisting, -16=svNew, -17=svActual,
  //  0+=extraCols

  function startEdit(row: number, col: number) {
    setEditingCell({ row, col });
    let val = "";
    if (col === -1) val = sheet.names[row];
    else if (col === -2) val = sheet.actualOb[row] ?? "";
    else if (col === -3) val = sheet.quoteOb[row] ?? "";
    else if (col === -4) val = sheet.soOb[row] ?? "";
    else if (col === -5) val = sheet.siOb[row] ?? "";
    else if (col === -6) val = sheet.dbDatabase[row] ?? "";
    else if (col === -7) val = sheet.dbActual[row] ?? "";
    else if (col === -8) val = sheet.dbCoverage[row] ?? "";
    else if (col === -9) val = sheet.quoteAmtTarget[row] ?? "";
    else if (col === -10) val = sheet.quoteAmtActual[row] ?? "";
    else if (col === -11) val = sheet.soAmtTarget[row] ?? "";
    else if (col === -12) val = sheet.soAmtActual[row] ?? "";
    else if (col === -13) val = sheet.siAmtTarget[row] ?? "";
    else if (col === -14) val = sheet.siAmtActual[row] ?? "";
    else if (col === -15) val = sheet.svExisting[row] ?? "20";
    else if (col === -16) val = sheet.svNew[row] ?? "";
    else if (col === -17) val = sheet.svActual[row] ?? "";
    else val = sheet.extraCols[col]?.cells[row] ?? "";
    setEditValue(val);
  }

  function commitEdit() {
    if (!editingCell) return;
    const { row, col } = editingCell;
    setSheet((prev) => {
      if (col === -1) { const names = [...prev.names]; names[row] = editValue; return { ...prev, names }; }
      if (col === -2) { const actualOb = [...prev.actualOb]; actualOb[row] = editValue; return { ...prev, actualOb }; }
      if (col === -3) { const quoteOb = [...prev.quoteOb]; quoteOb[row] = editValue; return { ...prev, quoteOb }; }
      if (col === -4) { const soOb = [...prev.soOb]; soOb[row] = editValue; return { ...prev, soOb }; }
      if (col === -5) { const siOb = [...prev.siOb]; siOb[row] = editValue; return { ...prev, siOb }; }
      if (col === -6) { const dbDatabase = [...prev.dbDatabase]; dbDatabase[row] = editValue; return { ...prev, dbDatabase }; }
      if (col === -7) { const dbActual = [...prev.dbActual]; dbActual[row] = editValue; return { ...prev, dbActual }; }
      if (col === -8) { const dbCoverage = [...prev.dbCoverage]; dbCoverage[row] = editValue; return { ...prev, dbCoverage }; }
      if (col === -9) { const quoteAmtTarget = [...prev.quoteAmtTarget]; quoteAmtTarget[row] = editValue; return { ...prev, quoteAmtTarget }; }
      if (col === -10) { const quoteAmtActual = [...prev.quoteAmtActual]; quoteAmtActual[row] = editValue; return { ...prev, quoteAmtActual }; }
      if (col === -11) { const soAmtTarget = [...prev.soAmtTarget]; soAmtTarget[row] = editValue; return { ...prev, soAmtTarget }; }
      if (col === -12) { const soAmtActual = [...prev.soAmtActual]; soAmtActual[row] = editValue; return { ...prev, soAmtActual }; }
      if (col === -13) { const siAmtTarget = [...prev.siAmtTarget]; siAmtTarget[row] = editValue; return { ...prev, siAmtTarget }; }
      if (col === -14) { const siAmtActual = [...prev.siAmtActual]; siAmtActual[row] = editValue; return { ...prev, siAmtActual }; }
      if (col === -15) { const svExisting = [...prev.svExisting]; svExisting[row] = editValue; return { ...prev, svExisting }; }
      if (col === -16) { const svNew = [...prev.svNew]; svNew[row] = editValue; return { ...prev, svNew }; }
      if (col === -17) { const svActual = [...prev.svActual]; svActual[row] = editValue; return { ...prev, svActual }; }
      const extraCols = prev.extraCols.map((ec, ci) => {
        if (ci !== col) return ec;
        const cells = [...ec.cells]; cells[row] = editValue; return { ...ec, cells };
      });
      return { ...prev, extraCols };
    });
    setEditingCell(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const totalCols = 17 + sheet.extraCols.length;
    const toFlat = (c: number) =>
      c === -1 ? 0 : c === -2 ? 1 : c === -3 ? 2 : c === -4 ? 3 : c === -5 ? 4 :
        c === -6 ? 5 : c === -7 ? 6 : c === -8 ? 7 : c === -9 ? 8 : c === -10 ? 9 :
          c === -11 ? 10 : c === -12 ? 11 : c === -13 ? 12 : c === -14 ? 13 :
            c === -15 ? 14 : c === -16 ? 15 : c === -17 ? 16 : c + 17;
    const fromFlat = (f: number) =>
      f === 0 ? -1 : f === 1 ? -2 : f === 2 ? -3 : f === 3 ? -4 : f === 4 ? -5 :
        f === 5 ? -6 : f === 6 ? -7 : f === 7 ? -8 : f === 8 ? -9 : f === 9 ? -10 :
          f === 10 ? -11 : f === 11 ? -12 : f === 12 ? -13 : f === 13 ? -14 :
            f === 14 ? -15 : f === 15 ? -16 : f === 16 ? -17 : f - 17;
    const flatCol = editingCell ? toFlat(editingCell.col) : 0;

    const getVal = (r: number, c: number) =>
      c === -1 ? sheet.names[r] :
        c === -2 ? sheet.actualOb[r] ?? "" : c === -3 ? sheet.quoteOb[r] ?? "" :
          c === -4 ? sheet.soOb[r] ?? "" : c === -5 ? sheet.siOb[r] ?? "" :
            c === -6 ? sheet.dbDatabase[r] ?? "" : c === -7 ? sheet.dbActual[r] ?? "" :
              c === -8 ? sheet.dbCoverage[r] ?? "" : c === -9 ? sheet.quoteAmtTarget[r] ?? "" :
                c === -10 ? sheet.quoteAmtActual[r] ?? "" : c === -11 ? sheet.soAmtTarget[r] ?? "" :
                  c === -12 ? sheet.soAmtActual[r] ?? "" : c === -13 ? sheet.siAmtTarget[r] ?? "" :
                    c === -14 ? sheet.siAmtActual[r] ?? "" : c === -15 ? sheet.svExisting[r] ?? "20" :
                      c === -16 ? sheet.svNew[r] ?? "" : c === -17 ? sheet.svActual[r] ?? "" :
                        sheet.extraCols[c]?.cells[r] ?? "";

    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
      if (editingCell && editingCell.row + 1 < rowCount) {
        const next = { row: editingCell.row + 1, col: editingCell.col };
        setEditingCell(next);
        setEditValue(getVal(next.row, next.col));
      }
    } else if (e.key === "Escape") {
      setEditingCell(null);
    } else if (e.key === "Tab") {
      e.preventDefault();
      commitEdit();
      if (editingCell) {
        const nextFlat = (flatCol + 1) % totalCols;
        const nextCol = fromFlat(nextFlat);
        const nextRow = flatCol + 1 >= totalCols ? editingCell.row + 1 : editingCell.row;
        if (nextRow < rowCount) {
          setEditingCell({ row: nextRow, col: nextCol });
          setEditValue(getVal(nextRow, nextCol));
        } else {
          setEditingCell(null);
        }
      }
    }
  }

  // ── Column resize ────────────────────────────────────────────────────────
  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent, colIdx: number) => {
      e.preventDefault();
      e.stopPropagation();
      resizingCol.current = colIdx;
      resizeStartX.current = e.clientX;
      resizeStartWidth.current = sheet.extraCols[colIdx]?.width ?? DEFAULT_COL_WIDTH;

      const onMouseMove = (ev: MouseEvent) => {
        if (resizingCol.current === null) return;
        const delta = ev.clientX - resizeStartX.current;
        const newWidth = Math.max(MIN_COL_WIDTH, resizeStartWidth.current + delta);
        setSheet((prev) => {
          const extraCols = prev.extraCols.map((ec, i) =>
            i === resizingCol.current ? { ...ec, width: newWidth } : ec
          );
          return { ...prev, extraCols };
        });
      };

      const onMouseUp = () => {
        resizingCol.current = null;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [sheet.extraCols]
  );

  // ── Context menu ─────────────────────────────────────────────────────────
  function openContextMenu(e: React.MouseEvent, colIdx: number) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, colIdx });
  }

  function insertExtraCol(at: number) {
    setSheet((prev) => {
      const label = colLabel(11 + at);
      const newCol = { label, width: DEFAULT_COL_WIDTH, cells: Array(prev.names.length).fill("") };
      return { ...prev, extraCols: insertAt(prev.extraCols, at, newCol) };
    });
    setContextMenu(null);
  }

  function removeExtraCol(colIdx: number) {
    setSheet((prev) => ({
      ...prev,
      extraCols: prev.extraCols.filter((_, i) => i !== colIdx),
    }));
    setContextMenu(null);
  }

  function renameExtraCol(colIdx: number, name: string) {
    setSheet((prev) => ({
      ...prev,
      extraCols: prev.extraCols.map((ec, i) => (i === colIdx ? { ...ec, label: name } : ec)),
    }));
  }

  function addExtraCol() {
    setSheet((prev) => ({
      ...prev,
      extraCols: [
        ...prev.extraCols,
        { label: colLabel(11 + prev.extraCols.length), width: DEFAULT_COL_WIDTH, cells: Array(prev.names.length).fill("") },
      ],
    }));
  }

  function addRow() {
    setSheet((prev) => ({
      names: [...prev.names, ""],
      actualOb: [...prev.actualOb, ""],
      quoteOb: [...prev.quoteOb, ""],
      soOb: [...prev.soOb, ""],
      siOb: [...prev.siOb, ""],
      dbCoverage: [...prev.dbCoverage, ""],
      dbDatabase: [...prev.dbDatabase, ""],
      dbActual: [...prev.dbActual, ""],
      quoteAmtTarget: [...prev.quoteAmtTarget, ""],
      quoteAmtActual: [...prev.quoteAmtActual, ""],
      soAmtTarget: [...prev.soAmtTarget, ""],
      soAmtActual: [...prev.soAmtActual, ""],
      siAmtTarget: [...prev.siAmtTarget, ""],
      siAmtActual: [...prev.siAmtActual, ""],
      svExisting: [...prev.svExisting, "20"],
      svNew: [...prev.svNew, ""],
      svActual: [...prev.svActual, ""],
      extraCols: prev.extraCols.map((ec) => ({ ...ec, cells: [...ec.cells, ""] })),
    }));
  }

  function removeRow(rowIdx: number) {
    if (sheet.names.length <= 1) return;
    setSheet((prev) => ({
      names: prev.names.filter((_, i) => i !== rowIdx),
      actualOb: prev.actualOb.filter((_, i) => i !== rowIdx),
      quoteOb: prev.quoteOb.filter((_, i) => i !== rowIdx),
      soOb: prev.soOb.filter((_, i) => i !== rowIdx),
      siOb: prev.siOb.filter((_, i) => i !== rowIdx),
      dbCoverage: prev.dbCoverage.filter((_, i) => i !== rowIdx),
      dbDatabase: prev.dbDatabase.filter((_, i) => i !== rowIdx),
      dbActual: prev.dbActual.filter((_, i) => i !== rowIdx),
      quoteAmtTarget: prev.quoteAmtTarget.filter((_, i) => i !== rowIdx),
      quoteAmtActual: prev.quoteAmtActual.filter((_, i) => i !== rowIdx),
      soAmtTarget: prev.soAmtTarget.filter((_, i) => i !== rowIdx),
      soAmtActual: prev.soAmtActual.filter((_, i) => i !== rowIdx),
      siAmtTarget: prev.siAmtTarget.filter((_, i) => i !== rowIdx),
      siAmtActual: prev.siAmtActual.filter((_, i) => i !== rowIdx),
      svExisting: prev.svExisting.filter((_, i) => i !== rowIdx),
      svNew: prev.svNew.filter((_, i) => i !== rowIdx),
      svActual: prev.svActual.filter((_, i) => i !== rowIdx),
      extraCols: prev.extraCols.map((ec) => ({
        ...ec,
        cells: ec.cells.filter((_, i) => i !== rowIdx),
      })),
    }));
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <li className="bg-white border border-gray-200 shadow-sm overflow-hidden border-l-4 border-l-indigo-500">
      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-700">
          Daily Sales Summary
        </span>
        <div className="flex gap-1">
          <button
            onClick={addExtraCol}
            className="flex items-center gap-0.5 text-[9px] text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 border border-indigo-200 hover:border-indigo-400 rounded transition-colors"
          >
            <Plus size={9} /> Col
          </button>
          <button
            onClick={addRow}
            className="flex items-center gap-0.5 text-[9px] text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 border border-indigo-200 hover:border-indigo-400 rounded transition-colors"
          >
            <Plus size={9} /> Row
          </button>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="overflow-auto">
        <table className="border-collapse text-[11px]" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: NAME_COL_WIDTH }} />
            <col style={{ width: OB_COL_WIDTH }} />
            <col style={{ width: OB_TARGET_COL_WIDTH }} />
            <col style={{ width: ACTUAL_OB_COL_WIDTH }} />
            <col style={{ width: ACHIEVEMENT_COL_WIDTH }} />
            <col style={{ width: QUOTE_OB_COL_WIDTH }} />
            <col style={{ width: CALLS_TO_QUOTE_COL_WIDTH }} />
            <col style={{ width: SO_OB_COL_WIDTH }} />
            <col style={{ width: QUOTE_TO_SO_COL_WIDTH }} />
            <col style={{ width: SI_OB_COL_WIDTH }} />
            <col style={{ width: SO_TO_SI_COL_WIDTH }} />
            <col style={{ width: DB_COVERAGE_COL_WIDTH }} />
            <col style={{ width: DB_COL_WIDTH }} />
            <col style={{ width: DB_ACTUAL_COL_WIDTH }} />
            <col style={{ width: DB_ACHIEVEMENT_COL_WIDTH }} />
            <col style={{ width: QUOTE_AMT_TARGET_COL_WIDTH }} />
            <col style={{ width: QUOTE_AMT_ACTUAL_COL_WIDTH }} />
            <col style={{ width: QUOTE_AMT_ACHIEVEMENT_COL_WIDTH }} />
            <col style={{ width: SO_AMT_TARGET_COL_WIDTH }} />
            <col style={{ width: SO_AMT_ACTUAL_COL_WIDTH }} />
            <col style={{ width: SO_AMT_ACHIEVEMENT_COL_WIDTH }} />
            <col style={{ width: SI_AMT_TARGET_COL_WIDTH }} />
            <col style={{ width: SI_AMT_ACTUAL_COL_WIDTH }} />
            <col style={{ width: SI_AMT_ACHIEVEMENT_COL_WIDTH }} />
            {/* ── Site Visit columns ── */}
            <col style={{ width: SV_EXISTING_COL_WIDTH }} />
            <col style={{ width: SV_NEW_COL_WIDTH }} />
            <col style={{ width: SV_ACTUAL_COL_WIDTH }} />
            <col style={{ width: SV_ACHIEVEMENT_COL_WIDTH }} />
            {sheet.extraCols.map((ec, i) => (
              <col key={i} style={{ width: ec.width }} />
            ))}
            <col style={{ width: 16 }} />
          </colgroup>

          <thead>
            <tr>
              <th className="bg-gray-100 border border-gray-200 select-none" />

              {/* Name */}
              <th className="bg-gray-100 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-gray-500">Name</span>
              </th>

              {/* OB Calls Daily */}
              <th className="bg-gray-100 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-[10px] font-semibold text-indigo-600 truncate">OB Calls Daily</span>
                  {quotaLoading && <Loader2 size={8} className="animate-spin text-gray-400" />}
                </div>
              </th>

              {/* OB Calls Target */}
              <th className="bg-gray-100 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-[10px] font-semibold text-emerald-600 truncate">OB Calls Target</span>
                  <button onClick={startEditMultiplier} className="shrink-0 flex items-center" title="Click to change multiplier">
                    {editingMultiplier ? (
                      <input
                        ref={multiplierRef}
                        className="w-7 text-center text-[9px] font-bold bg-white border border-indigo-300 rounded outline-none tabular-nums"
                        value={multiplierInput}
                        onChange={(e) => setMultiplierInput(e.target.value)}
                        onBlur={commitMultiplier}
                        onKeyDown={handleMultiplierKeyDown}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-[9px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded px-1 tabular-nums transition-colors cursor-pointer">
                        ×{multiplier}
                      </span>
                    )}
                  </button>
                </div>
              </th>

              {/* Actual OB */}
              <th className="bg-gray-100 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-[10px] font-semibold text-orange-600 truncate">Actual OB</span>
                  {fetchingOb && <Loader2 size={8} className="animate-spin text-orange-400" />}
                </div>
              </th>

              {/* OB Calls Achievement */}
              <th className="bg-gray-100 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-violet-600 truncate">OB Achievement</span>
              </th>

              {/* Quote Based on OB */}
              <th className="bg-gray-100 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-sky-600 truncate">Quote Based on OB</span>
              </th>

              {/* Calls to Quote 20% */}
              <th className="bg-gray-100 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-pink-600 truncate">Calls to Quote (20%)</span>
              </th>

              {/* SO Based on OB */}
              <th className="bg-gray-100 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-teal-600 truncate">SO Based on OB</span>
              </th>

              {/* Quote to SO 30% */}
              <th className="bg-gray-100 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-rose-600 truncate">Quote to SO (30%)</span>
              </th>

              {/* SI Based on OB */}
              <th className="bg-gray-100 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-cyan-600 truncate">SI Based on OB</span>
              </th>

              {/* SO to SI 70% */}
              <th className="bg-gray-100 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-fuchsia-600 truncate">SO to SI (70%)</span>
              </th>

              {/* DB Coverage */}
              <th className="bg-amber-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-amber-700 truncate">DB Coverage</span>
              </th>
              <th className="bg-amber-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-amber-700 truncate">Database</span>
              </th>
              <th className="bg-amber-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-amber-700 truncate">Actual</span>
              </th>
              <th className="bg-amber-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-amber-700 truncate">Achievement</span>
              </th>

              {/* Quote Amt */}
              <th className="bg-lime-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-lime-700 truncate">Total Quote Amt Target (MO)</span>
              </th>
              <th className="bg-lime-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-lime-700 truncate">Actual Quote Amt</span>
              </th>
              <th className="bg-lime-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-lime-700 truncate">Achievement</span>
              </th>

              {/* SO Amt */}
              <th className="bg-purple-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-purple-700 truncate">SO Amt Target (MO)</span>
              </th>
              <th className="bg-purple-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-purple-700 truncate">Actual SO Amt</span>
              </th>
              <th className="bg-purple-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-purple-700 truncate">Achievement</span>
              </th>

              {/* SI Amt */}
              <th className="bg-orange-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-orange-700 truncate">SI Amt Target (MO)</span>
              </th>
              <th className="bg-orange-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-orange-700 truncate">Actual SI Amt</span>
              </th>
              <th className="bg-orange-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-orange-700 truncate">Achievement</span>
              </th>

              {/* ── Site Visit columns ── */}
              <th className="bg-green-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-green-700 truncate">SV Existing</span>
              </th>
              <th className="bg-green-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-green-700 truncate">SV New</span>
              </th>
              <th className="bg-green-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-green-700 truncate">SV Actual</span>
              </th>
              <th className="bg-green-50 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-green-700 truncate">SV Achievement</span>
              </th>

              {/* User extra cols */}
              {sheet.extraCols.map((ec, ci) => (
                <th
                  key={ci}
                  className="bg-gray-100 border border-gray-200 px-0 py-0 font-semibold text-gray-600 text-center group relative select-none"
                  onContextMenu={(e) => openContextMenu(e, ci)}
                >
                  <div className="flex items-center h-6">
                    <input
                      className="flex-1 min-w-0 bg-transparent text-center text-[10px] font-semibold text-gray-600 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 px-1 h-full"
                      value={ec.label}
                      onChange={(e) => renameExtraCol(ci, e.target.value)}
                      onContextMenu={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={() => removeExtraCol(ci)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity px-0.5 shrink-0"
                    >
                      <Trash2 size={9} />
                    </button>
                    <div
                      onMouseDown={(e) => onResizeMouseDown(e, ci)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-indigo-400 active:bg-indigo-600 transition-colors z-10"
                    />
                  </div>
                </th>
              ))}

              <th className="bg-gray-50 border border-gray-200" />
            </tr>
          </thead>

          <tbody>
            {sheet.names.map((name, ri) => {
              const hasName = name.trim() !== "";
              const obDisplay = hasName ? (quotaLoading ? "…" : String(obQuota)) : "";
              // Use working days in range (Mon–Sat) × daily quota; fall back to multiplier if no range
              const workingDaysInRange = (fromDate && toDate) ? countWorkingDays(fromDate, toDate) : multiplier;
              const target = obQuota * workingDaysInRange;
              const targetDisplay = hasName ? (quotaLoading ? "…" : String(target)) : "";
              const actualObVal = sheet.actualOb[ri] ?? "";

              const achievementDisplay = (() => {
                if (!hasName || target === 0) return "";
                const actual = Number(actualObVal);
                if (isNaN(actual) || actualObVal === "") return "";
                return ((actual / target) * 100).toFixed(2) + "%";
              })();
              const achievementNum = parseFloat(achievementDisplay);
              const achievementColor = !achievementDisplay ? "text-gray-300"
                : achievementNum >= 100 ? "text-emerald-700"
                  : achievementNum >= 75 ? "text-amber-600" : "text-red-600";

              const quoteObVal = sheet.quoteOb[ri] ?? "";
              const callsToQuoteDisplay = (() => {
                if (!hasName) return "";
                const actual = Number(actualObVal);
                const quote = Number(quoteObVal);
                if (actual === 0 || quoteObVal === "" || actualObVal === "") return "";
                return ((quote / actual) * 100).toFixed(2) + "%";
              })();
              const callsToQuoteNum = parseFloat(callsToQuoteDisplay);
              const callsToQuoteColor = !callsToQuoteDisplay ? "text-gray-300"
                : callsToQuoteNum >= 20 ? "text-emerald-700"
                  : callsToQuoteNum >= 10 ? "text-amber-600" : "text-red-600";

              const soObVal = sheet.soOb[ri] ?? "";
              const quoteToSoDisplay = (() => {
                if (!hasName) return "";
                const quote = Number(quoteObVal);
                const so = Number(soObVal);
                if (quote === 0 || soObVal === "" || quoteObVal === "") return "";
                return ((so / quote) * 100).toFixed(2) + "%";
              })();
              const quoteToSoNum = parseFloat(quoteToSoDisplay);
              const quoteToSoColor = !quoteToSoDisplay ? "text-gray-300"
                : quoteToSoNum >= 30 ? "text-emerald-700"
                  : quoteToSoNum >= 15 ? "text-amber-600" : "text-red-600";

              const siObVal = sheet.siOb[ri] ?? "";
              const soToSiDisplay = (() => {
                if (!hasName) return "";
                const so = Number(soObVal);
                const si = Number(siObVal);
                if (so === 0 || siObVal === "" || soObVal === "") return "";
                return ((si / so) * 100).toFixed(2) + "%";
              })();
              const soToSiNum = parseFloat(soToSiDisplay);
              const soToSiColor = !soToSiDisplay ? "text-gray-300"
                : soToSiNum >= 70 ? "text-emerald-700"
                  : soToSiNum >= 35 ? "text-amber-600" : "text-red-600";

              const dbDatabaseVal = sheet.dbDatabase[ri] ?? "";
              const dbActualVal = sheet.dbActual[ri] ?? "";
              const dbAchievementDisplay = (() => {
                if (!hasName) return "";
                const db = Number(dbDatabaseVal);
                const act = Number(dbActualVal);
                if (db === 0 || dbDatabaseVal === "" || dbActualVal === "") return "";
                return ((act / db) * 100).toFixed(2) + "%";
              })();
              const dbAchievementNum = parseFloat(dbAchievementDisplay);
              const dbAchievementColor = !dbAchievementDisplay ? "text-gray-300"
                : dbAchievementNum >= 100 ? "text-emerald-700"
                  : dbAchievementNum >= 75 ? "text-amber-600" : "text-red-600";

              const quoteAmtTargetVal = sheet.quoteAmtTarget[ri] ?? "";
              const quoteAmtActualVal = sheet.quoteAmtActual[ri] ?? "";
              const quoteAmtAchievementDisplay = (() => {
                if (!hasName) return "";
                const t = Number(quoteAmtTargetVal);
                const a = Number(quoteAmtActualVal);
                if (t === 0 || quoteAmtTargetVal === "" || quoteAmtActualVal === "") return "";
                return ((a / t) * 100).toFixed(2) + "%";
              })();
              const quoteAmtAchievementNum = parseFloat(quoteAmtAchievementDisplay);
              const quoteAmtAchievementColor = !quoteAmtAchievementDisplay ? "text-gray-300"
                : quoteAmtAchievementNum >= 100 ? "text-emerald-700"
                  : quoteAmtAchievementNum >= 75 ? "text-amber-600" : "text-red-600";

              const soAmtTargetVal = sheet.soAmtTarget[ri] ?? "";
              const soAmtActualVal = sheet.soAmtActual[ri] ?? "";
              const soAmtAchievementDisplay = (() => {
                if (!hasName) return "";
                const t = Number(soAmtTargetVal);
                const a = Number(soAmtActualVal);
                if (t === 0 || soAmtTargetVal === "" || soAmtActualVal === "") return "";
                return ((a / t) * 100).toFixed(2) + "%";
              })();
              const soAmtAchievementNum = parseFloat(soAmtAchievementDisplay);
              const soAmtAchievementColor = !soAmtAchievementDisplay ? "text-gray-300"
                : soAmtAchievementNum >= 100 ? "text-emerald-700"
                  : soAmtAchievementNum >= 75 ? "text-amber-600" : "text-red-600";

              const siAmtTargetVal = sheet.siAmtTarget[ri] ?? "";
              const siAmtActualVal = sheet.siAmtActual[ri] ?? "";
              const siAmtAchievementDisplay = (() => {
                if (!hasName) return "";
                const t = Number(siAmtTargetVal);
                const a = Number(siAmtActualVal);
                if (t === 0 || siAmtTargetVal === "" || siAmtActualVal === "") return "";
                return ((a / t) * 100).toFixed(2) + "%";
              })();
              const siAmtAchievementNum = parseFloat(siAmtAchievementDisplay);
              const siAmtAchievementColor = !siAmtAchievementDisplay ? "text-gray-300"
                : siAmtAchievementNum >= 100 ? "text-emerald-700"
                  : siAmtAchievementNum >= 75 ? "text-amber-600" : "text-red-600";

              // ── Site Visit computations ──
              const svExistingVal = sheet.svExisting[ri] ?? "20";
              const svNewVal = sheet.svNew[ri] ?? "";
              const svActualVal = sheet.svActual[ri] ?? "";
              const svAchievementDisplay = (() => {
                if (!hasName) return "";
                const existing = Number(svExistingVal === "" ? "20" : svExistingVal);
                const newV = Number(svNewVal);
                const actual = Number(svActualVal);
                const denom = existing + newV;
                if (svActualVal === "" || denom === 0) return "";
                return ((actual / denom) * 100).toFixed(2) + "%";
              })();
              const svAchievementNum = parseFloat(svAchievementDisplay);
              const svAchievementColor = !svAchievementDisplay ? "text-gray-300"
                : svAchievementNum >= 100 ? "text-emerald-700"
                  : svAchievementNum >= 75 ? "text-amber-600" : "text-red-600";

              return (
                <tr key={ri} className="group/row hover:bg-indigo-50/30">
                  {/* Row number */}
                  <td className="bg-gray-100 border border-gray-200 text-center text-[9px] text-gray-400 select-none px-1">
                    <div className="flex items-center justify-between gap-0.5">
                      <span>{ri + 1}</span>
                      <button
                        onClick={() => removeRow(ri)}
                        className="opacity-0 group-hover/row:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                      >
                        <Trash2 size={8} />
                      </button>
                    </div>
                  </td>

                  {/* Name */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -1 ? "bg-white ring-1 ring-inset ring-indigo-400 z-10" : "hover:bg-indigo-50"}`}
                    onClick={() => startEdit(ri, -1)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -1 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className="block truncate text-gray-800">{name}</span>
                    )}
                  </td>

                  {/* OB Calls Daily (read-only) */}
                  <td className="border border-gray-200 px-1 py-0 h-6 overflow-hidden bg-gray-50/50 select-none">
                    <span className={`block truncate tabular-nums text-center font-semibold ${hasName ? "text-indigo-700" : "text-gray-300"}`}>{obDisplay}</span>
                  </td>

                  {/* OB Calls Target (read-only) */}
                  <td className="border border-gray-200 px-1 py-0 h-6 overflow-hidden bg-emerald-50/40 select-none">
                    <span className={`block truncate tabular-nums text-center font-semibold ${hasName ? "text-emerald-700" : "text-gray-300"}`}>{targetDisplay}</span>
                  </td>

                  {/* Actual OB */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -2 ? "bg-white ring-1 ring-inset ring-orange-400 z-10" : "hover:bg-orange-50"}`}
                    onClick={() => startEdit(ri, -2)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -2 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className={`block truncate tabular-nums text-center font-semibold ${actualObVal ? "text-orange-700" : "text-gray-300"}`}>{actualObVal}</span>
                    )}
                  </td>

                  {/* OB Calls Achievement (read-only) */}
                  <td className="border border-gray-200 px-1 py-0 h-6 overflow-hidden bg-violet-50/30 select-none">
                    <span className={`block truncate tabular-nums text-center font-bold ${achievementColor}`}>{achievementDisplay}</span>
                  </td>

                  {/* Quote Based on OB */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -3 ? "bg-white ring-1 ring-inset ring-sky-400 z-10" : "hover:bg-sky-50"}`}
                    onClick={() => startEdit(ri, -3)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -3 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className={`block truncate tabular-nums text-center font-semibold ${quoteObVal ? "text-sky-700" : "text-gray-300"}`}>{quoteObVal}</span>
                    )}
                  </td>

                  {/* Calls to Quote (read-only) */}
                  <td className="border border-gray-200 px-1 py-0 h-6 overflow-hidden bg-pink-50/30 select-none">
                    <span className={`block truncate tabular-nums text-center font-bold ${callsToQuoteColor}`}>{callsToQuoteDisplay}</span>
                  </td>

                  {/* SO Based on OB */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -4 ? "bg-white ring-1 ring-inset ring-teal-400 z-10" : "hover:bg-teal-50"}`}
                    onClick={() => startEdit(ri, -4)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -4 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className={`block truncate tabular-nums text-center font-semibold ${soObVal ? "text-teal-700" : "text-gray-300"}`}>{soObVal}</span>
                    )}
                  </td>

                  {/* Quote to SO (read-only) */}
                  <td className="border border-gray-200 px-1 py-0 h-6 overflow-hidden bg-rose-50/30 select-none">
                    <span className={`block truncate tabular-nums text-center font-bold ${quoteToSoColor}`}>{quoteToSoDisplay}</span>
                  </td>

                  {/* SI Based on OB */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -5 ? "bg-white ring-1 ring-inset ring-cyan-400 z-10" : "hover:bg-cyan-50"}`}
                    onClick={() => startEdit(ri, -5)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -5 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className={`block truncate tabular-nums text-center font-semibold ${siObVal ? "text-cyan-700" : "text-gray-300"}`}>{siObVal}</span>
                    )}
                  </td>

                  {/* SO to SI (read-only) */}
                  <td className="border border-gray-200 px-1 py-0 h-6 overflow-hidden bg-fuchsia-50/30 select-none">
                    <span className={`block truncate tabular-nums text-center font-bold ${soToSiColor}`}>{soToSiDisplay}</span>
                  </td>

                  {/* DB Coverage */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -8 ? "bg-white ring-1 ring-inset ring-amber-400 z-10" : "hover:bg-amber-50"}`}
                    onClick={() => startEdit(ri, -8)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -8 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className={`block truncate tabular-nums text-center font-semibold ${(sheet.dbCoverage[ri] ?? "") ? "text-amber-700" : "text-gray-300"}`}>{sheet.dbCoverage[ri] ?? ""}</span>
                    )}
                  </td>

                  {/* Database */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -6 ? "bg-white ring-1 ring-inset ring-amber-400 z-10" : "hover:bg-amber-50"}`}
                    onClick={() => startEdit(ri, -6)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -6 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className={`block truncate tabular-nums text-center font-semibold ${dbDatabaseVal ? "text-amber-700" : "text-gray-300"}`}>{dbDatabaseVal}</span>
                    )}
                  </td>

                  {/* DB Actual */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -7 ? "bg-white ring-1 ring-inset ring-amber-400 z-10" : "hover:bg-amber-50"}`}
                    onClick={() => startEdit(ri, -7)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -7 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className={`block truncate tabular-nums text-center font-semibold ${dbActualVal ? "text-amber-700" : "text-gray-300"}`}>{dbActualVal}</span>
                    )}
                  </td>

                  {/* DB Achievement (read-only) */}
                  <td className="border border-gray-200 px-1 py-0 h-6 overflow-hidden bg-amber-50/40 select-none">
                    <span className={`block truncate tabular-nums text-center font-bold ${dbAchievementColor}`}>{dbAchievementDisplay}</span>
                  </td>

                  {/* Quote Amt Target */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -9 ? "bg-white ring-1 ring-inset ring-lime-400 z-10" : "hover:bg-lime-50"}`}
                    onClick={() => startEdit(ri, -9)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -9 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className={`block truncate tabular-nums text-center font-semibold ${quoteAmtTargetVal ? "text-lime-700" : "text-gray-300"}`}>{fmtAmt(quoteAmtTargetVal)}</span>
                    )}
                  </td>

                  {/* Actual Quote Amt */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -10 ? "bg-white ring-1 ring-inset ring-lime-400 z-10" : "hover:bg-lime-50"}`}
                    onClick={() => startEdit(ri, -10)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -10 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className={`block truncate tabular-nums text-center font-semibold ${quoteAmtActualVal ? "text-lime-700" : "text-gray-300"}`}>{fmtAmt(quoteAmtActualVal)}</span>
                    )}
                  </td>

                  {/* Quote Amt Achievement (read-only) */}
                  <td className="border border-gray-200 px-1 py-0 h-6 overflow-hidden bg-lime-50/40 select-none">
                    <span className={`block truncate tabular-nums text-center font-bold ${quoteAmtAchievementColor}`}>{quoteAmtAchievementDisplay}</span>
                  </td>

                  {/* SO Amt Target */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -11 ? "bg-white ring-1 ring-inset ring-purple-400 z-10" : "hover:bg-purple-50"}`}
                    onClick={() => startEdit(ri, -11)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -11 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className={`block truncate tabular-nums text-center font-semibold ${soAmtTargetVal ? "text-purple-700" : "text-gray-300"}`}>{fmtAmt(soAmtTargetVal)}</span>
                    )}
                  </td>

                  {/* Actual SO Amt */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -12 ? "bg-white ring-1 ring-inset ring-purple-400 z-10" : "hover:bg-purple-50"}`}
                    onClick={() => startEdit(ri, -12)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -12 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className={`block truncate tabular-nums text-center font-semibold ${soAmtActualVal ? "text-purple-700" : "text-gray-300"}`}>{fmtAmt(soAmtActualVal)}</span>
                    )}
                  </td>

                  {/* SO Amt Achievement (read-only) */}
                  <td className="border border-gray-200 px-1 py-0 h-6 overflow-hidden bg-purple-50/40 select-none">
                    <span className={`block truncate tabular-nums text-center font-bold ${soAmtAchievementColor}`}>{soAmtAchievementDisplay}</span>
                  </td>

                  {/* SI Amt Target */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -13 ? "bg-white ring-1 ring-inset ring-orange-400 z-10" : "hover:bg-orange-50"}`}
                    onClick={() => startEdit(ri, -13)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -13 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className={`block truncate tabular-nums text-center font-semibold ${siAmtTargetVal ? "text-orange-700" : "text-gray-300"}`}>{siAmtTargetVal}</span>
                    )}
                  </td>

                  {/* Actual SI Amt */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -14 ? "bg-white ring-1 ring-inset ring-orange-400 z-10" : "hover:bg-orange-50"}`}
                    onClick={() => startEdit(ri, -14)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -14 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className={`block truncate tabular-nums text-center font-semibold ${siAmtActualVal ? "text-orange-700" : "text-gray-300"}`}>{siAmtActualVal}</span>
                    )}
                  </td>

                  {/* SI Amt Achievement (read-only) */}
                  <td className="border border-gray-200 px-1 py-0 h-6 overflow-hidden bg-orange-50/40 select-none">
                    <span className={`block truncate tabular-nums text-center font-bold ${siAmtAchievementColor}`}>{siAmtAchievementDisplay}</span>
                  </td>

                  {/* ── Site Visit: Existing (editable, default 20) ── */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -15 ? "bg-white ring-1 ring-inset ring-green-400 z-10" : "hover:bg-green-50"}`}
                    onClick={() => startEdit(ri, -15)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -15 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className={`block truncate tabular-nums text-center font-semibold ${hasName ? "text-green-700" : "text-gray-300"}`}>
                        {hasName ? (svExistingVal === "" ? "20" : svExistingVal) : ""}
                      </span>
                    )}
                  </td>

                  {/* ── Site Visit: New (manual) ── */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -16 ? "bg-white ring-1 ring-inset ring-green-400 z-10" : "hover:bg-green-50"}`}
                    onClick={() => startEdit(ri, -16)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -16 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className={`block truncate tabular-nums text-center font-semibold ${svNewVal ? "text-green-700" : "text-gray-300"}`}>{svNewVal}</span>
                    )}
                  </td>

                  {/* ── Site Visit: Actual (manual) ── */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${editingCell?.row === ri && editingCell?.col === -17 ? "bg-white ring-1 ring-inset ring-green-400 z-10" : "hover:bg-green-50"}`}
                    onClick={() => startEdit(ri, -17)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -17 ? (
                      <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                    ) : (
                      <span className={`block truncate tabular-nums text-center font-semibold ${svActualVal ? "text-green-700" : "text-gray-300"}`}>{svActualVal}</span>
                    )}
                  </td>

                  {/* ── Site Visit: Achievement (read-only, Actual / (New + Existing)) ── */}
                  <td className="border border-gray-200 px-1 py-0 h-6 overflow-hidden bg-green-50/40 select-none">
                    <span className={`block truncate tabular-nums text-center font-bold ${svAchievementColor}`}>{svAchievementDisplay}</span>
                  </td>

                  {/* Extra cols */}
                  {sheet.extraCols.map((ec, ci) => {
                    const isEditing = editingCell?.row === ri && editingCell?.col === ci;
                    const raw = ec.cells[ri] ?? "";
                    const shown = displayExtra(raw, ri);
                    const isFormula = raw.startsWith("=");
                    return (
                      <td
                        key={ci}
                        className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${isEditing ? "bg-white ring-1 ring-inset ring-indigo-400 z-10" : "hover:bg-indigo-50"}`}
                        onClick={() => startEdit(ri, ci)}
                      >
                        {isEditing ? (
                          <input autoFocus className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                        ) : (
                          <span className={`block truncate tabular-nums ${isFormula ? "text-indigo-700" : "text-gray-800"}`}>{shown}</span>
                        )}
                      </td>
                    );
                  })}

                  <td className="border border-gray-200 bg-gray-50" />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50">
        <span className="text-[9px] text-gray-400">
          Click to edit · <code>=A1+B1</code> for formulas · Click <strong>×{multiplier}</strong> badge to change multiplier · Right-click column to insert/delete · Drag edge to resize · Auto-saved
        </span>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border border-gray-200 shadow-lg rounded text-[11px] py-1 min-w-[150px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-gray-700 flex items-center gap-2" onClick={() => insertExtraCol(contextMenu.colIdx)}>
            <Plus size={10} className="text-indigo-500" /> Insert column before
          </button>
          <button className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-gray-700 flex items-center gap-2" onClick={() => insertExtraCol(contextMenu.colIdx + 1)}>
            <Plus size={10} className="text-indigo-500" /> Insert column after
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2" onClick={() => removeExtraCol(contextMenu.colIdx)}>
            <Trash2 size={10} /> Delete column
          </button>
        </div>
      )}
    </li>
  );
}
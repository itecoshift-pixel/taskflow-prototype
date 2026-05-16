"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

/* ================= TYPES ================= */

interface HistoryItem {
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

interface OutboundCardProps {
  history: HistoryItem[];
  loading?: boolean;
  error?: string | null;
  dateCreatedFilterRange?: { from: Date; to: Date };
}

/* ================= HELPERS ================= */

const pct = (num: number, den: number) =>
  den > 0 ? ((num / den) * 100).toFixed(2) + "%" : "0.00%";

const convBadge = (count: number) => (
  <span className="ml-1 text-green-600 text-xs font-medium">{count}</span>
);

/* ================= VALIDATION ================= */

const isFinitePositive = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

/* ================= COMPONENT ================= */

export function OutboundCallsCard({
  history,
  loading,
  error,
  dateCreatedFilterRange,
}: OutboundCardProps) {
  const [showComputation, setShowComputation] = useState(false);
  const [outboundQuota, setOutboundQuota] = useState<number>(20);
  const [quotaLoading, setQuotaLoading] = useState<boolean>(true);
  const [tableStyles, setTableStyles] = useState({
    th_bg: "#f8fafc", td_text: "#334155", th_text: "#475569",
    table_bg: "#ffffff", td_border: "#e2e8f0", th_border: "#e2e8f0",
    tr_border: "#e2e8f0", td_padding: "10", th_padding: "10",
    tr_hover_bg: "#f1f5f9", table_border: "#e2e8f0", td_font_size: "12",
    th_font_size: "11", table_border_radius: "6",
  });

  useEffect(() => {
    fetch("/api/table-styles")
      .then((res) => res.json())
      .then((data) => { if (data?.table_styles) setTableStyles(data.table_styles); })
      .catch(() => { });
  }, []);

  useEffect(() => {
    fetch("/api/outbound-quota")
      .then((res) => res.json())
      .then((data) => {
        if (isFinitePositive(data?.outbound_quota)) {
          setOutboundQuota(data.outbound_quota);
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
  }, []);

  /* ---- Step 1: Successful OB ---- */
  const successfulOBCalls = useMemo(() => {
    let base = history.filter(
      (h) =>
        h.source === "Outbound - Touchbase" &&
        h.call_status === "Successful"
    );

    if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
      const start = new Date(dateCreatedFilterRange.from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateCreatedFilterRange.to);
      end.setHours(23, 59, 59, 999);
      base = base.filter((h) => {
        const d = new Date(h.date_created);
        return d >= start && d <= end;
      });
    }

    return base;
  }, [history, dateCreatedFilterRange]);

  /* ---- Step 2: Total OB ---- */
  const totalOBCalls = useMemo(() => {
    let base = history.filter((h) => h.source === "Outbound - Touchbase");

    if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
      const start = new Date(dateCreatedFilterRange.from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateCreatedFilterRange.to);
      end.setHours(23, 59, 59, 999);
      base = base.filter((h) => {
        const d = new Date(h.date_created);
        return d >= start && d <= end;
      });
    }

    return base;
  }, [history, dateCreatedFilterRange]);

  /* ---- Step 3: Map by ref ---- */
  const historyByRefNum = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    history.forEach((h) => {
      if (!h.activity_reference_number) return;
      if (!map.has(h.activity_reference_number)) {
        map.set(h.activity_reference_number, []);
      }
      map.get(h.activity_reference_number)!.push(h);
    });
    return map;
  }, [history]);

  /* ---- Step 4: Target ---- */
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

  const obTarget = outboundQuota * daysCount;

  /* ---- Step 5: Stats ---- */
  const stats = useMemo(() => {
    const totalCalls = successfulOBCalls.length;

    const obRefNums = new Set(
      successfulOBCalls.map((c) => c.activity_reference_number).filter(Boolean)
    );

    const quoteRefNums = new Set<string>();
    const soRefNums = new Set<string>();
    const siRefNums = new Set<string>();

    obRefNums.forEach((refNum) => {
      const acts = historyByRefNum.get(refNum) ?? [];
      acts.forEach((act) => {
        if (act.status === "Quote-Done") quoteRefNums.add(refNum);
        if (act.status === "SO-Done") soRefNums.add(refNum);
        if (act.type_activity === "Delivered / Closed Transaction") siRefNums.add(refNum);
      });
    });

    const numQuotes = quoteRefNums.size;
    const numSO = soRefNums.size;
    const numSI = siRefNums.size;

    // Calculate Quote Amount (sum of quotation_amount from Quote-Done activities)
    let quoteAmount = 0;
    obRefNums.forEach((refNum) => {
      const acts = historyByRefNum.get(refNum) ?? [];
      acts.forEach((act) => {
        if (act.status === "Quote-Done" && act.quotation_amount) {
          const amount = parseFloat(act.quotation_amount);
          if (!isNaN(amount)) {
            quoteAmount += amount;
          }
        }
      });
    });

    // Calculate SO Amount (sum of so_amount from SO-Done activities)
    let soAmount = 0;
    obRefNums.forEach((refNum) => {
      const acts = historyByRefNum.get(refNum) ?? [];
      acts.forEach((act) => {
        if (act.status === "SO-Done" && act.so_amount) {
          const amount = parseFloat(act.so_amount);
          if (!isNaN(amount)) {
            soAmount += amount;
          }
        }
      });
    });

    // Calculate Actual Sales (sum of actual_sales from Delivered/Closed activities)
    let actualSales = 0;
    obRefNums.forEach((refNum) => {
      const acts = historyByRefNum.get(refNum) ?? [];
      acts.forEach((act) => {
        if (act.type_activity === "Delivered / Closed Transaction" && act.actual_sales) {
          const amount = parseFloat(act.actual_sales);
          if (!isNaN(amount)) {
            actualSales += amount;
          }
        }
      });
    });

    const achievement = obTarget > 0 ? (totalCalls / obTarget) * 100 : 0;

    const totalSales = history.reduce((sum, h) => {
      const v = parseFloat(h.actual_sales ?? "");
      return sum + (isNaN(v) ? 0 : v);
    }, 0);

    return {
      totalCalls,
      numQuotes,
      numSO,
      numSI,
      quoteAmount,
      soAmount,
      actualSales,
      achievement,
      callsToQuote: pct(numQuotes, totalCalls),
      quoteToSO: pct(numSO, numQuotes),
      soToSI: pct(numSI, numSO),
      totalSales,
    };
  }, [successfulOBCalls, historyByRefNum, obTarget, history]);

  return (
    <Card className="relative border shadow-sm z-[20]" style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
      <CardHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Outbound Calls (Touchbase)</h2>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowComputation(!showComputation)}
            className="flex items-center gap-1.5 text-xs text-blue-600"
            style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
          >
            <Info className="w-3.5 h-3.5" />
            {showComputation ? "Hide" : "Details"}
          </Button>
        </div>

        {/* Stats */}
        <div
          className="overflow-x-auto border"
          style={{
            borderColor: tableStyles.table_border,
            borderRadius: `${tableStyles.table_border_radius}px`,
            backgroundColor: tableStyles.table_bg,
          }}
        >
          <Table>
            <TableHeader>
              <TableRow
                style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.th_bg }}
              >
                {[
                  "OB Target", "Successful OB", "Achievement",
                  "Quote Based on OB Successful", "Calls → Quote", "Quote Amount",
                  "SO Based on OB Successful", "Quote → SO",
                  "SI Based on OB Successful", "SO Amount", "SO → SI", "SI Amount",
                ].map((label) => (
                  <TableHead
                    key={label}
                    className="text-center font-bold uppercase tracking-wider whitespace-nowrap"
                    style={{
                      color: tableStyles.th_text,
                      fontSize: `${tableStyles.th_font_size}px`,
                      padding: `${tableStyles.th_padding}px 12px`,
                      borderColor: tableStyles.th_border,
                      backgroundColor: tableStyles.th_bg,
                    }}
                  >
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              <TableRow
                className="font-mono"
                style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.table_bg }}
              >
                {[
                  { content: quotaLoading ? "…" : obTarget },
                  { content: stats.totalCalls, className: "font-semibold" },
                  { content: `${stats.achievement.toFixed(2)}%` },
                  { content: convBadge(stats.numQuotes) },
                  { content: stats.callsToQuote },
                  { content: `₱${stats.quoteAmount.toLocaleString()}`, className: "font-semibold text-green-600" },
                  { content: convBadge(stats.numSO) },
                  { content: stats.quoteToSO },
                  { content: convBadge(stats.numSI) },
                  { content: `₱${stats.soAmount.toLocaleString()}`, className: "font-semibold text-blue-600" },
                  { content: stats.soToSI },
                  { content: `₱${stats.actualSales.toLocaleString()}`, className: "font-semibold text-emerald-600" },
                ].map((cell, i) => (
                  <TableCell
                    key={i}
                    className={`text-center ${cell.className ?? ""}`}
                    style={{
                      color: cell.className?.includes("text-") ? undefined : tableStyles.td_text,
                      fontSize: `${tableStyles.td_font_size}px`,
                      padding: `${tableStyles.td_padding}px 12px`,
                      borderColor: tableStyles.td_border,
                    }}
                  >
                    {cell.content}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {showComputation && (
          <div className="mt-3 p-3 text-xs bg-blue-50"
            style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
            Computation details here...
          </div>
        )}
      </CardHeader>
    </Card>
  );
}

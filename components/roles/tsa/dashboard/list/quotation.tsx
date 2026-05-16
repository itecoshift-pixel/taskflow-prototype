import React, { useMemo, useState, useEffect } from "react";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Info } from "lucide-react";

/* ================= TYPES ================= */

interface HistoryItem {
  referenceid?: string;
  source?: string;
  call_status?: string;
  status?: string;
  type_activity?: string;
  actual_sales?: string;
  quotation_amount?: string;
  so_amount?: string;
  start_date?: string;
  end_date?: string;
  date_created?: string;
  activity_reference_number?: string;
  company_name?: string;
  quotation_number?: string;
  so_number?: string;
}

interface QuotationCardProps {
  activities: HistoryItem[];
  loading?: boolean;
  error?: string | null;
  dateRange?: { from?: Date; to?: Date };
}

/* ================= HELPERS ================= */

const fmt = (val: number) =>
  val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const pct = (num: number, den: number) =>
  den > 0 ? ((num / den) * 100).toFixed(2) + "%" : "0.00%";

const pctVal = (num: number, den: number) =>
  den > 0 ? (num / den) * 100 : 0;

/* ================= COMPONENT ================= */

export function QuotationCard({
  activities,
  loading,
  error,
  dateRange,
}: QuotationCardProps) {
  const [showComputation, setShowComputation] = useState(false);
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

  /* ---- Compute stats ---- */
  const stats = useMemo(() => {
    let totalQuoteDoneCount = 0;
    let totalQuotationAmount = 0;
    let totalSOPreparationCount = 0;
    let totalSOAmount = 0;
    let totalSalesInvoice = 0;

    activities.forEach((item) => {
      // Quote-Done
      if (
        item.type_activity === "Quotation Preparation" &&
        item.status === "Quote-Done"
      ) {
        totalQuoteDoneCount++;
        const val = parseFloat(item.quotation_amount ?? "0");
        if (!isNaN(val)) totalQuotationAmount += val;
      }

      // SO-Done
      if (item.status === "SO-Done") {
        totalSOPreparationCount++;
        const val = parseFloat(item.so_amount ?? "0");
        if (!isNaN(val)) totalSOAmount += val;
      }

      // Sales Invoice — Delivered
      if (item.status === "Delivered") {
        const val = parseFloat(item.actual_sales ?? "0");
        if (!isNaN(val)) totalSalesInvoice += val;
      }
    });

    return {
      totalQuoteDoneCount,
      totalQuotationAmount,
      totalSOPreparationCount,
      totalSOAmount,
      totalSalesInvoice,
      quoteToSOVal: pctVal(totalSOPreparationCount, totalQuoteDoneCount),
      quoteToSO: pct(totalSOPreparationCount, totalQuoteDoneCount),
      quotationToSIVal: pctVal(totalSalesInvoice, totalQuotationAmount),
      quotationToSI: pct(totalSalesInvoice, totalQuotationAmount),
    };
  }, [activities]);

  return (
    <Card className="border shadow-sm z-[20]" style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
      {/* Header */}
      <CardHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Quotations</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Based on{" "}
              <span className="font-medium text-gray-500">
                Quotation Preparation · Quote-Done
              </span>{" "}
              activities
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowComputation(!showComputation)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800" style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
            >
              <Info className="w-3.5 h-3.5" />
              {showComputation ? "Hide" : "Details"}
            </Button>
          </div>
        </div>

        {/* Stats Table */}
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
              <TableRow style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.th_bg }}>
                <TableHead style={{
                  color: tableStyles.th_text,
                  fontSize: `${tableStyles.th_font_size}px`,
                  padding: `${tableStyles.th_padding}px 12px`,
                  borderColor: tableStyles.th_border,
                  backgroundColor: tableStyles.th_bg,
                }} className="uppercase font-bold">
                  Total Quotations
                  <span className="block text-[9px] font-normal text-gray-400">
                    (Quote-Done)
                  </span>
                </TableHead>
                <TableHead style={{
                  color: tableStyles.th_text,
                  fontSize: `${tableStyles.th_font_size}px`,
                  padding: `${tableStyles.th_padding}px 12px`,
                  borderColor: tableStyles.th_border,
                  backgroundColor: tableStyles.th_bg,
                }} className="uppercase font-bold">
                  Quotation Amount
                </TableHead>
                <TableHead style={{
                  color: tableStyles.th_text,
                  fontSize: `${tableStyles.th_font_size}px`,
                  padding: `${tableStyles.th_padding}px 12px`,
                  borderColor: tableStyles.th_border,
                  backgroundColor: tableStyles.th_bg,
                }} className="uppercase font-bold">
                  Quote → SO
                  <span className="block text-[9px] font-normal text-gray-400">
                    (SO ÷ Quotes)
                  </span>
                </TableHead>
                <TableHead style={{
                  color: tableStyles.th_text,
                  fontSize: `${tableStyles.th_font_size}px`,
                  padding: `${tableStyles.th_padding}px 12px`,
                  borderColor: tableStyles.th_border,
                  backgroundColor: tableStyles.th_bg,
                }} className="uppercase font-bold">
                  Quotation → SI
                  <span className="block text-[9px] font-normal text-gray-400">
                    (SI ÷ Quot. Amount)
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.table_bg }}>
                {/* Total Quotations */}
                <TableCell style={{
                  color: tableStyles.td_text,
                  fontSize: `${tableStyles.td_font_size}px`,
                  padding: `${tableStyles.td_padding}px 12px`,
                  borderColor: tableStyles.td_border,
                }}>
                  {stats.totalQuoteDoneCount}
                </TableCell>

                {/* Quotation Amount */}
                <TableCell style={{
                  color: tableStyles.td_text,
                  fontSize: `${tableStyles.td_font_size}px`,
                  padding: `${tableStyles.td_padding}px 12px`,
                  borderColor: tableStyles.td_border,
                }}>
                  ₱ {fmt(stats.totalQuotationAmount)}
                </TableCell>

                {/* Quote → SO */}
                <TableCell style={{
                  color: tableStyles.td_text,
                  fontSize: `${tableStyles.td_font_size}px`,
                  padding: `${tableStyles.td_padding}px 12px`,
                }}>
                  <span
                    className={`font-semibold ${stats.quoteToSOVal >= 70
                      ? "text-green-600"
                      : stats.quoteToSOVal >= 40
                        ? "text-amber-500"
                        : "text-red-500"
                      }`}
                  >
                    {stats.quoteToSO}
                  </span>
                  <span className="ml-1 text-green-600 text-[10px] font-medium">
                    ({stats.totalSOPreparationCount})
                  </span>
                </TableCell>

                {/* Quotation → SI */}
                <TableCell style={{
                  color: tableStyles.td_text,
                  fontSize: `${tableStyles.td_font_size}px`,
                  padding: `${tableStyles.td_padding}px 12px`,
                }}>
                  <span
                    className={`font-semibold ${stats.quotationToSIVal >= 70
                      ? "text-green-600"
                      : stats.quotationToSIVal >= 40
                        ? "text-amber-500"
                        : "text-red-500"
                      }`}
                  >
                    {stats.quotationToSI}
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Computation Details */}
        {showComputation && (
          <div className="mt-3 p-4 border border-blue-100 bg-blue-50 text-xs text-blue-900 space-y-1.5" style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
            <p className="font-semibold text-blue-800 mb-1">Computation Details</p>
            <p>
              <strong>Total Quotations:</strong> Count of activities where{" "}
              <code>type_activity = "Quotation Preparation"</code> AND{" "}
              <code>status = "Quote-Done"</code>.
            </p>
            <p>
              <strong>Quotation Amount:</strong> Sum of <code>quotation_amount</code>{" "}
              from all Quote-Done activities.
            </p>
            <p>
              <strong>Quote → SO %:</strong> (Count of{" "}
              <code>status = "SO-Done"</code> ÷ Total Quotations) × 100%
            </p>
            <p>
              <strong>Total SO Amount:</strong> Sum of <code>so_amount</code> from{" "}
              SO-Done activities.
            </p>
            <p>
              <strong>Total Sales Invoice:</strong> Sum of <code>actual_sales</code>{" "}
              where <code>status = "Delivered"</code>.
            </p>
            <p>
              <strong>Quotation → SI %:</strong> (Total Sales Invoice ÷ Total
              Quotation Amount) × 100%
            </p>
          </div>
        )}
      </CardHeader>
    </Card>
  );
}
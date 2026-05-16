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
import { type DateRange } from "react-day-picker";

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
  so_number?: string;
}

interface SOCardProps {
  activities: HistoryItem[];
  loading?: boolean;
  error?: string | null;
  dateRange?: DateRange;
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

export function SOCard({
  activities,
  loading,
  error,
  dateRange,
}: SOCardProps) {
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
    let totalSODoneCount = 0;
    let totalSOAmount = 0;
    let totalDeliveredCount = 0;
    let totalSalesInvoice = 0;

    activities.forEach((item) => {
      // SO-Done
      if (item.status === "SO-Done") {
        totalSODoneCount++;
        const val = parseFloat(item.so_amount ?? "0");
        if (!isNaN(val)) totalSOAmount += val;
      }

      // Delivered / Closed Transaction
      if (item.type_activity === "Delivered / Closed Transaction") {
        totalDeliveredCount++;
        const val = parseFloat(item.actual_sales ?? "0");
        if (!isNaN(val)) totalSalesInvoice += val;
      }
    });

    const soToSIVal = pctVal(totalDeliveredCount, totalSODoneCount);
    const soToSI = pct(totalDeliveredCount, totalSODoneCount);

    return {
      totalSODoneCount,
      totalSOAmount,
      totalDeliveredCount,
      totalSalesInvoice,
      soToSIVal,
      soToSI,
    };
  }, [activities]);

  return (
    <Card className="border shadow-sm z-[20]" style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
      {/* Header */}
      <CardHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Sales Order Summary</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Based on{" "}
              <span className="font-medium text-gray-500">SO-Done</span> and{" "}
              <span className="font-medium text-gray-500">
                Delivered / Closed Transaction
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
                  Total SO Done
                </TableHead>
                <TableHead style={{
                  color: tableStyles.th_text,
                  fontSize: `${tableStyles.th_font_size}px`,
                  padding: `${tableStyles.th_padding}px 12px`,
                  borderColor: tableStyles.th_border,
                  backgroundColor: tableStyles.th_bg,
                }} className="uppercase font-bold">
                  Total SO Amount
                </TableHead>
                <TableHead style={{
                  color: tableStyles.th_text,
                  fontSize: `${tableStyles.th_font_size}px`,
                  padding: `${tableStyles.th_padding}px 12px`,
                  borderColor: tableStyles.th_border,
                  backgroundColor: tableStyles.th_bg,
                }} className="uppercase font-bold">
                  Total Sales Invoice
                </TableHead>
                <TableHead style={{
                  color: tableStyles.th_text,
                  fontSize: `${tableStyles.th_font_size}px`,
                  padding: `${tableStyles.th_padding}px 12px`,
                  borderColor: tableStyles.th_border,
                  backgroundColor: tableStyles.th_bg,
                }} className="uppercase font-bold">
                  SO → SI
                  <span className="block text-[9px] font-normal text-gray-400">
                    (Delivered ÷ SO-Done)
                  </span>
                </TableHead>
                <TableHead style={{
                  color: tableStyles.th_text,
                  fontSize: `${tableStyles.th_font_size}px`,
                  padding: `${tableStyles.th_padding}px 12px`,
                  borderColor: tableStyles.th_border,
                  backgroundColor: tableStyles.th_bg,
                }} className="uppercase font-bold">
                  Total Delivered
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.table_bg }}>
                {/* Total SO Done */}
                <TableCell style={{
                  color: tableStyles.td_text,
                  fontSize: `${tableStyles.td_font_size}px`,
                  padding: `${tableStyles.td_padding}px 12px`,
                  borderColor: tableStyles.td_border,
                }}>
                  {stats.totalSODoneCount}
                </TableCell>

                {/* Total SO Amount */}
                <TableCell style={{
                  color: tableStyles.td_text,
                  fontSize: `${tableStyles.td_font_size}px`,
                  padding: `${tableStyles.td_padding}px 12px`,
                  borderColor: tableStyles.td_border,
                }}>
                  ₱ {fmt(stats.totalSOAmount)}
                </TableCell>

                {/* Total Sales Invoice */}
                <TableCell style={{
                  color: tableStyles.td_text,
                  fontSize: `${tableStyles.td_font_size}px`,
                  padding: `${tableStyles.td_padding}px 12px`,
                  borderColor: tableStyles.td_border,
                }}>
                  ₱ {fmt(stats.totalSalesInvoice)}
                </TableCell>

                {/* SO → SI */}
                <TableCell style={{
                  color: tableStyles.td_text,
                  fontSize: `${tableStyles.td_font_size}px`,
                  padding: `${tableStyles.td_padding}px 12px`,
                  borderColor: tableStyles.td_border,
                }}>
                  <span
                    className={`font-semibold ${stats.soToSIVal >= 70
                      ? "text-green-600"
                      : stats.soToSIVal >= 40
                        ? "text-amber-500"
                        : "text-red-500"
                      }`}
                  >
                    {stats.soToSI}
                  </span>
                  <span className="ml-1 text-green-600 text-[10px] font-medium">
                    ({stats.totalDeliveredCount})
                  </span>
                </TableCell>

                {/* Total Delivered */}
                <TableCell style={{
                  color: tableStyles.td_text,
                  fontSize: `${tableStyles.td_font_size}px`,
                  padding: `${tableStyles.td_padding}px 12px`,
                  borderColor: tableStyles.td_border,
                }}>
                  {stats.totalDeliveredCount}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Computation Details */}
        {showComputation && (
          <div className="mt-3 p-4 rounded-xl border border-blue-100 bg-blue-50 text-xs text-blue-900 space-y-1.5" style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
            <p className="font-semibold text-blue-800 mb-1">Computation Details</p>
            <p>
              <strong>Total SO Done:</strong> Count of activities where{" "}
              <code>status = "SO-Done"</code>.
            </p>
            <p>
              <strong>Total SO Amount:</strong> Sum of <code>so_amount</code> from
              SO-Done activities.
            </p>
            <p>
              <strong>Total Delivered:</strong> Count of activities where{" "}
              <code>type_activity = "Delivered / Closed Transaction"</code>.
            </p>
            <p>
              <strong>Total Sales Invoice:</strong> Sum of <code>actual_sales</code>{" "}
              from Delivered / Closed Transaction activities.
            </p>
            <p>
              <strong>SO → SI %:</strong> (Total Delivered ÷ Total SO-Done) × 100%{" "}
              — <em>count-based, not amount-based.</em>
            </p>
          </div>
        )}
      </CardHeader>
    </Card>
  );
}
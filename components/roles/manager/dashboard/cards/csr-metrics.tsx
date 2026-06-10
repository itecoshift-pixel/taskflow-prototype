"use client";

import { Loader2 } from "lucide-react";

interface CsrMetricsProps {
  avgResponseTime: number;
  avgNonQuotationHT: number;
  avgQuotationHT: number;
  avgSpfHT: number;
  loading: boolean;
}

function formatHoursToHMS(hours: number): string {
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 border border-gray-100">
    <span className="text-[10px] text-gray-500 uppercase font-medium">{label}</span>
    <span className="text-[11px] font-bold text-gray-800">{value}</span>
  </div>
);

export function CsrMetrics({
  avgResponseTime,
  avgNonQuotationHT,
  avgQuotationHT,
  avgSpfHT,
  loading,
}: CsrMetricsProps) {
  return (
    <li className="bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-700">
          CSR Metrics — Handling Times
        </span>
      </div>
      <div className="p-3">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 py-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-[10px]">Loading metrics...</span>
          </div>
        ) : (
          <div className="space-y-1">
            <StatRow label="TSA Response Time"    value={formatHoursToHMS(avgResponseTime)}     />
            <StatRow label="Non-Quotation HT"     value={formatHoursToHMS(avgNonQuotationHT)}   />
            <StatRow label="Quotation HT"         value={formatHoursToHMS(avgQuotationHT)}      />
            <StatRow label="SPF Handling Duration" value={formatHoursToHMS(avgSpfHT)}           />
          </div>
        )}
      </div>
    </li>
  );
}

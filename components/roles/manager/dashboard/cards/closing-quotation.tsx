"use client";

interface ClosingQuotationProps {
  pendingClientApprovalCount: number;
  orderCompleteCount: number;
  convertToSOCount: number;
  declinedCount: number;
  cancelledCount: number;
}

export function ClosingQuotation({
  pendingClientApprovalCount,
  orderCompleteCount,
  convertToSOCount,
  declinedCount,
  cancelledCount,
}: ClosingQuotationProps) {
  const rows = [
    { label: "Pending Client Approval", value: pendingClientApprovalCount },
    { label: "Order Complete",          value: orderCompleteCount },
    { label: "Convert to SO",           value: convertToSOCount },
    { label: "Declined",                value: declinedCount },
    { label: "Cancelled",               value: cancelledCount },
  ];

  return (
    <li className="bg-white border border-l-4 border-l-red-500 border-gray-200 shadow-sm overflow-hidden">
      <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-700">
          Closing of Quotation
        </span>
      </div>
      <div className="p-3">
        <div className="space-y-1">
          {rows.map(({ label, value }) => (
            <div
              key={label}
              className="flex justify-between items-center px-2 py-1.5 border-b border-gray-50 last:border-b-0"
            >
              <span className="text-[10px] text-red-500 font-medium">{label}</span>
              <span className={`text-[11px] font-black ${value > 0 ? "text-red-600" : "text-gray-400"}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </li>
  );
}

"use client";

interface TotalSalesProps {
  totalSales: number;
}

export function TotalSales({ totalSales }: TotalSalesProps) {
  return (
    <li className="bg-gray-900 border border-gray-800 shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-700">
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Total Sales</span>
      </div>
      <div className="px-3 py-3 flex items-baseline gap-1">
        <span className="text-gray-400 text-sm font-medium">₱</span>
        <span className="text-white text-2xl font-black tracking-tight tabular-nums">
          {totalSales.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
    </li>
  );
}

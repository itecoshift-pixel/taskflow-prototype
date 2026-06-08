"use client";

interface OutboundPerformanceProps {
  outboundDaily: number;
}

export function OutboundPerformance({ outboundDaily }: OutboundPerformanceProps) {
  return (
    <li className="bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-700">
          Outbound Performance
        </span>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500 uppercase font-medium">Daily Count</span>
          <span className="text-[20px] font-black text-gray-800">{outboundDaily}</span>
        </div>
        <p className="text-[8px] text-gray-400 uppercase font-medium mt-2 tracking-wide">
          Source: Outbound - Touchbase
        </p>
      </div>
    </li>
  );
}

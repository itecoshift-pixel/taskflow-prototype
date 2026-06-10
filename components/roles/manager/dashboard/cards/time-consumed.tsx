"use client";

import { Loader2 } from "lucide-react";

interface TimeConsumedProps {
  timeByActivity: Record<string, number>;
  timeConsumedMs: number;
  loading: boolean;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
}

export function TimeConsumed({ timeByActivity, timeConsumedMs, loading }: TimeConsumedProps) {
  return (
    <li className="bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-700">Time Consumed</span>
        <span className="text-[10px] font-bold text-gray-600">{formatDuration(timeConsumedMs)}</span>
      </div>
      <div className="p-3">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 py-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-[10px]">Computing...</span>
          </div>
        ) : Object.keys(timeByActivity).length === 0 ? (
          <p className="text-[10px] text-gray-300 italic">No activities logged in selected range</p>
        ) : (
          <div className="space-y-1">
            {Object.entries(timeByActivity).map(([type, ms]) => (
              <div
                key={type}
                className="flex justify-between items-center px-2 py-1 bg-gray-50 border border-gray-100"
              >
                <span className="text-[10px] text-gray-500 uppercase font-medium truncate mr-2">{type}</span>
                <span className="text-[10px] font-bold text-gray-800 shrink-0">{formatDuration(ms)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

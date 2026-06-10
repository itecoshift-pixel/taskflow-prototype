"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface OverdueActivitiesProps {
  overdueByCompany: Record<string, number>;
  overdueCount: number;
  loading: boolean;
}

export function OverdueActivities({
  overdueByCompany,
  overdueCount,
  loading,
}: OverdueActivitiesProps) {
  const [showAll, setShowAll] = useState(false);
  const entries = Object.entries(overdueByCompany).sort((a, b) => b[1] - a[1]);
  const visible = showAll ? entries : entries.slice(0, 5);

  return (
    <li className="bg-white border border-l-4 border-l-red-400 border-gray-200 shadow-sm overflow-hidden">
      <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-700">
          Overdue Activities{overdueCount > 0 ? ` · ${overdueCount}` : ""}
        </span>
        {entries.length > 5 && (
          <button
            onClick={() => setShowAll((p) => !p)}
            className="text-[9px] text-blue-600 font-semibold hover:underline"
          >
            {showAll ? "Less" : "More"}
          </button>
        )}
      </div>
      <div className="p-3">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 py-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-[10px]">Loading...</span>
          </div>
        ) : entries.length === 0 ? (
          <p className="text-[10px] text-gray-300 italic">No overdue activities</p>
        ) : (
          <div className={`space-y-1 ${showAll ? "max-h-40 overflow-y-auto pr-1" : ""}`}>
            {visible.map(([company, count]) => (
              <div
                key={company}
                className="flex justify-between items-center px-2 py-1 bg-red-50 border border-red-100"
              >
                <span className="text-[10px] text-gray-600 truncate mr-2">{company}</span>
                <strong className="text-[10px] text-red-600 shrink-0">{count}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

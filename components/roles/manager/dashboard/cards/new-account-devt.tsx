"use client";

import { useState } from "react";

interface NewAccountDevtProps {
  newClientByCompany: Record<string, number>;
  newClientCount: number;
}

export function NewAccountDevt({ newClientByCompany, newClientCount }: NewAccountDevtProps) {
  const [showAll, setShowAll] = useState(false);
  const entries = Object.entries(newClientByCompany).sort((a, b) => b[1] - a[1]);
  const visible = showAll ? entries : entries.slice(0, 5);

  return (
    <li className="bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-700">
          New Account Devt{newClientCount > 0 ? ` · ${newClientCount}` : ""}
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
        {entries.length === 0 ? (
          <p className="text-[10px] text-gray-300 italic">No new clients in selected range</p>
        ) : (
          <div className={`space-y-1 ${showAll ? "max-h-40 overflow-y-auto pr-1" : ""}`}>
            {visible.map(([company, count]) => (
              <div
                key={company}
                className="flex justify-between items-center px-2 py-1 bg-blue-50 border border-blue-100"
              >
                <span className="text-[10px] text-gray-600 truncate mr-2">{company}</span>
                <strong className="text-[10px] text-blue-600 shrink-0">{count}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

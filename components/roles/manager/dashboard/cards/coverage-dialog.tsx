"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Activity {
  account_reference_number: string;
  company_name?: string;
  type_client?: string;
}

interface CoverageDialogProps {
  source: "covered" | "uncovered" | null;
  onClose: () => void;
  coveredAccounts: Activity[];
  uncoveredAccounts: Activity[];
  onToggle: (v: "covered" | "uncovered") => void;
}

const typeLabel = (normalized: string): string => {
  const map: Record<string, string> = {
    top50: "Top 50", next30: "Next 30", balance20: "Balance 20",
    csrclient: "CSR Client", newclient: "New Client", tsaclient: "TSA Client",
  };
  return map[normalized] ?? normalized;
};

const typeColors: Record<string, string> = {
  top50:     "bg-amber-100 text-amber-700 border-amber-200",
  next30:    "bg-blue-100 text-blue-700 border-blue-200",
  balance20: "bg-violet-100 text-violet-700 border-violet-200",
  newclient: "bg-emerald-100 text-emerald-700 border-emerald-200",
  tsaclient: "bg-rose-100 text-rose-700 border-rose-200",
  csrclient: "bg-slate-100 text-slate-600 border-slate-200",
};
const pillColor = (t: string) =>
  typeColors[t] ?? "bg-indigo-50 text-indigo-600 border-indigo-200";

export function CoverageDialog({
  source,
  onClose,
  coveredAccounts,
  uncoveredAccounts,
  onToggle,
}: CoverageDialogProps) {
  const isCovered   = source === "covered";
  const isUncovered = source === "uncovered";
  const dialogOpen  = isCovered || isUncovered;
  const list        = isCovered ? coveredAccounts : uncoveredAccounts;

  return (
    <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[11px] font-black uppercase tracking-wider text-gray-700">
              {isCovered ? "Covered Accounts" : "Not Reached Accounts"}
              <span className="ml-2 text-gray-400 font-normal">{list.length}</span>
            </DialogTitle>
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => onToggle("covered")}
                className={`px-2.5 py-1 text-[9px] font-bold uppercase transition-colors ${
                  isCovered
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                Covered · {coveredAccounts.length}
              </button>
              <button
                onClick={() => onToggle("uncovered")}
                className={`px-2.5 py-1 text-[9px] font-bold uppercase transition-colors ${
                  isUncovered
                    ? "bg-amber-500 text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                Not Reached · {uncoveredAccounts.length}
              </button>
            </div>
          </div>
        </DialogHeader>

        {list.length === 0 ? (
          <p className="text-[11px] text-gray-300 italic px-4 py-6 text-center">
            {isCovered
              ? "No accounts reached in selected range."
              : "All accounts have been reached in selected range."}
          </p>
        ) : (
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-[10px] border-collapse">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr>
                  <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-gray-500 border-b border-gray-200 w-[55%]">
                    Company
                  </th>
                  <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-gray-500 border-b border-gray-200 w-[45%]">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((acc, i) => (
                  <tr
                    key={`${acc.account_reference_number}-${i}`}
                    className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-3 py-2 text-gray-700 font-medium border-b border-gray-100">
                      <span className="block" title={acc.company_name || "—"}>
                        {acc.company_name || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-b border-gray-100">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${pillColor(acc.type_client ?? "")}`}
                      >
                        {typeLabel(acc.type_client ?? "—")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

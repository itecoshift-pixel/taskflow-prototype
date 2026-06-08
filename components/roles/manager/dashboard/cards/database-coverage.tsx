"use client";

interface Denominators {
  total: number;
  top50: number;
  next30: number;
  bal20: number;
  csrClient: number;
  newClient: number;
  tsaClient: number;
}

interface ClientSegments {
  top50: number;
  next30: number;
  balance20: number;
  csrClient: number;
  newClient: number;
  tsaClient: number;
}

interface DatabaseCoverageProps {
  coveredCount: number;
  uncoveredCount: number;
  denominators: Denominators;
  clientSegments: ClientSegments;
  onOpenDialog: (source: "covered" | "uncovered") => void;
}

export function DatabaseCoverage({
  coveredCount,
  uncoveredCount,
  denominators,
  clientSegments,
  onOpenDialog,
}: DatabaseCoverageProps) {
  const total = denominators.total;
  const coveredPct   = total ? Math.round((coveredCount   / total) * 100) : 0;
  const uncoveredPct = total ? Math.round((uncoveredCount / total) * 100) : 0;

  const segments = [
    { label: "Top 50", covered: clientSegments.top50,      total: denominators.top50 },
    { label: "Next 30", covered: clientSegments.next30,    total: denominators.next30 },
    { label: "Bal 20",  covered: clientSegments.balance20, total: denominators.bal20 },
    { label: "CSR",     covered: clientSegments.csrClient, total: denominators.csrClient },
    { label: "New",     covered: clientSegments.newClient, total: denominators.newClient },
    { label: "TSA",     covered: clientSegments.tsaClient, total: denominators.tsaClient },
  ];

  return (
    <li className="bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-700">
          Database Coverage
        </span>
      </div>
      <div className="p-3">
        <div className="space-y-2">
          {/* Progress bar */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-[14px] font-black text-blue-700">{coveredCount}</span>
            <span className="text-[10px] text-gray-400">of {total} accounts</span>
          </div>
          <div className="h-1.5 bg-gray-100 w-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-500"
              style={{ width: total ? `${Math.min(100, (coveredCount / total) * 100)}%` : "0%" }}
            />
          </div>

          {/* Covered / Not reached */}
          <div className="grid grid-cols-2 gap-2 py-2 border-y border-gray-100">
            <button
              onClick={() => onOpenDialog("covered")}
              className="text-center hover:bg-emerald-50 transition-colors rounded py-1"
            >
              <p className="text-[9px] text-gray-400 uppercase mb-1">With Activity</p>
              <p className="text-[16px] font-black text-emerald-600">{coveredCount}</p>
              <p className="text-[9px] text-gray-400">{coveredPct}% of total</p>
            </button>
            <button
              onClick={() => onOpenDialog("uncovered")}
              className="text-center border-l border-gray-100 hover:bg-amber-50 transition-colors rounded py-1"
            >
              <p className="text-[9px] text-gray-400 uppercase mb-1">No Activity</p>
              <p className="text-[16px] font-black text-amber-600">{uncoveredCount}</p>
              <p className="text-[9px] text-gray-400">{uncoveredPct}% of total</p>
            </button>
          </div>

          {/* Segment breakdown */}
          <div className="grid grid-cols-3 gap-1 mt-2">
            {segments.map(({ label, covered, total: segTotal }) => (
              <button
                key={label}
                onClick={() => onOpenDialog("covered")}
                className="bg-gray-50 px-2 py-1 text-center border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer group"
              >
                <p className="text-[8px] text-gray-400 uppercase group-hover:text-blue-600">{label}</p>
                <p className="text-[10px] font-black text-gray-700 group-hover:text-blue-700">
                  {covered}
                  <span className="text-gray-400 font-normal group-hover:text-blue-400">/{segTotal}</span>
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </li>
  );
}

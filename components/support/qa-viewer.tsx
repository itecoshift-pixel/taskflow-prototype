"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, HeadphonesIcon } from "lucide-react";
import type { KnowledgeEntry } from "./knowledge-base";

interface QAViewerProps {
  subject:   string;
  entry:     KnowledgeEntry;
  onHelpful: () => void;             // user says it resolved their issue
  onNeedAssistance: () => void;      // user still needs help → proceed to ticket
}

export function QAViewer({ subject, entry, onHelpful, onNeedAssistance }: QAViewerProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="w-full max-w-lg space-y-3">
      {/* Subject label */}
      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
        {subject.replace(/^\[[^\]]+\]\s*/, "")}
      </p>

      {/* Summary */}
      <p className="text-[12px] text-slate-700 leading-relaxed">{entry.summary}</p>

      {/* Steps */}
      {entry.steps && entry.steps.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
            Steps to try
          </p>
          {entry.steps.map((step, i) => (
            <div key={i} className="flex gap-2.5 items-start">
              <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[9px] font-black flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <p className="text-[11px] text-slate-600 leading-snug">{step}</p>
            </div>
          ))}
        </div>
      )}

      {/* Q&A accordion */}
      {entry.qa.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            Common Questions
          </p>
          {entry.qa.map((item, i) => (
            <div key={i} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="text-[11px] font-semibold text-slate-700 leading-snug pr-2">
                  {item.question}
                </span>
                {openIdx === i
                  ? <ChevronUp size={13} className="text-indigo-500 shrink-0" />
                  : <ChevronDown size={13} className="text-slate-400 shrink-0" />}
              </button>
              {openIdx === i && (
                <div className="px-3 pb-3 pt-1 text-[11px] text-slate-600 leading-relaxed border-t border-slate-100">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="pt-2 border-t border-slate-200 space-y-2">
        <p className="text-[10px] text-slate-500 text-center">Did this help resolve your issue?</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onHelpful}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wide transition-colors"
          >
            <CheckCircle2 size={13} />
            Yes, Helpful
          </button>
          <button
            onClick={onNeedAssistance}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-wide transition-colors"
          >
            <HeadphonesIcon size={13} />
            Need Assistance
          </button>
        </div>
      </div>
    </div>
  );
}

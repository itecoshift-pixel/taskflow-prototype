"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
import { sileo } from "sileo";

// ── Simple Markdown renderer (no external dep) ────────────────────────────────

function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1 text-[12px] leading-relaxed text-gray-800">
      {lines.map((line, i) => {
        // H2
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="text-sm font-black text-gray-900 mt-4 mb-1 border-b border-gray-200 pb-1">
              {line.slice(3)}
            </h2>
          );
        }
        // H3
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="text-[11px] font-black uppercase tracking-wider text-indigo-600 mt-3 mb-1">
              {line.slice(4)}
            </h3>
          );
        }
        // HR
        if (line.trim() === "---") {
          return <hr key={i} className="border-gray-200 my-3" />;
        }
        // Numbered list
        if (/^\d+\.\s/.test(line)) {
          const content = line.replace(/^\d+\.\s/, "");
          return (
            <p key={i} className="flex gap-2 ml-2">
              <span className="text-indigo-500 font-bold shrink-0">{line.match(/^\d+/)?.[0]}.</span>
              <span dangerouslySetInnerHTML={{ __html: renderInline(content) }} />
            </p>
          );
        }
        // Bullet
        if (line.startsWith("- ") || line.startsWith("  - ")) {
          const indent = line.startsWith("  - ");
          const content = line.replace(/^\s*-\s/, "");
          return (
            <p key={i} className={`flex gap-2 ${indent ? "ml-6" : "ml-2"}`}>
              <span className="text-gray-400 shrink-0 mt-0.5">{indent ? "◦" : "•"}</span>
              <span dangerouslySetInnerHTML={{ __html: renderInline(content) }} />
            </p>
          );
        }
        // Empty line
        if (!line.trim()) return <div key={i} className="h-1" />;
        // Normal paragraph
        return (
          <p key={i} dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
        );
      })}
    </div>
  );
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-[11px] font-mono">$1</code>');
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AIInsightsMetrics {
  tab: string;
  fromDate: string;
  toDate: string;
  viewingName?: string;
  totalAccounts: number;
  coveredAccounts: number;
  uncoveredAccounts: number;
  seg: {
    top50: number; next30: number; balance20: number;
    csrClient: number; newClient: number; tsaClient: number;
  };
  denom: {
    top50: number; next30: number; bal20: number;
    csrClient: number; newClient: number; tsaClient: number;
  };
  totalSales: number;
  outboundDaily: number;
  newClientCount: number;
  pendingClientApproval: number;
  orderComplete: number;
  convertToSO: number;
  declined: number;
  cancelled: number;
  avgResponseTime: string;
  avgNonQuotationHT: string;
  avgQuotationHT: string;
  avgSpfHT: string;
  overdueCount: number;
  overdueByCompany: Record<string, number>;
  newClientByCompany: Record<string, number>;
}

interface Props {
  metrics: AIInsightsMetrics;
  disabled?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AIInsightsButton({ metrics, disabled }: Props) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport]   = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);

  const generate = async () => {
    setLoading(true);
    setReport(null);
    setOpen(true);

    try {
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to generate report");
      }

      const data = await res.json();
      setReport(data.report);
    } catch (err: any) {
      sileo.error({
        title: "AI Error",
        description: err.message ?? "Failed to generate insights.",
        duration: 5000,
        position: "top-right",
      });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const copyReport = () => {
    if (!report) return;
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <Button
        onClick={generate}
        disabled={disabled || loading}
        className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] uppercase font-black tracking-wider rounded-none px-3"
      >
        {loading ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <Sparkles size={11} />
        )}
        AI Insights
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!loading) setOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
          {/* Header */}
          <DialogHeader className="px-5 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-indigo-500" />
                <DialogTitle className="text-sm font-black text-gray-900">
                  AI Insights Report
                </DialogTitle>
                {metrics.viewingName && (
                  <span className="text-[10px] text-gray-400 font-normal">
                    — {metrics.viewingName}
                  </span>
                )}
              </div>
              {report && (
                <button
                  onClick={copyReport}
                  className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1 transition-colors"
                >
                  {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {metrics.fromDate} → {metrics.toDate} · {metrics.tab.toUpperCase()} view
            </p>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
                <Loader2 size={24} className="animate-spin text-indigo-400" />
                <p className="text-xs font-medium">Generating insights with Groq AI...</p>
                <p className="text-[10px] text-gray-300">This usually takes 3–8 seconds</p>
              </div>
            ) : report ? (
              <MarkdownBlock text={report} />
            ) : null}
          </div>

          {/* Footer */}
          {report && (
            <div className="px-5 py-3 border-t border-gray-100 shrink-0 flex items-center justify-between">
              <p className="text-[10px] text-gray-400">
                Powered by Groq · llama-3.3-70b-versatile
              </p>
              <button
                onClick={generate}
                disabled={loading}
                className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                <Sparkles size={10} />
                Regenerate
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

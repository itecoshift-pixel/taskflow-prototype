"use client";

import React, { useEffect, useState, useCallback } from "react";
import { CheckCircle2, X, Building2, Star } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApprovedAccount {
  id: string;
  company_name: string;
  type_client: string;
  status: string;
  it_approved_date: string;
  account_reference_number: string;
}

// ─── Storage key ─────────────────────────────────────────────────────────────
// Key includes today's date so dismissal resets each new day
function getDismissKey(referenceid: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `tsa_approved_dismissed_${referenceid}_${today}`;
}

// ─── Cluster color ────────────────────────────────────────────────────────────
const CLUSTER_COLOR: Record<string, string> = {
  "top 50":     "#f59e0b",
  "next 30":    "#3b82f6",
  "balance 20": "#8b5cf6",
  "new client": "#10b981",
  "tsa client": "#ef4444",
  "csr client": "#f97316",
};

function clusterColor(type: string) {
  return CLUSTER_COLOR[type?.toLowerCase()] ?? "#6b7280";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewlyApprovedDialog({ referenceid }: { referenceid: string }) {
  const [accounts, setAccounts] = useState<ApprovedAccount[]>([]);
  const [visible, setVisible]   = useState(false);

  const fetch = useCallback(async () => {
    if (!referenceid) return;

    // Already dismissed today — skip fetch
    if (localStorage.getItem(getDismissKey(referenceid)) === "1") return;

    try {
      const res = await window.fetch(
        `/api/tsa-newly-approved-accounts?referenceid=${encodeURIComponent(referenceid)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.data?.length > 0) {
        setAccounts(data.data);
        setVisible(true);
      }
    } catch {
      // silently fail — this is a non-critical notification
    }
  }, [referenceid]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  function dismiss() {
    localStorage.setItem(getDismissKey(referenceid), "1");
    setVisible(false);
  }

  if (!visible || accounts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-800">
              {accounts.length === 1
                ? "1 account approved today!"
                : `${accounts.length} accounts approved today!`}
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              The following accounts are now <strong>Active</strong>.
            </p>
          </div>
          <button
            onClick={dismiss}
            className="p-1 rounded-lg hover:bg-emerald-100 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-emerald-600" />
          </button>
        </div>

        {/* Account list */}
        <div className="px-6 py-4 max-h-72 overflow-y-auto space-y-2">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: clusterColor(acc.type_client) + "20" }}
              >
                <Building2
                  className="w-4 h-4"
                  style={{ color: clusterColor(acc.type_client) }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800 uppercase truncate">
                  {acc.company_name}
                </p>
                {acc.account_reference_number && (
                  <p className="text-[10px] text-gray-400 font-mono tracking-wide">
                    {acc.account_reference_number}
                  </p>
                )}
              </div>
              <span
                className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0"
                style={{
                  backgroundColor: clusterColor(acc.type_client) + "20",
                  color: clusterColor(acc.type_client),
                }}
              >
                {acc.type_client}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2">
          <button
            onClick={dismiss}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest transition-colors"
          >
            Got it
          </button>
        </div>

      </div>
    </div>
  );
}

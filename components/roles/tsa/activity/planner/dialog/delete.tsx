"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { getTableStyles, DEFAULT_TABLE_STYLES, type TableStyles } from "@/lib/table-styles";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AccountsActiveDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  removeRemarks: string;
  setRemoveRemarks: (value: string) => void;
  onConfirmRemove: () => Promise<void>;
  selectedCount?: number;
  // kept in props signature for backward compat but no longer used
  historicalData?: unknown[];
  loadingHistoricalData?: boolean;
}

const HOLD_DURATION_MS = 2000;
const INTERVAL_MS = 20;
const INCREMENT = (INTERVAL_MS / HOLD_DURATION_MS) * 100;

// ─── Component ────────────────────────────────────────────────────────────────
export function AccountsActiveDeleteDialog({
  open,
  onOpenChange,
  removeRemarks,
  setRemoveRemarks,
  onConfirmRemove,
  selectedCount,
}: AccountsActiveDeleteDialogProps) {
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tableStyles, setTableStyles] = useState<TableStyles>(DEFAULT_TABLE_STYLES);

  useEffect(() => {
    getTableStyles().then(setTableStyles).catch(() => { });
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(0);
      setLoading(false);
      setConfirmed(false);
    }
  }, [open]);

  const handleConfirm = useCallback(async () => {
    if (confirmed || loading) return;
    setConfirmed(true);
    setLoading(true);
    try {
      await onConfirmRemove();
    } catch (err) {
      console.error("Error removing accounts:", err);
      setLoading(false);
      setConfirmed(false);
      setProgress(0);
      return;
    }
    setTimeout(() => {
      setLoading(false);
      setProgress(0);
      setConfirmed(false);
      setRemoveRemarks("");
      onOpenChange(false);
    }, 300);
  }, [confirmed, loading, onConfirmRemove, onOpenChange, setRemoveRemarks]);

  const startHold = () => {
    if (loading || confirmed || !removeRemarks.trim()) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProgress(0);
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + INCREMENT;
        if (next >= 100) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setTimeout(() => handleConfirm(), 0);
          return 100;
        }
        return next;
      });
    }, INTERVAL_MS);
  };

  const cancelHold = () => {
    if (loading || confirmed) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress(0);
  };

  const handleClose = () => {
    if (loading) return;
    cancelHold();
    setRemoveRemarks("");
    onOpenChange(false);
  };

  const canDelete = removeRemarks.trim().length > 0 && !loading && !confirmed;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="p-0 overflow-hidden !w-[95vw] !max-w-[480px] gap-0 border-0 shadow-2xl"
        style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="relative bg-zinc-950 px-6 pt-6 pb-5 overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 20px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 20px)",
            }}
          />
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-red-700/20 rounded-full blur-3xl pointer-events-none" />

          <DialogHeader className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-8 h-8 bg-red-600/20 border border-red-600/30"
                style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
                <Trash2 className="h-4 w-4 text-red-400" />
              </div>
              <DialogTitle className="text-white text-sm font-black uppercase tracking-[0.15em]">
                Remove Accounts
              </DialogTitle>
            </div>
            <DialogDescription className="text-zinc-400 text-xs leading-relaxed">
              This action will mark the selected accounts for removal pending TSM approval.
              Provide a clear reason before proceeding.
            </DialogDescription>
          </DialogHeader>

          {selectedCount !== undefined && selectedCount > 0 && (
            <div className="relative z-10 mt-4 inline-flex items-center gap-2 bg-red-950/60 border border-red-800/50 px-3 py-2"
              style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
              <span className="text-[11px] font-semibold text-red-300">
                {selectedCount} {selectedCount === 1 ? "account" : "accounts"} selected for removal
              </span>
            </div>
          )}
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="bg-white px-6 py-5 flex flex-col gap-5">
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 block mb-2">
              Reason / Remarks <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full border border-zinc-200 p-3 text-xs bg-zinc-50 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono leading-relaxed"
              style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
              rows={5}
              value={removeRemarks}
              onChange={(e) => setRemoveRemarks(e.target.value)}
              placeholder="e.g. Account no longer active, duplicate entry, customer request..."
              disabled={loading}
            />
            <p
              className={`text-[10px] mt-1.5 ${removeRemarks.trim().length === 0 ? "text-red-400" : "text-zinc-400"
                }`}
            >
              {removeRemarks.trim().length === 0
                ? "⚠ Remarks required before deletion"
                : `${removeRemarks.trim().length} characters entered`}
            </p>
          </div>

          {/* Hold-to-confirm */}
          <div className="space-y-2">
            <p className="text-[10px] text-zinc-400 text-center tracking-wide">
              {canDelete
                ? "Hold the button to confirm removal"
                : loading
                  ? "Processing..."
                  : "Enter remarks to enable deletion"}
            </p>

            <button
              type="button"
              className={`relative w-full h-12 overflow-hidden text-[11px] font-black uppercase tracking-[0.15em] select-none transition-colors focus:outline-none ${canDelete
                ? "bg-red-600 text-white cursor-pointer hover:bg-red-700"
                : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                }`}
              style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={startHold}
              onTouchEnd={cancelHold}
              disabled={!canDelete}
            >
              <div
                className="absolute inset-y-0 left-0 bg-red-900/50 pointer-events-none"
                style={{ width: `${progress}%`, transition: "none" }}
              />
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Removing...</>
                ) : progress > 0 ? (
                  <><Trash2 className="h-3.5 w-3.5" /> Deleting... {Math.round(progress)}%</>
                ) : (
                  <><Trash2 className="h-3.5 w-3.5" /> Hold to Delete</>
                )}
              </span>
            </button>

            <Button
              variant="outline"
              className="w-full text-xs h-9 border-zinc-200 text-zinc-500 hover:text-zinc-800"
              style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}

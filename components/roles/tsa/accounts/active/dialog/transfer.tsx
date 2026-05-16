"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Users, UserCheck, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture?: string | null;
}

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[]; // FIX: was typed as any[]
  selectedAccountIds: string[];
  onConfirmTransfer: (agentRefId: string, accountIds: string[]) => void;
  loading?: boolean; // FIX: added — original had no loading state for confirm action
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TransferDialog({
  open,
  onOpenChange,
  agents,
  selectedAccountIds,
  onConfirmTransfer,
  loading = false,
}: TransferDialogProps) {
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [search, setSearch] = useState("");

  const [tableStyles, setTableStyles] = useState({
    table_bg: "#ffffff",
    table_border: "#111111",
    table_border_radius: "0",
    tr_border: "#d1d5db",
    tr_hover_bg: "#f3f4f6",
    th_bg: "#1f1f1f",
    th_text: "#ffffff",
    th_border: "#111111",
    th_padding: "14",
    th_font_size: "11",
    td_text: "#111827",
    td_border: "#e5e7eb",
    td_padding: "14",
    td_font_size: "12",
    tfoot_bg: "#1f1f1f",
    tfoot_text: "#ffffff",
    tfoot_border: "#111111",
    tfoot_padding: "12",
    tfoot_font_size: "12",
    pagination_bg: "#1f1f1f",
    pagination_text: "#d1d5db",
    pagination_radius: "8",
    pagination_border: "#d1d5db",
    toolbar_bg: "#1f1f1f",
    toolbar_border: "#111111",
    toolbar_btn_bg: "rgba(255,255,255,0.08)",
    toolbar_btn_text: "#ffffff",
    toolbar_input_bg: "rgba(255,255,255,0.08)",
    toolbar_btn_border: "#3f3f3f",
    toolbar_input_text: "#ffffff",
    toolbar_input_border: "#3f3f3f",
  });

  useEffect(() => {
    fetch("/api/table-styles")
      .then((res) => res.json())
      .then((data) => { if (data?.table_styles) setTableStyles(data.table_styles); })
      .catch(() => { });
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedAgent("");
      setSearch("");
    }
  }, [open]);

  // FIX: filter agents by search term
  const filteredAgents = React.useMemo(() => {
    if (!search.trim()) return agents;
    const term = search.toLowerCase();
    return agents.filter(
      (a) =>
        a.Firstname.toLowerCase().includes(term) ||
        a.Lastname.toLowerCase().includes(term) ||
        a.ReferenceID.toLowerCase().includes(term),
    );
  }, [agents, search]);

  const selectedAgentData = agents.find((a) => a.ReferenceID === selectedAgent) ?? null;

  const handleConfirm = () => {
    if (selectedAgent && selectedAccountIds.length > 0) {
      onConfirmTransfer(selectedAgent, selectedAccountIds);
    }
  };

  const handleClose = () => {
    if (!loading) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="p-0 overflow-hidden !w-[95vw] !max-w-[480px] gap-0 border-0 shadow-2xl"
        style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="bg-zinc-900 px-6 pt-6 pb-5">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-white/10 p-1.5"
                style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
                <ArrowLeftRight className="h-4 w-4 text-white" />
              </div>
              <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">
                Transfer Accounts
              </DialogTitle>
            </div>
            <DialogDescription className="text-zinc-400 text-xs leading-relaxed">
              Reassign the selected accounts to another agent. This action takes
              effect immediately upon confirmation.
            </DialogDescription>
          </DialogHeader>

          {/* Selected accounts count badge */}
          {selectedAccountIds.length > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1.5"
              style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
              <Users className="h-3 w-3 text-zinc-300" />
              <span className="text-[11px] font-semibold text-zinc-200">
                {selectedAccountIds.length}{" "}
                {selectedAccountIds.length === 1 ? "account" : "accounts"} selected
              </span>
            </div>
          )}
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-4">

          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
            Select Agent
          </p>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-3 pr-3 py-2 text-xs border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-all"
              style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
            />
          </div>

          {/* Agent list */}
          <div className="border border-zinc-200 rounded-none overflow-hidden">
            <div className="max-h-52 overflow-y-auto custom-scrollbar">
              {agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-1">
                  <span className="text-xs text-zinc-400">No agents available.</span>
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-1">
                  <span className="text-xs text-zinc-400">No agents match your search.</span>
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="text-xs text-zinc-500 underline hover:text-zinc-800"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {filteredAgents.map((agent, idx) => {
                    const isSelected = selectedAgent === agent.ReferenceID;
                    const initials =
                      agent.Firstname.charAt(0).toUpperCase() +
                      agent.Lastname.charAt(0).toUpperCase();

                    return (
                      <li
                        key={`${agent.ReferenceID}-${idx}`}
                        onClick={() => setSelectedAgent(agent.ReferenceID)}
                        className={`
                          flex items-center justify-between px-4 py-3
                          cursor-pointer text-xs transition-colors select-none
                          ${isSelected
                            ? "bg-zinc-900 text-white"
                            : "hover:bg-zinc-50 text-zinc-700"
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          {agent.profilePicture ? (
                            <img
                              src={agent.profilePicture}
                              alt={`${agent.Firstname} ${agent.Lastname}`}
                              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                              onError={(e) => {
                                // FIX: fallback to initials if image fails to load
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div
                              className={`
                                w-7 h-7 rounded-full flex items-center justify-center
                                text-[10px] font-bold flex-shrink-0
                                ${isSelected
                                  ? "bg-white/20 text-white"
                                  : "bg-zinc-100 text-zinc-600"
                                }
                              `}
                            >
                              {initials}
                            </div>
                          )}

                          <div>
                            <p className="font-semibold capitalize">
                              {agent.Lastname}, {agent.Firstname}
                            </p>
                            <p
                              className={`text-[10px] font-mono ${isSelected ? "text-zinc-300" : "text-zinc-400"
                                }`}
                            >
                              {agent.ReferenceID}
                            </p>
                          </div>
                        </div>

                        {isSelected && (
                          <UserCheck className="h-4 w-4 text-white flex-shrink-0" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Selected agent confirmation strip */}
          {selectedAgentData && (
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-2"
              style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
              <UserCheck className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
              <p className="text-xs text-zinc-600">
                Transferring to{" "}
                <strong className="text-zinc-900 capitalize">
                  {selectedAgentData.Firstname} {selectedAgentData.Lastname}
                </strong>
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <DialogFooter className="px-6 py-4 border-t border-zinc-100 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 text-xs h-10"
            style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 text-xs h-10 bg-zinc-900 hover:bg-zinc-800"
            style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
            onClick={handleConfirm}
            disabled={!selectedAgent || selectedAccountIds.length === 0 || loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />
                Confirm Transfer
              </>
            )}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
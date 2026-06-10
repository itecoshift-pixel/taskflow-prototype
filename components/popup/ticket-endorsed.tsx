"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { Ticket, UserCheck, X, CheckCheck } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EndorsedTicket {
  id: string;
  company_name: string;
  date_created: string;
  agent: string;
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
  });

const toLocalDateStr = (dateStr: string) =>
  new Date(dateStr).toISOString().split("T")[0];

const DISMISSED_KEY  = "dismissedEndorsedTickets";
const SOUND_KEY      = "ticketSoundPlayedFor";

// ─── Component ────────────────────────────────────────────────────────────────

export function TicketEndorsed() {
  const searchParams = useSearchParams();
  const { userId, user, setUserId } = useUser();

  const [referenceid,   setReferenceid]   = useState("");
  const [tickets,       setTickets]       = useState<EndorsedTicket[]>([]);
  const [agents,        setAgents]        = useState<Agent[]>([]);
  const [open,          setOpen]          = useState(false);
  const [confirmOpen,   setConfirmOpen]   = useState(false);
  const [soundPlayed,   setSoundPlayed]   = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queryUserId = searchParams?.get("id") ?? "";

  // ── Sync userId from URL ───────────────────────────────────────────────────
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  // ── Update referenceid from user context ───────────────────────────────────
  useEffect(() => {
    if (user) {
      setReferenceid(user.ReferenceID || "");
    } else {
      setReferenceid("");
    }
  }, [user]);

  // ── Fetch agents ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/fetch-agent")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setAgents(data || []))
      .catch(() => setAgents([]));
  }, []);

  // ── Fetch endorsed tickets ─────────────────────────────────────────────────
  const fetchEndorsedTickets = useCallback(async () => {
    if (!referenceid) return;

    try {
      const res = await fetch(
        `/api/act-fetch-endorsed-ticket?referenceid=${encodeURIComponent(referenceid)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;

      const json     = await res.json();
      const all: EndorsedTicket[] = json.activities || [];
      const today    = new Date().toISOString().split("T")[0];
      let dismissed: string[] = [];
      try {
        dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
      } catch {
        localStorage.removeItem(DISMISSED_KEY);
      }

      const fresh = all.filter(
        (t) => !dismissed.includes(t.id) && toLocalDateStr(t.date_created) === today
      );

      if (fresh.length > 0) {
        setTickets(fresh);
        setOpen(true);
      } else {
        setTickets([]);
        setOpen(false);
      }
    } catch {
      // silently fail — no error UI needed for a notification popup
    }
  }, [referenceid]);

  // ── Initial fetch + realtime ───────────────────────────────────────────────
  useEffect(() => {
    if (!referenceid) return;

    fetchEndorsedTickets();

    const channel = supabase
      .channel(`endorsed-ticket-${referenceid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "endorsed-ticket", filter: `referenceid=eq.${referenceid}` },
        () => fetchEndorsedTickets()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [referenceid, fetchEndorsedTickets]);

  // ── Play notification sound ────────────────────────────────────────────────
  useEffect(() => {
    if (!open || tickets.length === 0 || soundPlayed) return;

    const currentIds = tickets.map((t) => t.id).sort().join(",");
    if (localStorage.getItem(SOUND_KEY) === currentIds) return;

    if (!audioRef.current) audioRef.current = new Audio("/ticket-endorsed.mp3");
    audioRef.current.play().catch(() => {/* autoplay blocked — ignore */});
    localStorage.setItem(SOUND_KEY, currentIds);
    setSoundPlayed(true);
  }, [open, tickets, soundPlayed]);

  // ── Dismiss handlers ───────────────────────────────────────────────────────
  const handleDismiss = () => setConfirmOpen(true);

  const confirmDismiss = () => {
    let prev: string[] = [];
    try {
      prev = JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
    } catch {
      localStorage.removeItem(DISMISSED_KEY);
    }
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...prev, ...tickets.map((t) => t.id)]));
    localStorage.removeItem(SOUND_KEY);
    setSoundPlayed(false);
    setConfirmOpen(false);
    setOpen(false);
  };

  const agentName = (refId: string) => {
    const a = agents.find((ag) => ag.ReferenceID === refId);
    return a ? `${a.Firstname} ${a.Lastname}` : "Unknown Agent";
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Main notification dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 shrink-0">
                <Ticket size={15} className="text-indigo-500" />
              </span>
              New Endorsed Ticket{tickets.length > 1 ? "s" : ""} from Ecodesk
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              {tickets.length} {tickets.length === 1 ? "ticket has" : "tickets have"} been endorsed to your account today.
            </DialogDescription>
          </DialogHeader>

          {/* Ticket list */}
          <div className="max-h-[320px] overflow-y-auto space-y-2 mt-1 pr-0.5">
            {tickets.map((t, i) => (
              <div
                key={t.id || i}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {t.company_name || "No company name"}
                  </p>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                    {fmtDate(t.date_created)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <UserCheck size={11} className="text-indigo-400 shrink-0" />
                  <span>Sent by: <span className="font-semibold text-slate-700 capitalize">{agentName(t.agent)}</span></span>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="mt-2">
            <Button
              size="sm"
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 rounded-xl"
              onClick={handleDismiss}
            >
              <CheckCheck size={13} /> Acknowledge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dismiss confirmation dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={(v) => setConfirmOpen(v)}>
        <DialogContent className="max-w-sm w-full">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 border border-amber-100 shrink-0">
                <X size={14} className="text-amber-500" />
              </span>
              Confirm Dismiss
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Once dismissed, this alert won't appear again until new tickets are endorsed to your account.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex-1"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs flex-1 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
              onClick={confirmDismiss}
            >
              <CheckCheck size={12} /> Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
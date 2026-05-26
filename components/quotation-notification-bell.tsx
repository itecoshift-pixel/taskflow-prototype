"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { ClipboardList } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUser } from "@/contexts/UserContext";

interface QuotationNotification {
  id: number;
  quotation_number?: string;
  company_name?: string;
  activity_reference_number?: string;
  date_created?: string;
  type_activity?: string;
  tsm_approved_status?: string;
}

export function QuotationNotificationBell() {
  const { userId } = useUser();
  const [notifications, setNotifications] = useState<QuotationNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const prevIdsRef = useRef<Set<number>>(new Set());
  const isFirstLoad = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasUserInteracted = useRef(false);

  const READ_KEY = `quotation_notif_read_${userId}`;

  // Track user interaction for audio autoplay
  useEffect(() => {
    const markInteracted = () => {
      hasUserInteracted.current = true;
    };
    window.addEventListener("click", markInteracted, { once: true });
    window.addEventListener("keydown", markInteracted, { once: true });
    return () => {
      window.removeEventListener("click", markInteracted);
      window.removeEventListener("keydown", markInteracted);
    };
  }, []);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio("/quotation-req.mp3");
    audioRef.current.volume = 0.6;
    audioRef.current.load();
  }, []);

  const playSound = useCallback(() => {
    if (!hasUserInteracted.current) return;
    try {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch((err) => {
          if (err.name !== "NotAllowedError") {
            console.error("Failed to play notification sound:", err);
          }
        });
      }
    } catch (err) {
      console.error("Error in playSound:", err);
    }
  }, []);

  // Load read IDs from localStorage
  useEffect(() => {
    if (!userId) return;
    try {
      const saved = localStorage.getItem(READ_KEY);
      if (saved) setReadIds(new Set(JSON.parse(saved)));
    } catch {
      localStorage.removeItem(READ_KEY);
    }
  }, [userId, READ_KEY]);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Fetch user details to get referenceid
      const userRes = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
      if (!userRes.ok) throw new Error("Failed to fetch user data");
      const userData = await userRes.json();
      const referenceid = userData.ReferenceID || "";

      if (!referenceid) {
        setNotifications([]);
        return;
      }

      // Fetch pending quotations
      const res = await fetch(
        `/api/activity/tsm/quotation/fetch?referenceid=${encodeURIComponent(referenceid)}`
      );
      if (!res.ok) throw new Error("Failed to fetch quotations");
      const data = await res.json();

      const pending = (data.activities || []).filter(
        (a: QuotationNotification) =>
          a.type_activity === "Quotation Preparation" &&
          a.tsm_approved_status === "Pending"
      );

      // Sort by date (newest first)
      pending.sort(
        (a: QuotationNotification, b: QuotationNotification) =>
          new Date(b.date_created || 0).getTime() -
          new Date(a.date_created || 0).getTime()
      );

      // Check for new notifications
      const newIds = new Set<number>(pending.map((n: QuotationNotification) => n.id));
      if (!isFirstLoad.current) {
        const hasNew = [...newIds].some((id) => !prevIdsRef.current.has(id));
        if (hasNew && pending.length > 0) {
          playSound();
        }
      }
      prevIdsRef.current = newIds;
      isFirstLoad.current = false;

      setNotifications(pending);
    } catch (err) {
      console.error("Failed to fetch quotation notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, playSound]);

  // Fetch on mount and periodically
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && notifications.length > 0) {
      // Mark all as read when opened
      const allIds = new Set(notifications.map((n) => n.id));
      setReadIds(allIds);
      try {
        localStorage.setItem(READ_KEY, JSON.stringify(Array.from(allIds)));
      } catch {}
    }
  };

  const handleNotificationClick = (notif: QuotationNotification) => {
    setOpen(false);
    // Store the quotation ID to highlight it on the pending page
    localStorage.setItem("highlightQuotationId", notif.id.toString());
    // Navigate to pending page
    window.location.href = `/roles/tsm/activity/quotation/pending`;
  };

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-PH", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Quotation Notifications"
        >
          <ClipboardList className="h-5 w-5" />
          {notifications.length > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {notifications.length > 99 ? "99+" : notifications.length}
            </Badge>
          )}
          {unreadCount > 0 && notifications.length === 0 && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">
            Pending Quotation Approvals
          </h4>
          <Badge variant="secondary" className="text-xs">
            {notifications.length} pending
          </Badge>
        </div>
        <ScrollArea className="h-64">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No pending quotations
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => {
                const isUnread = !readIds.has(notif.id);
                return (
                  <div
                    key={notif.id}
                    className={`p-3 hover:bg-muted transition-colors cursor-pointer ${
                      isUnread ? "bg-muted/40" : "bg-background"
                    }`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {notif.company_name || "Unknown Company"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Quotation: {notif.quotation_number || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Ref: {notif.activity_reference_number || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(notif.date_created)}
                        </p>
                      </div>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            className="w-full justify-between text-xs"
            size="sm"
            onClick={() => {
              setOpen(false);
              window.location.href = `/roles/tsm/activity/quotation/pending`;
            }}
          >
            View all pending quotations
            <span className="text-xs">→</span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

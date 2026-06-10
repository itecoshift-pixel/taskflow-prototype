"use client";

import React, { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, Timestamp, where, } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";
import { Bell, LogOut, Clock, CalendarClock } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Meeting {
  id: string;
  title: string;
  start_date: Timestamp | Date | string | number;
  remarks: string;
}

type DismissedByDate = Record<string, string[]>;
type DismissedLogoutByDate = Record<string, boolean>;
type SnoozeLogoutByDate = Record<string, string>; // ISO string of snooze time

interface UserDetails {
  referenceid: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MEETINGS_KEY = "dismissedMeetings";
const LOGOUT_KEY = "dismissedLogoutReminders";
const SNOOZE_KEY = "snoozedLogoutReminders";
const THIRTY_MINUTES = 30 * 60 * 1000;
const FIVE_MINUTES = 5 * 60 * 1000;
const SNOOZE_DURATION = 15 * 60 * 1000; // 15 minutes

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(date: Date): string {
  let h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDate(v: any): Date {
  if (v?.toDate) return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v);
}

const todayKey = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const val = localStorage.getItem(key);
    if (!val) return fallback;
    return JSON.parse(val) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: unknown) {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

/** Returns minutes until meeting starts (negative = already started) */
function minutesUntil(date: Date, now: Date): number {
  return Math.round((date.getTime() - now.getTime()) / 60000);
}

/** Check if snooze has expired (15 minutes passed) */
function isSnoozeExpired(snoozeTimeISO: string | undefined): boolean {
  if (!snoozeTimeISO) return true;
  const snoozeTime = new Date(snoozeTimeISO).getTime();
  const now = Date.now();
  return now - snoozeTime >= SNOOZE_DURATION;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function Reminders() {
  const searchParams = useSearchParams();
  const { userId, user, setUserId } = useUser();

  const [loadingUser, setLoadingUser] = useState(false);
  const [referenceId, setReferenceId] = useState<string>("");
  const [now, setNow] = useState(new Date());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [showMeeting, setShowMeeting] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [dismissedMeetings, setDismissedMeetings] = useState<string[]>([]);
  const [dismissedLogout, setDismissedLogout] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevMeeting = useRef(false);

  const queryUserId = searchParams?.get("id");

  // ── Sync URL param with userId context ──────────────────────────────────────
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  // ── Get referenceId from centralized user context ───────────────────────────
  useEffect(() => {
    if (user) {
      setReferenceId(user.ReferenceID || "");
    } else {
      setReferenceId("");
    }
  }, [user]);

  // ── Initialize audio + localStorage ────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    audioRef.current = new Audio("/reminder-notification.mp3");

    const meetingsLS = readLS<DismissedByDate>(MEETINGS_KEY, {});
    const logoutLS = readLS<DismissedLogoutByDate>(LOGOUT_KEY, {});
    const snoozeLS = readLS<SnoozeLogoutByDate>(SNOOZE_KEY, {});
    setDismissedMeetings(meetingsLS[todayKey()] || []);
    setDismissedLogout(!!logoutLS[todayKey()]);
    setSnoozeUntil(snoozeLS[todayKey()] || null);

    // FCM setup
    (async () => {
      try {
        const messaging = await import("@/firebase/firebase-messaging");
        const token = await messaging.requestFirebaseNotificationPermission?.();
        if (token) console.log("FCM Token:", token);

        const unsub = messaging.onMessageListener?.((payload: any) => {
          if (
            "Notification" in window &&
            Notification.permission === "granted" &&
            payload?.notification
          ) {
            new Notification(payload.notification.title || "Reminder", {
              body: payload.notification.body || "",
            });
          }
          audioRef.current?.play().catch(() => { });
        });
        return () => typeof unsub === "function" && unsub();
      } catch {
        console.warn("FCM not supported");
      }
    })();
  }, []);

  // ── Subscribe to meetings ───────────────────────────────────────────────────
  useEffect(() => {
    if (!referenceId) return;
    const q = query(
      collection(db, "meetings"),
      where("referenceid", "==", referenceId),
    );
    const unsub = onSnapshot(q, (snap) => {
      setMeetings(
        snap.docs.map((d) => ({
          id: d.id,
          title: d.data().type_activity,
          remarks: d.data().remarks,
          start_date: d.data().start_date,
        })),
      );
    });
    return unsub;
  }, [referenceId]);

  // ── Clock tick ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  // ── Evaluate reminders ──────────────────────────────────────────────────────
  useEffect(() => {
    const meeting = meetings.find((m) => {
      if (dismissedMeetings.includes(m.id)) return false;
      const d = toDate(m.start_date);
      const diff = d.getTime() - now.getTime();
      return isSameDay(now, d) && diff <= THIRTY_MINUTES && diff >= -FIVE_MINUTES;
    });

    setCurrentMeeting(meeting ?? null);
    setShowMeeting(!!meeting);

    // ── Logout Reminder (4:30 PM → bago ang 5:00 PM, isang beses lang sa bawat araw) ──
    const hours = now.getHours();
    const minutes = now.getMinutes();

    const isAfter430 =
      hours > 16 || (hours === 16 && minutes >= 30);

    const isBefore5 =
      hours < 17;

    // Double-check sa localStorage para siguradong dismissed na ito (para sa multi-tab)
    const logoutLS = readLS<DismissedLogoutByDate>(LOGOUT_KEY, {});
    const snoozeLS = readLS<SnoozeLogoutByDate>(SNOOZE_KEY, {});
    const isActuallyDismissed = !!logoutLS[todayKey()];
    const snoozeTime = snoozeLS[todayKey()];
    const isSnoozeActive = snoozeTime && !isSnoozeExpired(snoozeTime);

    if (isAfter430 && isBefore5 && !isActuallyDismissed && !isSnoozeActive && !showLogout) {
      setShowLogout(true);
    }
  }, [now, meetings, dismissedMeetings, dismissedLogout, showLogout]);

  // ── Play audio on new meeting ────────────────────────────────────────────────
  useEffect(() => {
    if (showMeeting && !prevMeeting.current && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => { });
    }
    prevMeeting.current = showMeeting;
  }, [showMeeting]);

  // ── Dismiss handlers ────────────────────────────────────────────────────────
  function dismissMeeting() {
    if (!currentMeeting) return;
    const data = readLS<DismissedByDate>(MEETINGS_KEY, {});
    data[todayKey()] = [...(data[todayKey()] || []), currentMeeting.id];
    writeLS(MEETINGS_KEY, data);
    setDismissedMeetings(data[todayKey()]);
    setShowMeeting(false);
  }

  function dismissLogout() {
    const data = readLS<DismissedLogoutByDate>(LOGOUT_KEY, {});
    data[todayKey()] = true;
    writeLS(LOGOUT_KEY, data);
    setDismissedLogout(true);
    setShowLogout(false);
  }

  function snoozeLogout() {
    const snoozeTime = new Date().toISOString();
    const snoozeData = readLS<SnoozeLogoutByDate>(SNOOZE_KEY, {});
    snoozeData[todayKey()] = snoozeTime;
    writeLS(SNOOZE_KEY, snoozeData);
    setSnoozeUntil(snoozeTime);
    setShowLogout(false);
    
    // Auto-show again after 15 minutes
    setTimeout(() => {
      const logoutLS = readLS<DismissedLogoutByDate>(LOGOUT_KEY, {});
      if (!logoutLS[todayKey()]) {
        setShowLogout(true);
      }
    }, SNOOZE_DURATION);
  }

  // FIX: removed loading/error full-page returns — reminders are background,
  // they should never block the page render
  if (loadingUser || !referenceId) return null;

  const meetingDate = currentMeeting ? toDate(currentMeeting.start_date) : null;
  const minsUntil = meetingDate ? minutesUntil(meetingDate, now) : 0;

  return (
    <>
      {/* ── Meeting Reminder Dialog ──────────────────────────────────────── */}
      <Dialog open={showMeeting} onOpenChange={setShowMeeting}>
        <DialogContent className="rounded-none p-0 overflow-hidden max-w-sm gap-0">

          {/* Header */}
          <div className="bg-zinc-900 px-6 pt-5 pb-4">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-white/10 rounded-full p-1.5">
                  <Bell className="h-4 w-4 text-yellow-300 animate-bounce" />
                </div>
                <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">
                  Meeting Reminder
                </DialogTitle>
              </div>
              <DialogDescription className="text-zinc-400 text-xs">
                {minsUntil > 0
                  ? `Starting in ${minsUntil} minute${minsUntil !== 1 ? "s" : ""}`
                  : "This meeting has already started"}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="bg-zinc-100 rounded-full p-2 flex-shrink-0 mt-0.5">
                <CalendarClock className="h-4 w-4 text-zinc-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-900 uppercase">
                  {currentMeeting?.title}
                </p>
                {meetingDate && (
                  <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {formatTime(meetingDate)}
                  </p>
                )}
              </div>
            </div>

            {currentMeeting?.remarks && (
              <div className="bg-zinc-50 border border-zinc-200 px-4 py-3">
                <p className="text-xs text-zinc-600 uppercase leading-relaxed">
                  {currentMeeting.remarks}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t border-zinc-100">
            <Button
              className="rounded-none w-full text-xs h-10 bg-zinc-900 hover:bg-zinc-800"
              onClick={dismissMeeting}
            >
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Logout Reminder Dialog ───────────────────────────────────────── */}
      <Dialog open={showLogout} onOpenChange={(o) => { if (!o) dismissLogout(); setShowLogout(o); }}>
        <DialogContent className="rounded-none p-0 overflow-hidden max-w-sm gap-0">

          {/* Header */}
          <div className="bg-zinc-900 px-6 pt-5 pb-4">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-white/10 rounded-full p-1.5">
                  <LogOut className="h-4 w-4 text-blue-300" />
                </div>
                <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">
                  Logout Reminder
                </DialogTitle>
              </div>
              <DialogDescription className="text-zinc-400 text-xs">
                Understood, will sign off before leaving.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 px-4 py-3">
              <LogOut className="h-4 w-4 text-zinc-500 flex-shrink-0" />
              <p className="text-xs text-zinc-600">
                Understood, will sign off before leaving.
              </p>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t border-zinc-100 flex gap-2">
            <Button
              variant="outline"
              className="rounded-none flex-1 text-xs h-10"
              onClick={snoozeLogout}
            >
              Snooze (15m)
            </Button>
            <Button
              className="rounded-none flex-1 text-xs h-10 bg-zinc-900 hover:bg-zinc-800"
              onClick={dismissLogout}
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
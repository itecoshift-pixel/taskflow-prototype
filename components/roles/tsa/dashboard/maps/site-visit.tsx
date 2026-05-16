"use client";
import React, { useEffect, useState } from "react";
import { type DateRange } from "react-day-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, LogIn, LogOut, Building2 } from "lucide-react";
import dynamic from "next/dynamic";

const SiteVisitMap = dynamic(() => import("./site-visit-map"), { ssr: false });

interface SiteVisit {
  Type?: string;
  Status?: string;
  date_created?: string;
  Location?: string;
  Latitude?: number | string;
  Longitude?: number | string;
  PhotoURL?: string;
  SiteVisitAccount?: string;
}

interface SiteVisitCardProps {
  referenceid: string;
  dateRange?: DateRange;
}

// Convert ISO date string to PH local date string (YYYY-MM-DD)
function toLocalDateString(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function SiteVisitCard({ referenceid, dateRange }: SiteVisitCardProps) {
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!referenceid) return;
    const fetchSiteVisits = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/fetch-tasklog?referenceid=${encodeURIComponent(referenceid)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch site visits");
        const data = await res.json();
        setSiteVisits(data.siteVisits || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSiteVisits();
  }, [referenceid]);

  // Filter by date range if provided
  // MongoDB dates are ISO strings with UTC offset (e.g. 2026-03-17T02:48:29.951+00:00)
  // dateRange.from/to are local midnight — extend `to` to end of day so the full day is included
  const filteredVisits = siteVisits.filter((visit) => {
    if (!dateRange || !dateRange.from || !dateRange.to) return true;
    if (!visit.date_created) return false;

    // Convert visit date to PH local date string for comparison
    const visitDateStr = new Date(visit.date_created).toLocaleDateString("en-CA", {
      timeZone: "Asia/Manila",
    });

    const fromStr = toLocalDateString(dateRange.from);
    const toStr = toLocalDateString(dateRange.to);

    return visitDateStr >= fromStr && visitDateStr <= toStr;
  });

  // Today's visits only (Login or Logout status)
  const todayStr = toLocalDateString(new Date());
  const todayVisits = filteredVisits.filter((visit) => {
    if (!visit.date_created) return false;
    const visitDateStr = toLocalDateString(new Date(visit.date_created));
    const isToday = visitDateStr === todayStr;
    const isLoginOrLogout =
      visit.Status === "Login" || visit.Status === "Logout";
    return isToday && isLoginOrLogout;
  });

  const loginCount = todayVisits.filter((v) => v.Status === "Login").length;
  const logoutCount = todayVisits.filter((v) => v.Status === "Logout").length;

  // Map center
  const defaultCenter: [number, number] = [14.5995, 120.9842];
  const mapCenter: [number, number] =
    filteredVisits.length > 0 &&
      filteredVisits[0].Latitude != null &&
      filteredVisits[0].Longitude != null
      ? [Number(filteredVisits[0].Latitude), Number(filteredVisits[0].Longitude)]
      : defaultCenter;

  return (
    <Card className="bg-white text-black rounded-none">
      <CardHeader>
        <CardTitle>Site Visits</CardTitle>
        <CardDescription>
          Site visit locations and today's visit summary
        </CardDescription>
      </CardHeader>

      <CardContent>
        {loading && (
          <p className="text-sm text-gray-500">Loading site visits...</p>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {!loading && !error && filteredVisits.length === 0 && (
          <p className="text-sm text-gray-500">No site visits found.</p>
        )}

        {!loading && !error && filteredVisits.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ── LEFT: Map ─────────────────────────────────────────── */}
            <div className="h-[420px] w-full rounded-none overflow-hidden border">
              <SiteVisitMap visits={filteredVisits} center={mapCenter} />
            </div>

            {/* ── RIGHT: Visit List ──────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              {/* Today's count summary */}
              <div className="border rounded-none p-3 bg-gray-50">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Today's Visits — {todayStr}
                </p>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5 text-sm">
                    <LogIn size={14} className="text-green-600" />
                    <span className="font-semibold">{loginCount}</span>
                    <span className="text-muted-foreground text-xs">Login</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <LogOut size={14} className="text-red-500" />
                    <span className="font-semibold">{logoutCount}</span>
                    <span className="text-muted-foreground text-xs">Logout</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm ml-auto">
                    <MapPin size={14} className="text-blue-500" />
                    <span className="font-semibold">{todayVisits.length}</span>
                    <span className="text-muted-foreground text-xs">Total</span>
                  </div>
                </div>
              </div>

              {/* Scrollable visit list */}
              <div className="overflow-auto max-h-[340px] flex flex-col gap-2 pr-1 custom-scrollbar">
                {todayVisits.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1">
                    No visits recorded today.
                  </p>
                ) : (
                  todayVisits.map((visit, idx) => (
                    <div
                      key={idx}
                      className="border rounded-none p-2.5 text-xs flex flex-col gap-1 bg-white shadow-sm"
                    >
                      {/* Account name */}
                      <div className="flex items-center gap-1.5 font-semibold text-sm">
                        <Building2 size={13} className="text-gray-500 shrink-0" />
                        <span className="truncate">
                          {visit.SiteVisitAccount || "—"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        {/* Status badge */}
                        <Badge
                          className={`rounded-sm text-[10px] font-mono px-2 py-0.5 border-none ${visit.Status === "Login"
                              ? "bg-green-600 text-white"
                              : "bg-red-500 text-white"
                            }`}
                        >
                          {visit.Status === "Login" ? (
                            <LogIn size={10} className="mr-1" />
                          ) : (
                            <LogOut size={10} className="mr-1" />
                          )}
                          {visit.Status}
                        </Badge>

                        {/* Time */}
                        <span className="text-muted-foreground">
                          {visit.date_created
                            ? new Date(visit.date_created).toLocaleTimeString(
                              "en-PH",
                              { hour: "2-digit", minute: "2-digit" },
                            )
                            : "—"}
                        </span>
                      </div>

                      {/* Location */}
                      {visit.Location && (
                        <div className="flex items-start gap-1 text-muted-foreground">
                          <MapPin size={10} className="mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{visit.Location}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
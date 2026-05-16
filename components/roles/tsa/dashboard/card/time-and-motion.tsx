"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { type DateRange } from "react-day-picker";
import { ListTree } from "lucide-react";

interface Activity { start_date?: string; end_date?: string; type_activity?: string; duration?: number }

interface Props {
  activities: Activity[];
  loading: boolean;
  error: string | null;
  referenceid: string;
  dateRange?: DateRange;
}

export function TimemotionCard({ activities, loading, error }: Props) {
  const [open, setOpen] = useState(false);

  const [tableStyles, setTableStyles] = useState({
    table_border_radius: "16",
  });

  useEffect(() => {
    fetch("/api/table-styles")
      .then((res) => res.json())
      .then((data) => {
        if (data?.table_styles) setTableStyles(data.table_styles);
      })
      .catch(() => { }); // silently fall back to defaults
  }, []);

  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}h ${m}m ${s}s`;
  };

  // ---------- Total Durations ----------
  const totalMs = activities.reduce((acc, entry) => {
    if (entry.start_date && entry.end_date) {
      const start = new Date(entry.start_date).getTime();
      const end = new Date(entry.end_date).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) return acc + (end - start);
    } else if (entry.duration) return acc + entry.duration * 1000;
    return acc;
  }, 0);

  const grandSeconds = Math.floor(totalMs / 1000);
  const grandHours = Math.floor(grandSeconds / 3600);
  const grandMinutes = Math.floor((grandSeconds % 3600) / 60);
  const remainingSeconds = grandSeconds % 60;

  const MAX_HOURS = 6.5;
  const totalHoursDecimal = grandHours + grandMinutes / 60 + remainingSeconds / 3600;
  const progressPercent = Math.min((totalHoursDecimal / MAX_HOURS) * 100, 100);

  // ---------- Duration per activity type ----------
  const durationPerType = activities.reduce((acc, entry) => {
    if (entry.start_date && entry.end_date && entry.type_activity) {
      const start = new Date(entry.start_date).getTime();
      const end = new Date(entry.end_date).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) acc[entry.type_activity] = (acc[entry.type_activity] || 0) + (end - start);
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card className="bg-white z-10 text-black flex flex-col justify-between"
      style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
      <CardHeader>
        <CardTitle>Total Work Time</CardTitle>
        <CardDescription>Working Hours</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col justify-center items-center p-6 space-y-3">
        {loading ? (
          <div className="flex justify-center items-center w-full min-h-[100px]"><Spinner /></div>
        ) : error ? (
          <div className="text-red-500 text-center w-full">{error}</div>
        ) : (
          <div className="flex flex-col justify-center items-center space-y-2">
            <div className="relative rounded-full w-32 h-32 flex items-center justify-center border-4 border-green-700"
              style={{ background: `conic-gradient(#15803d ${progressPercent * 3.6}deg, #d1d5db 0deg)` }}>
              <div className="bg-white w-24 h-24 rounded-full flex items-center justify-center">
                <span className="text-6xl font-bold text-black">{grandHours}h</span>
              </div>
            </div>
            <div className="text-lg font-semibold">{grandMinutes}m {remainingSeconds}s / 7.5h</div>
            <div className="text-sm text-gray-500 text-center max-w-xs">Total time logged today</div>
          </div>
        )}
      </CardContent>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="p-4 max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Work Hours per Activity</SheetTitle>
            <SheetDescription>Breakdown of total work hours by activity type.</SheetDescription>
          </SheetHeader>

          <div className="mt-4">
            {Object.keys(durationPerType).length === 0 ? (
              <p className="text-sm text-gray-500">No activities with time recorded.</p>
            ) : Object.entries(durationPerType).map(([type, ms], i) => (
              <React.Fragment key={type}>
                {i > 0 && <Separator className="my-2" />}
                <div className="flex justify-between text-xs font-medium py-1 w-full">
                  <span>{type}</span>
                  <span>{formatDuration(ms)}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <CardFooter className="flex justify-end border-t">
        <Button
          aria-label="Show Breakdown"
          className="cursor-pointer p-6"
          onClick={() => setOpen(true)}
          style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
          <ListTree /> Show Breakdown
        </Button>
      </CardFooter>
    </Card>
  );
}

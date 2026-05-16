"use client";

import React, { useMemo, useState, useEffect } from "react";
import { TrendingUp, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from "recharts";
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, } from "@/components/ui/chart";

interface Activity {
  source?: string;
}

interface SourceCardProps {
  activities: Activity[];
  loading?: boolean;
  error?: string | null;
}

/** 🔒 Allowed sources (LABELS ONLY) */
const ALLOWED_SOURCES = [
  "Outbound - Touchbase",
  "Outbound - Follow-up",
  "Existing Client",
  "CSR Inquiry",
  "Government",
  "Philgeps Website",
  "Philgeps",
  "Distributor",
  "Modern Trade",
  "Facebook Marketplace",
  "Walk-in Showroom",
];

export function SourceCard({ activities, loading, error }: SourceCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

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

  const data = useMemo(() => {
    if (!activities || activities.length === 0) {
      return [];
    }

    const counts: Record<string, number> = {};
    ALLOWED_SOURCES.forEach((label) => {
      counts[label] = 0;
    });

    activities.forEach((act) => {
      if (act.source && counts.hasOwnProperty(act.source)) {
        counts[act.source]++;
      }
    });

    return ALLOWED_SOURCES
      .map((label) => ({
        source: label,
        count: counts[label],
      }))
      .filter((item) => item.count > 0);
  }, [activities]);

  const chartConfig = {
    count: {
      label: "Count",
      color: "var(--chart-1)",
    },
  } satisfies Record<string, { label: string; color: string }>;

  return (
    <Card className="bg-white z-10 text-black" style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
      <CardHeader className="flex justify-between items-center">
        <div>
          <CardTitle>Source Breakdown</CardTitle>
          <CardDescription>
            Counts based on predefined source labels only
          </CardDescription>
        </div>

        {/* Info Icon */}
        <div
          className="relative cursor-pointer p-1 rounded hover:bg-gray-100"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          tabIndex={0}
          aria-label="Information about source labels"
        >
          <Info className="h-4 w-4 text-gray-400" />

          {showTooltip && (
            <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded bg-gray-900 p-3 text-xs text-white shadow-lg">
              <p>
                This chart only counts activities with sources predefined in the
                list. Activities from other or unknown sources are excluded.
              </p>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-12 text-lg font-semibold"><Spinner /></div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 text-sm">{error}</div>
        ) : (
          <ChartContainer config={chartConfig}>
            <BarChart
              data={data}
              accessibilityLayer
              layout="vertical"
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              height={360}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                stroke="var(--muted-foreground)"
              />
              <YAxis
                type="category"
                dataKey="source"
                tickLine={false}
                axisLine={false}
                width={160}
                stroke="var(--muted-foreground)"
              />

              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Bar
                dataKey="count"
                fill="var(--chart-1)"
                radius={[8, 8, 8, 8]}
              >
                <LabelList
                  dataKey="count"
                  position="right"
                  className="fill-muted-foreground"
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>

      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="text-muted-foreground leading-none">
          Only predefined sources are displayed
        </div>
      </CardFooter>
    </Card>
  );
}

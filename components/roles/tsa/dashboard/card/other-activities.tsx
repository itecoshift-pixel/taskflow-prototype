"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemTitle, ItemDescription, } from "@/components/ui/item";
import { Card, CardFooter } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useSearchParams } from "next/navigation";
import { TruckElectric, Coins, ReceiptText, PackageCheck, PackageX, CircleOff, Activity } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button"

interface Activity {
  type_activity?: string;
  actual_sales?: number | string;
  quotation_number?: string | null;
  so_number?: string | null;
  status?: string;
  so_amount?: number | string;
}

interface Props {
  activities: Activity[];
  loading: boolean;
  error: string | null;
}

export function ActivityCard({ activities, loading, error }: Props) {
  /* ===================== CALCULATIONS ===================== */

  const deliveredActivities = activities.filter(
    (a) => a.type_activity === "Delivered / Closed Transaction"
  );

  const totalDeliveries = deliveredActivities.length;

  const totalSales = deliveredActivities.reduce((sum, a) => {
    const value = Number(a.actual_sales);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  const quotationCount = activities.filter(
    (a) => a.quotation_number && a.quotation_number.trim() !== ""
  ).length;

  const soDoneActivities = activities.filter(
    (a) => a.so_number && a.so_number.trim() !== "" && a.status === "SO-Done"
  );

  const soCount = soDoneActivities.length;

  const totalSOAmount = soDoneActivities.reduce((sum, a) => {
    const value = Number(a.so_amount);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  const cancelledSOActivities = activities.filter(
    (a) => a.so_number && a.so_number.trim() !== "" && a.status === "Cancelled"
  );

  const cancelledSOCount = cancelledSOActivities.length;

  const totalCancelledSOAmount = cancelledSOActivities.reduce((sum, a) => {
    const value = Number(a.so_amount);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  /* ===================== EMPTY STATE CHECK ===================== */

  const searchParams = useSearchParams();
  const userId = searchParams?.get("id") ?? null;

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

  const hasAnyData =
    totalDeliveries > 0 ||
    totalSales > 0 ||
    quotationCount > 0 ||
    soCount > 0 ||
    cancelledSOCount > 0 ||
    totalCancelledSOAmount > 0;

  /* ===================== RENDER ===================== */

  return (
    <Card className="bg-white z-10 text-black flex flex-col justify-between"
      style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
      {!hasAnyData ? (
        /* ===================== EMPTY STATE UI ===================== */
        <div className="flex flex-col items-center justify-center text-center gap-3 mt-20">
          {/* LOTTIE CONTAINER */}
          <div className="flex items-center justify-center w-24 h-24 mb-8">
            <iframe src="https://lottie.host/embed/de357e85-2848-4ae4-be10-99d753e26981/JQWirq1adk.lottie" className="w-50 h-50 border-0 pointer-events-none"
              title="No Data Animation"></iframe>
          </div>

          <p className="text-sm font-medium text-gray-700">No Data Available</p>
          <p className="text-xs text-gray-500">Create more activities to see analytics</p>
        </div>
      ) : (
        /* ===================== DATA UI ===================== */
        <div className="flex flex-col gap-2 p-2">
          {/* Total Deliveries */}
          {totalDeliveries > 0 && (
            <Item variant="outline" className="w-full border border-gray-200" style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium">
                    <TruckElectric /> Total Delivered
                  </ItemTitle>
                  <ItemDescription>
                    <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono text-white bg-green-500">
                      {totalDeliveries}
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>
          )}

          {/* Total Sales */}
          {totalSales > 0 && (
            <Item variant="outline" className="w-full border border-gray-200" style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-medium">
                    <Coins /> Total SI
                  </ItemTitle>
                  <ItemDescription>
                    <Badge className="h-8 min-w-[2rem] rounded-full px-3 font-mono text-white bg-green-500">
                      ₱ {totalSales.toLocaleString()}
                    </Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>
          )}

          {/* Quotation & SO */}
          <div className="grid grid-cols-1 gap-2">
            {quotationCount > 0 && (
              <Item
                variant="outline"
                className={`border border-gray-200 ${soCount === 0 ? "col-span-2" : ""
                  }`}
                style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
              >
                <ItemContent>
                  <div className="flex justify-between w-full">
                    <ItemTitle className="text-xs font-medium">
                      <ReceiptText /> Quotes
                    </ItemTitle>
                    <ItemDescription>
                      <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono text-white bg-blue-500">
                        {quotationCount}
                      </Badge>
                    </ItemDescription>
                  </div>
                </ItemContent>
              </Item>
            )}

            {soCount > 0 && (
              <Item
                variant="outline"
                className={`border border-gray-200 ${quotationCount === 0 ? "col-span-2" : ""
                  }`}
                style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}
              >
                <ItemContent>
                  <div className="flex justify-between w-full">
                    <ItemTitle className="text-xs font-medium">
                      <PackageCheck /> Orders
                    </ItemTitle>
                    <ItemDescription>
                      <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono text-white bg-purple-500">
                        {soCount}
                      </Badge>
                    </ItemDescription>
                  </div>
                </ItemContent>
              </Item>
            )}
          </div>

          {/* Cancelled */}
          {(cancelledSOCount > 0 || totalCancelledSOAmount > 0) && (
            <Item variant="outline" className="border border-gray-200"
              style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
              <ItemContent className="space-y-1">
                {cancelledSOCount > 0 && (
                  <div className="flex justify-between w-full">
                    <ItemTitle className="text-xs font-medium text-red-600">
                      <PackageX /> Cancelled Sales Orders
                    </ItemTitle>
                    <ItemDescription>
                      <Badge className="h-8 min-w-[2rem] rounded-full px-1 font-mono text-white bg-red-600">
                        {cancelledSOCount}
                      </Badge>
                    </ItemDescription>
                  </div>
                )}

                {totalCancelledSOAmount > 0 && (
                  <div className="flex justify-between w-full">
                    <ItemTitle className="text-xs font-medium text-red-600">
                      <CircleOff /> Cancelled SO Amount
                    </ItemTitle>
                    <ItemDescription>
                      <Badge className="h-8 min-w-[2rem] rounded-full px-3 font-mono text-white bg-red-800">
                        ₱ {totalCancelledSOAmount.toLocaleString()}
                      </Badge>
                    </ItemDescription>
                  </div>
                )}
              </ItemContent>
            </Item>
          )}
        </div>
      )}
      <CardFooter className="flex justify-end border-t">
        <Button asChild className="p-6" style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
          <Link
            href={
              userId
                ? `/roles/tsa/activity/planner?id=${encodeURIComponent(userId)}`
                : "/roles/tsa/activity/planner"
            }
          >
            <Activity /> Add Activity
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

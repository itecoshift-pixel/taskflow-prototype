"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemTitle, ItemDescription } from "@/components/ui/item";
import { Card, CardFooter } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import {
  PhoneOutgoing,
  PhoneCall,
  PhoneMissed,
  PhoneForwarded,
  Activity,
  Facebook,
} from "lucide-react";

interface ActivityType {
  call_status?: string;
  call_type?: string;
  source?: string;
  type_activity?: string;
}

interface Props {
  activities: ActivityType[];
  loading: boolean;
  error: string | null;
}

export function OutboundTouchbaseCard({ activities }: Props) {
  let touchbaseSuccessful = 0;
  let touchbaseUnsuccessful = 0;
  let followupSuccessful = 0;
  let followupUnsuccessful = 0;
  let viberReplies = 0;

  let fbReplyMessage = 0;
  let fbPosting = 0;

  // OPTIMIZED SINGLE LOOP
  activities.forEach((a) => {
    if (a.source === "Outbound - Touchbase") {
      if (a.call_status === "Successful") touchbaseSuccessful++;
      if (a.call_status === "Unsuccessful") touchbaseUnsuccessful++;
    }

    if (a.source === "Outbound - Follow-up") {
      if (a.call_status === "Successful") followupSuccessful++;
      if (a.call_status === "Unsuccessful") followupUnsuccessful++;
    }

    if (a.type_activity === "Viber Replies / Messages") {
      viberReplies++;
    }

    if (a.type_activity === "FB Marketplace Replies / Messages") {
      // Count Reply Message Concern as "Reply"
      if (a.call_type === "Reply Message Concern") fbReplyMessage++;
      if (a.call_type === "Posting") fbPosting++;
    }
  });

  const touchbaseTotal = touchbaseSuccessful + touchbaseUnsuccessful;
  const followupTotal = followupSuccessful + followupUnsuccessful;
  const fbMarketplace = fbReplyMessage + fbPosting;

  const hasAnyData =
    touchbaseTotal > 0 ||
    followupTotal > 0 ||
    viberReplies > 0 ||
    fbMarketplace > 0;

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

  return (
    <Card className="bg-white z-10 text-black flex flex-col justify-between"
      style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
      {!hasAnyData ? (
        <div className="flex flex-col items-center justify-center text-center gap-3 mt-20">
          <div className="flex items-center justify-center w-24 h-24 mb-8">
            <iframe
              src="https://lottie.host/embed/bcb66921-23b0-42e0-8c0e-38cca063563f/jaQLwTIXFi.lottie"
              className="w-50 h-50 border-0 pointer-events-none"
              title="No Data Animation"
            />
          </div>
          <p className="text-sm font-medium text-gray-700">No Data Available</p>
          <p className="text-xs text-gray-500">
            Create more activities to see analytics
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-2">

          {/* TOUCHBASE */}
          {touchbaseTotal > 0 && (
            <Item variant="outline" className="border border-gray-200"
              style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-semibold flex items-center gap-1">
                    <PhoneOutgoing size={14} />Total Outbound - Touchbase
                  </ItemTitle>
                  <ItemDescription>
                    <Badge className="bg-blue-500 text-white">{touchbaseTotal}</Badge>
                  </ItemDescription>
                </div>

                {/* CHILD BREAKDOWN */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center mt-2 text-xs">
                  <div className="flex items-center gap-1 justify-start">
                    <PhoneCall size={12} className="text-green-600" />
                    <span>Successful</span>
                    <Badge className="bg-green-500 text-white ml-1">{touchbaseSuccessful}</Badge>
                  </div>

                  <Separator orientation="vertical" className="h-5 mx-2" />

                  <div className="flex items-center gap-1 justify-end">
                    <PhoneMissed size={12} className="text-red-600" />
                    <span>Unsuccessful</span>
                    <Badge variant="destructive">{touchbaseUnsuccessful}</Badge>
                  </div>
                </div>
              </ItemContent>
            </Item>
          )}

          {/* FOLLOW UP */}
          {followupTotal > 0 && (
            <Item variant="outline" className="border border-gray-200"
              style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-semibold flex items-center gap-1">
                    <PhoneForwarded size={14} />Total Outbound - Follow Up
                  </ItemTitle>
                  <ItemDescription>
                    <Badge className="bg-blue-500 text-white">{followupTotal}</Badge>
                  </ItemDescription>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center mt-2 text-xs">
                  <div className="flex items-center gap-1 justify-start">
                    <PhoneCall size={12} className="text-green-600" />
                    <span>Successful</span>
                    <Badge className="bg-green-500 text-white">{followupSuccessful}</Badge>
                  </div>

                  <Separator orientation="vertical" className="h-5 mx-2" />

                  <div className="flex items-center gap-1 justify-end">
                    <PhoneMissed size={12} className="text-red-600" />
                    <span>Unsuccessful</span>
                    <Badge variant="destructive">{followupUnsuccessful}</Badge>
                  </div>
                </div>
              </ItemContent>
            </Item>
          )}

          {/* VIBER */}
          {viberReplies > 0 && (
            <Item variant="outline" className="border border-gray-200" style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-semibold flex items-center gap-1">
                    📩 Viber Replies / Messages
                  </ItemTitle>
                  <ItemDescription>
                    <Badge className="bg-purple-500 text-white">{viberReplies}</Badge>
                  </ItemDescription>
                </div>
              </ItemContent>
            </Item>
          )}

          {/* FB MARKETPLACE */}
          {fbMarketplace > 0 && (
            <Item variant="outline" className="border border-gray-200"
              style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
              <ItemContent>
                <div className="flex justify-between w-full">
                  <ItemTitle className="text-xs font-semibold flex items-center gap-1">
                    <Facebook size={14} /> FB Marketplace / Messages
                  </ItemTitle>
                  <ItemDescription>
                    <Badge className="bg-indigo-500 text-white">{fbMarketplace}</Badge>
                  </ItemDescription>
                </div>

                {/* BREAKDOWN */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center mt-2 text-xs">
                  <div className="flex items-center gap-1">
                    <span>Reply Message</span>
                    <Badge className="bg-blue-500 text-white">{fbReplyMessage}</Badge>
                  </div>

                  <Separator orientation="vertical" className="h-5 mx-2" />

                  <div className="flex items-center gap-1 justify-end">
                    <span>Posting</span>
                    <Badge className="bg-purple-500 text-white">{fbPosting}</Badge>
                  </div>
                </div>
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
            <Activity size={16} /> Add Activity
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
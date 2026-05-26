"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { SidebarLeft } from "@/components/sidebar-left";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";

import { NationalRanking } from "@/components/national-ranking";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { UnifiedNotificationBellLazy } from "@/components/unified-notification-bell-lazy";

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  target_quota: string;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
    tsm: "",
    manager: "",
    target_quota: "",
  });

  const [loadingUser, setLoadingUser] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default date range: today to today
  const today = new Date();
  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = React.useState<
    [Date | null, Date | null]
  >([today, today]);

  const queryUserId = searchParams?.get("id") ?? "";

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  useEffect(() => {
    if (!userId) {
      setLoadingUser(false);
      return;
    }

    const fetchUserData = async () => {
      setError(null);
      setLoadingUser(true);
      try {
        const response = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!response.ok) throw new Error("Failed to fetch user data");
        const data = await response.json();

        setUserDetails({
          referenceid: data.ReferenceID || "",
          tsm: data.TSM || "",
          manager: data.Manager || "",
          target_quota: data.TargetQuota || "",
        });

        sileo.success({
          title: "Success",
          description: "User data loaded successfully!",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: {
            title: "text-white!",
            description: "text-white",
          },
        });
      } catch (err) {
        sileo.warning({
          title: "Failed",
          description: "Error fetching user data:",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: {
            title: "text-white!",
            description: "text-white",
          },
        });
        sileo.error({
          title: "Failed",
          description: "Failed to connect to server. Please try again later or refresh your network connection",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: {
            title: "text-white!",
            description: "text-white",
          },
        });
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId]);

  return (
    <>
      <ProtectedPageWrapper>
        <SidebarLeft />
        <SidebarInset className="overflow-hidden">
          <div
            className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] z-10 pointer-events-none"
          />
          <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b z-50">
            <div className="flex flex-1 items-center gap-2 px-3">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-xs font-semibold uppercase tracking-wide">
                      National Call Ranking (Outbound - Touchbase)
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center px-3">
              <UnifiedNotificationBellLazy />
            </div>
          </header>

          <NationalRanking
            dateCreatedFilterRange={dateCreatedFilterRange}
            setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
          />
        </SidebarInset>
      </ProtectedPageWrapper>
    </>
  );
}

export default function Page() {
  return (
    <UserProvider>
      <NotificationProvider>
        <FormatProvider>
          <SidebarProvider>
            <Suspense fallback={<div>Loading...</div>}>
              <DashboardContent />
            </Suspense>
          </SidebarProvider>
        </FormatProvider>
      </NotificationProvider>
    </UserProvider>
  );
}

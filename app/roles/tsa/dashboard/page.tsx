"use client";

import React, { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { type DateRange } from "react-day-picker";
import { sileo } from "sileo";

// Cards
import { AccountCard } from "@/components/roles/tsa/dashboard/card/accounts";
import { OutboundTouchbaseCard } from "@/components/roles/tsa/dashboard/card/outbound-touchbase";
import { TimemotionCard } from "@/components/roles/tsa/dashboard/card/time-and-motion";
import { ActivityCard } from "@/components/roles/tsa/dashboard/card/other-activities";
// Charts
import { SourceCard } from "@/components/roles/tsa/dashboard/chart/source";
import { CSRMetricsCard } from "@/components/roles/tsa/dashboard/chart/csr";
// Lists
import { OutboundCallsCard } from "@/components/roles/tsa/dashboard/list/outbound";
import { QuotationCard } from "@/components/roles/tsa/dashboard/list/quotation";
import { SOCard } from "@/components/roles/tsa/dashboard/list/so";
// Maps
import { SiteVisitCard } from "@/components/roles/tsa/dashboard/maps/site-visit";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { UnifiedNotificationBellLazy } from "@/components/unified-notification-bell-lazy";

/* ================= TYPES ================= */

interface UserDetails {
  referenceid: string;
  tsm?: string;
  manager?: string;
}

interface Activity {
  referenceid: string;
  source?: string;
  call_status?: string;
  date_created: string;
  start_date?: string;
  end_date?: string;
  type_activity: string;
  status: string;
  actual_sales: string;
  quotation_number: string;
  quotation_amount: string;
  so_number: string;
  so_amount: string;
  type_client: string;
  activity_reference_number: string;
  company_name?: string;
}

/* ================= HELPERS ================= */

/** Narrows DateRange (optional from/to) into a strict { from, to } object. */
function toStrictRange(
  range: DateRange | undefined
): { from: Date; to: Date } | undefined {
  if (range?.from && range?.to) return { from: range.from, to: range.to };
  return undefined;
}

/* ================= MAIN CONTENT ================= */

function DashboardContent() {
  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] =
    React.useState<DateRange | undefined>(undefined);

  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  /* Default to today on first load */
  useEffect(() => {
    if (!dateCreatedFilterRange) {
      const today = new Date();
      setDateCreatedFilterRangeAction({
        from: new Date(today.setHours(0, 0, 0, 0)),
        to: new Date(new Date().setHours(23, 59, 59, 999)),
      });
    }
  }, [dateCreatedFilterRange]);

  /* Sync userId from URL */
  const queryUserId = searchParams?.get("id") ?? "";
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  /* ---- User ---- */
  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
    tsm: "",
    manager: "",
  });
  const [loadingUser, setLoadingUser] = useState(false);
  const [errorUser, setErrorUser] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoadingUser(false);
      return;
    }

    const fetchUserData = async () => {
      setErrorUser(null);
      setLoadingUser(true);
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error("Failed to fetch user data");
        const data = await res.json();

        setUserDetails({
          referenceid: data.ReferenceID || "",
          tsm: data.TSM || "",
          manager: data.Manager || "",
        });

        sileo.success({
          title: "Success",
          description: "User data loaded successfully!",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
      } catch {
        sileo.error({
          title: "Failed",
          description:
            "Failed to connect to server. Please try again later or refresh your network connection.",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId]);

  /* ---- Activities ---- */
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);

  const fetchActivities = useCallback(() => {
    const { referenceid } = userDetails;
    if (!referenceid) {
      setActivities([]);
      return;
    }

    setLoadingActivities(true);
    setErrorActivities(null);

    const from = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
      : null;
    const to = dateCreatedFilterRange?.to
      ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
      : null;

    const url = new URL(
      "/api/activity/tsa/dashboard/fetch",
      window.location.origin
    );
    url.searchParams.append("referenceid", referenceid);
    if (from && to) {
      url.searchParams.append("from", from);
      url.searchParams.append("to", to);
    }

    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch activities");
        return res.json();
      })
      .then((data) => setActivities(data.activities || []))
      .catch((err) => setErrorActivities(err.message))
      .finally(() => setLoadingActivities(false));
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  /* ---- Client-side date filter ---- */
  const filteredActivities = useMemo(() => {
    if (!dateCreatedFilterRange?.from) return activities;

    const from = new Date(dateCreatedFilterRange.from);
    from.setHours(0, 0, 0, 0);
    const to = dateCreatedFilterRange.to
      ? new Date(new Date(dateCreatedFilterRange.to).setHours(23, 59, 59, 999))
      : null;

    return activities.filter((a) => {
      if (!a.date_created) return true;
      const d = new Date(a.date_created);
      if (d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [activities, dateCreatedFilterRange]);

  /* Shared props passed to many cards */
  const cardProps = {
    activities: filteredActivities,
    loading: loadingActivities,
    error: errorActivities,
  };

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset>
        {/* Top bar */}
        <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 z-[50]">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs font-semibold uppercase tracking-wide">
                    Dashboard
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center px-3">
            <UnifiedNotificationBellLazy />
          </div>
        </header>

        <div className="flex flex-col gap-4 p-4">
          {/* Background grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] z-10 pointer-events-none" />

          {/* Row 1 — Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <AccountCard referenceid={userDetails.referenceid} />
            <OutboundTouchbaseCard {...cardProps} />
            <TimemotionCard
              {...cardProps}
              referenceid={userDetails.referenceid}
              dateRange={dateCreatedFilterRange}
            />
            <ActivityCard {...cardProps} dateRange={dateCreatedFilterRange} />
          </div>

          {/* Row 2 — Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SourceCard {...cardProps} />
            <CSRMetricsCard referenceId={userDetails.referenceid} dateRange={dateCreatedFilterRange} />
          </div>

          {/* Row 3 — Lists & Map */}
          <div className="grid grid-cols-1 gap-4">
            <OutboundCallsCard
              history={filteredActivities}
              loading={loadingActivities}
              error={errorActivities}
              dateCreatedFilterRange={toStrictRange(dateCreatedFilterRange)}
            />
            <QuotationCard {...cardProps} dateRange={dateCreatedFilterRange} />
            <SOCard {...cardProps} dateRange={dateCreatedFilterRange} />
            <SiteVisitCard
              referenceid={userDetails.referenceid}
              dateRange={dateCreatedFilterRange}
            />
          </div>
        </div>
      </SidebarInset>

      <SidebarRight
        dateCreatedFilterRange={dateCreatedFilterRange}
        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
      />
    </ProtectedPageWrapper>
  );
}

/* ================= PAGE ================= */

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
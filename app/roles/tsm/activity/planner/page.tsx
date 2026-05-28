"use client";

import React, { useEffect, useState, useMemo, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { sileo } from "sileo";
import { type DateRange } from "react-day-picker";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { AlertCircleIcon, ExternalLink } from "lucide-react";
import { UnifiedNotificationBellLazy } from "@/components/unified-notification-bell-lazy";

import { Scheduled } from "@/components/roles/tsm/activity/quotation/pending/pending-quotation";
import { EndorsedQuotation } from "@/components/roles/tsm/activity/quotation/endorsed/endorsed-quotation";
import { AccountsCards } from "@/components/roles/tsm/accounts/transfer/transfer";
import { RequestTable } from "@/components/roles/tsa/accounts/approval/table/table";
import { ApprovalHistory } from "@/components/roles/tsm/activity/approval/approval-history";

interface UserDetails {
    referenceid: string;
    tsm: string;
    manager: string;
    target_quota: string;
    firstname: string;
    lastname: string;
    email: string;
    contact: string;
    tsmname: string;
    managername: string;
    profilePicture: string;
    signature: string;
}

interface Account {
    id: string;
    referenceid: string;
    tsm: string;
    company_name: string;
    contact_person: string;
    contact_number: string;
    email_address: string;
    address: string;
    delivery_address: string;
    region: string;
    type_client: string;
    date_created: string;
    industry: string;
    status?: string;
    transfer_to: string;
    date_transferred: string;
    date_removed: string;
    remarks: string;
}

interface SPFRequest {
    id: number;
    spf_number: string;
    customer_name: string;
    contact_person: string;
    contact_number: string;
    registered_address: string;
    status?: string;
    date_created?: string;
    prepared_by?: string;
}

interface HistoryItem {
    id: number;
    activity_reference_number: string;
    company_name: string;
    contact_person: string;
    contact_number: string;
    call_type: string;
    source: string;
    status: string;
    date_created: string;
    referenceid: string;
    remarks: string;
    tsm_approved_status: string;
    tsm_approved_remarks: string;
}

function DashboardContent() {
    const searchParams = useSearchParams();
    const { userId, setUserId } = useUser();

    const [userDetails, setUserDetails] = useState<UserDetails>({
        referenceid: "",
        tsm: "",
        manager: "",
        target_quota: "",
        firstname: "",
        lastname: "",
        email: "",
        contact: "",
        tsmname: "",
        managername: "",
        profilePicture: "",
        signature: "",
    });

    const [loadingUser, setLoadingUser] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [posts, setPosts] = useState<Account[]>([]);
    const [deletionRequests, setDeletionRequests] = useState<Account[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [loadingDeletions, setLoadingDeletions] = useState(false);
    const [agentFilter, setAgentFilter] = useState<string>("all");

    // Approval History State
    const [approvalHistory, setApprovalHistory] = useState<HistoryItem[]>([]);
    const [loadingApprovalHistory, setLoadingApprovalHistory] = useState(false);

    // SPF Notifications
    const [spfRequests, setSpfRequests] = useState<SPFRequest[]>([]);
    const [loadingSpf, setLoadingSpf] = useState(false);
    const [spfNotificationOpen, setSpfNotificationOpen] = useState(false);
    const [prevSpfCount, setPrevSpfCount] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize audio
    useEffect(() => {
        audioRef.current = new Audio("/reminder-notification.mp3");
        audioRef.current.volume = 0.5;
    }, []);

    const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = React.useState<DateRange | undefined>(undefined);

    const queryUserId = searchParams?.get("id") ?? "";

    // Sync URL query param with userId context
    useEffect(() => {
        if (queryUserId && queryUserId !== userId) {
            setUserId(queryUserId);
        }
    }, [queryUserId, userId, setUserId]);

    // Fetch user details when userId changes
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
                    firstname: data.Firstname || "",
                    lastname: data.Lastname || "",
                    email: data.Email || "",
                    contact: data.ContactNumber || "",
                    tsmname: data.TSMName || "",
                    managername: data.ManagerName || "",
                    profilePicture: data.profilePicture || "",
                    signature: data.signatureImage || "",
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

    useEffect(() => {
        if (!userDetails.referenceid) {
            setPosts([]);
            return;
        }

        const fetchAccounts = async () => {
            setError(null);
            setLoadingAccounts(true);
            try {
                const response = await fetch(
                    `/api/com-fetch-approval-account-removal?tsm=${encodeURIComponent(
                        userDetails.referenceid
                    )}`
                );

                if (!response.ok) throw new Error("Failed to fetch accounts");

                const data = await response.json();
                setPosts(data.data || []);

                sileo.success({
                    title: "Success",
                    description: "Accounts loaded successfully!",
                    duration: 4000,
                    position: "top-right",
                    fill: "black",
                    styles: {
                        title: "text-white!",
                        description: "text-white",
                    },
                });
            } catch (err) {
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
                setLoadingAccounts(false);
            }
        };

        fetchAccounts();
    }, [userDetails.referenceid]);

    useEffect(() => {
        if (!userDetails.referenceid) {
            setDeletionRequests([]);
            return;
        }

        const fetchDeletionRequests = async () => {
            setError(null);
            setLoadingDeletions(true);
            try {
                const response = await fetch(
                    `/api/com-fetch-deletion-requests?tsm=${encodeURIComponent(
                        userDetails.referenceid
                    )}`
                );

                if (!response.ok) throw new Error("Failed to fetch deletion requests");

                const data = await response.json();
                setDeletionRequests(data.data || []);

                sileo.success({
                    title: "Success",
                    description: "Deletion requests loaded successfully!",
                    duration: 4000,
                    position: "top-right",
                    fill: "black",
                    styles: {
                        title: "text-white!",
                        description: "text-white",
                    },
                });
            } catch (err) {
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
                setLoadingDeletions(false);
            }
        };

        fetchDeletionRequests();
    }, [userDetails.referenceid]);

    // Fetch SPF requests with "Approval for TSM" status
    useEffect(() => {
        if (!userDetails.referenceid) {
            setSpfRequests([]);
            return;
        }

        const fetchSpfRequests = async () => {
            setLoadingSpf(true);
            try {
                // Fetch from the SPF endpoint - same endpoint used in request-spf.tsx
                const response = await fetch(
                    `/api/activity/tsm/spf/fetch?referenceid=${encodeURIComponent(userDetails.referenceid)}`
                );

                if (!response.ok) throw new Error("Failed to fetch SPF requests");

                const data = await response.json();
                // Filter only those with "Approval For TSM" status
                const pendingApprovals = (data.activities || []).filter(
                    (req: SPFRequest) => req.status === "Approval For TSM"
                );

                // Play sound if new requests detected
                if (pendingApprovals.length > prevSpfCount && prevSpfCount > 0) {
                    audioRef.current?.play().catch(() => {
                        // Ignore autoplay errors
                    });
                }

                setPrevSpfCount(pendingApprovals.length);
                setSpfRequests(pendingApprovals);
            } catch (err) {
                console.error("Error fetching SPF requests:", err);
                setSpfRequests([]);
            } finally {
                setLoadingSpf(false);
            }
        };

        fetchSpfRequests();

        // Set up polling every 30 seconds
        const interval = setInterval(fetchSpfRequests, 30000);
        return () => clearInterval(interval);
    }, [userDetails.referenceid]);

    // Fetch Approval History with "Approval for TSM" status
    useEffect(() => {
        if (!userDetails.referenceid) {
            setApprovalHistory([]);
            return;
        }

        const fetchApprovalHistory = async () => {
            setLoadingApprovalHistory(true);
            try {
                const response = await fetch(
                    `/api/act-fetch-tsm-history?referenceid=${encodeURIComponent(userDetails.referenceid)}`
                );

                if (!response.ok) throw new Error("Failed to fetch approval history");

                const data = await response.json();
                // Filter only those with "Approval for TSM" status
                const pendingApprovals = (data.activities || []).filter(
                    (item: HistoryItem) => item.status === "Approval for TSM"
                );

                setApprovalHistory(pendingApprovals);
            } catch (err) {
                console.error("Error fetching approval history:", err);
                setApprovalHistory([]);
            } finally {
                setLoadingApprovalHistory(false);
            }
        };

        fetchApprovalHistory();

        // Set up polling every 30 seconds
        const interval = setInterval(fetchApprovalHistory, 30000);
        return () => clearInterval(interval);
    }, [userDetails.referenceid]);

    const filteredData = useMemo(() => {
        let filteredPosts = posts;

        if (
            dateCreatedFilterRange &&
            dateCreatedFilterRange.from &&
            dateCreatedFilterRange.to
        ) {
            const fromTime = new Date(dateCreatedFilterRange.from).setHours(0, 0, 0, 0);
            const toTime = new Date(dateCreatedFilterRange.to).setHours(23, 59, 59, 999);

            filteredPosts = filteredPosts.filter((item) => {
                if (!item.date_transferred) return false;

                const transferredTime = new Date(item.date_transferred).getTime();

                return transferredTime >= fromTime && transferredTime <= toTime;
            });
        }

        if (agentFilter !== "all") {
            filteredPosts = filteredPosts.filter((item) => item.tsm === agentFilter);
        }

        return filteredPosts;
    }, [posts, dateCreatedFilterRange, agentFilter]);

    const filteredDeletionData = useMemo(() => {
        let filteredPosts = deletionRequests;

        if (agentFilter !== "all") {
            filteredPosts = filteredPosts.filter((item) => item.tsm === agentFilter);
        }

        return filteredPosts;
    }, [deletionRequests, agentFilter]);

    async function refreshAccounts() {
        try {
            const response = await fetch(
                `/api/com-fetch-approval-account-removal?tsm=${encodeURIComponent(
                    userDetails.referenceid
                )}`
            );
            if (!response.ok) throw new Error("Failed to fetch accounts");

            const data = await response.json();
            setPosts(data.data || []);
            sileo.success({
                title: "Success",
                description: "Accounts loaded successfully!",
                duration: 4000,
                position: "top-right",
                fill: "black",
                styles: {
                    title: "text-white!",
                    description: "text-white",
                },
            });
        } catch (error) {
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
        }
    }

    async function refreshDeletionRequests() {
        try {
            const response = await fetch(
                `/api/com-fetch-deletion-requests?tsm=${encodeURIComponent(
                    userDetails.referenceid
                )}`
            );
            if (!response.ok) throw new Error("Failed to fetch deletion requests");

            const data = await response.json();
            setDeletionRequests(data.data || []);
            sileo.success({
                title: "Success",
                description: "Deletion requests loaded successfully!",
                duration: 4000,
                position: "top-right",
                fill: "black",
                styles: {
                    title: "text-white!",
                    description: "text-white",
                },
            });
        } catch (error) {
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
        }
    }

    async function refreshApprovalHistory() {
        if (!userDetails.referenceid) return;

        setLoadingApprovalHistory(true);
        try {
            const response = await fetch(
                `/api/act-fetch-tsm-history?referenceid=${encodeURIComponent(userDetails.referenceid)}`
            );

            if (!response.ok) throw new Error("Failed to fetch approval history");

            const data = await response.json();
            const pendingApprovals = (data.activities || []).filter(
                (item: HistoryItem) => item.status === "Approval for TSM"
            );

            setApprovalHistory(pendingApprovals);
            sileo.success({
                title: "Success",
                description: "Approval history refreshed successfully!",
                duration: 4000,
                position: "top-right",
                fill: "black",
                styles: {
                    title: "text-white!",
                    description: "text-white",
                },
            });
        } catch (error) {
            sileo.error({
                title: "Failed",
                description: "Failed to refresh approval history. Please try again.",
                duration: 4000,
                position: "top-right",
                fill: "black",
                styles: {
                    title: "text-white!",
                    description: "text-white",
                },
            });
        } finally {
            setLoadingApprovalHistory(false);
        }
    }

    return (
        <>
            <ProtectedPageWrapper>
                <SidebarLeft />
                <SidebarInset className="overflow-hidden">
                    <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b">
                        <div className="flex flex-1 items-center gap-2 px-3">
                            <SidebarTrigger />
                            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                            <Breadcrumb>
                                <BreadcrumbList>
                                    <BreadcrumbItem>
                                        <BreadcrumbPage className="line-clamp-1">Activity Planner</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>

                        {/* Notification Bell */}
                        <div className="flex items-center px-3">
                            <UnifiedNotificationBellLazy />
                        </div>
                    </header>

                    <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
                        {/* 4-card grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                            {/* Card 1 */}
                            <Card className="rounded-none border">
                                <CardHeader className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <AlertCircleIcon className="w-5 h-5 text-red-500" />
                                        <CardTitle className="text-sm font-semibold">Pending Approval of Quotations</CardTitle>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        These are the quotations that are awaiting manager or TSM approval.
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    <Scheduled
                                        referenceid={userDetails.referenceid}
                                        email={userDetails.email}
                                        contact={userDetails.contact}
                                        signature={userDetails.signature}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                                    />
                                </CardContent>
                            </Card>

                            {/* Card 2 */}
                            <Card className="rounded-none border">
                                <CardHeader className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <AlertCircleIcon className="w-5 h-5 text-red-500" />
                                        <CardTitle className="text-sm font-semibold">Pending Endorsed Quotation</CardTitle>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Quotations that are awaiting manager approval
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    <EndorsedQuotation
                                        referenceid={userDetails.referenceid}
                                        email={userDetails.email}
                                        contact={userDetails.contact}
                                        signature={userDetails.signature}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                                    />
                                </CardContent>
                            </Card>

                            {/* Card 3 */}
                            <Card className="rounded-none border">
                                <CardHeader className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <AlertCircleIcon className="w-5 h-5 text-red-500" />
                                        <CardTitle className="text-sm font-semibold">Pending Transfer</CardTitle>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Accounts that are currently marked as subject for transfer and waiting for approval.
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    <AccountsCards
                                        posts={filteredData}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                                        userDetails={userDetails}
                                        onRefreshAccountsAction={refreshAccounts}
                                    />
                                </CardContent>
                            </Card>

                            {/* Card 4 */}
                            <Card className="rounded-none border">
                                <CardHeader className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <AlertCircleIcon className="w-5 h-5 text-red-500" />
                                        <CardTitle className="text-sm font-semibold">Pending Request Account Deletion</CardTitle>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Below is the list of accounts pending deletion requests. You can review and approve the selected accounts.
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    <RequestTable
                                        posts={filteredDeletionData}
                                        dateCreatedFilterRange={dateCreatedFilterRange}
                                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                                        userDetails={userDetails}
                                        onRefreshAccountsAction={refreshDeletionRequests}
                                    />
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 gap-4">
                            {/* Card 5 - Approval for TSM Outbound Calls */}
                            <Card className="rounded-none border">
                                <CardHeader className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <AlertCircleIcon className="w-5 h-5 text-orange-500" />
                                        <CardTitle className="text-sm font-semibold">Approval for TSM - Outbound Calls</CardTitle>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Outbound calls awaiting TSM approval with "Approval for TSM" status.
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    {loadingApprovalHistory ? (
                                        <div className="text-center py-4 text-xs text-gray-500">Loading...</div>
                                    ) : (
                                        <ApprovalHistory
                                            history={approvalHistory}
                                            dateCreatedFilterRange={dateCreatedFilterRange}
                                            setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                                            onRefresh={refreshApprovalHistory}
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Existing content or other cards can go below */}
                    </main>
                </SidebarInset>

                <SidebarRight
                    dateCreatedFilterRange={dateCreatedFilterRange}
                    setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                />
            </ProtectedPageWrapper>
        </>
    );
}

export default function Page() {
    return (
        <UserProvider>
            <FormatProvider>
                <SidebarProvider>
                    <Suspense fallback={<div>Loading...</div>}>
                        <DashboardContent />
                    </Suspense>
                </SidebarProvider>
            </FormatProvider>
        </UserProvider>
    );
}

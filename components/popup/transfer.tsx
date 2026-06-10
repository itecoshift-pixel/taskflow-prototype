"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";

interface Transfer {
  company_name: string;
  date_transferred: string;
  date_approved: string;
  transfer_to: string; // ReferenceID of who transferred it
  status: string;
}

interface UserDetails {
  referenceid: string;
}

interface UserInfo {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture?: string;
}

export function TransferAlertDialog() {
  const searchParams = useSearchParams();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transferUsers, setTransferUsers] = useState<Record<string, UserInfo>>({});
  const [open, setOpen] = useState(false);
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);
  const { userId, user, setUserId } = useUser();
  const [userDetails, setUserDetails] = useState<UserDetails>({ referenceid: "" });
  const [loadingUser, setLoadingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [errorTransfers, setErrorTransfers] = useState<string | null>(null);

  const queryUserId = searchParams?.get("id") ?? "";

  // Sync URL query param with userId context
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  // Update userDetails from centralized user context
  useEffect(() => {
    if (user) {
      setUserDetails({
        referenceid: user.ReferenceID || "",
      });
    } else {
      setUserDetails({ referenceid: "" });
    }
  }, [user]);

  // Fetch active transfers for the user
  useEffect(() => {
    if (!userDetails || !userDetails.referenceid) return;

    const fetchActiveTransfers = async () => {
      setLoadingTransfers(true);
      setErrorTransfers(null);
      try {
        const res = await fetch(
          `/api/active-transfer?referenceid=${encodeURIComponent(userDetails.referenceid)}`
        );
        if (!res.ok) throw new Error("Failed to fetch active transfers");
        const json = await res.json();

        if (json.success && json.data.length > 0) {
          // Load dismissed list from localStorage
          let dismissedTransfers: string[] = [];
          try {
            dismissedTransfers = JSON.parse(localStorage.getItem("dismissedTransfers") || "[]");
          } catch {
            localStorage.removeItem("dismissedTransfers");
          }

          // Filter out transfers already dismissed
          const newTransfers = json.data.filter(
            (t: Transfer) => !dismissedTransfers.includes(t.company_name)
          );

          if (newTransfers.length > 0) {
            setTransfers(newTransfers);
            setOpen(true);
          } else {
            setTransfers([]);
            setOpen(false);
          }
        } else {
          setTransfers([]);
          setOpen(false);
        }
      } catch (err: any) {
        console.error("Failed to fetch active transfers", err);
        setErrorTransfers(err.message || "Unknown error");
        setTransfers([]);
        setOpen(false);
      } finally {
        setLoadingTransfers(false);
      }
    };

    fetchActiveTransfers();
  }, [userDetails]);

  // Fetch user info of transfer_to IDs
  useEffect(() => {
    if (transfers.length === 0) return;

    const uniqueTransferToIds = Array.from(new Set(transfers.map((t) => t.transfer_to)));

    async function fetchUsers() {
      try {
        const res = await fetch(
          `/api/fetch-users?referenceids=${encodeURIComponent(uniqueTransferToIds.join(","))}`
        );
        if (!res.ok) throw new Error("Failed to fetch transfer users");
        const users: UserInfo[] = await res.json();

        const usersMap: Record<string, UserInfo> = {};
        users.forEach((u) => {
          usersMap[u.ReferenceID] = u;
        });

        setTransferUsers(usersMap);
      } catch (err) {
        console.error("Error fetching transfer users:", err);
        setTransferUsers({});
      }
    }

    fetchUsers();
  }, [transfers]);

  // When user clicks Dismiss button on main dialog
  function handleDismiss() {
    setShowDismissConfirm(true);
  }

  // When user confirms they want to dismiss and never see again until new transfer
  function confirmDismiss() {
    // Save dismissed transfer company names to localStorage, so they won't show again
    let dismissedTransfers: string[] = [];
    try {
      dismissedTransfers = JSON.parse(localStorage.getItem("dismissedTransfers") || "[]");
    } catch {
      localStorage.removeItem("dismissedTransfers");
    }
    const newDismissed = [...dismissedTransfers, ...transfers.map(t => t.company_name)];
    localStorage.setItem("dismissedTransfers", JSON.stringify(newDismissed));

    setShowDismissConfirm(false);
    setOpen(false);
  }

  // Cancel dismiss confirmation dialog
  function cancelDismiss() {
    setShowDismissConfirm(false);
  }

  if (loadingUser || loadingTransfers) return null;
  if (error || errorTransfers) return null;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      {/* Main Transfer Alert Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Company Transferred</DialogTitle>
            <DialogDescription>
              {transfers.length > 0 ? (
                <>
                  <div>
                    {transfers.length} {transfers.length === 1 ? "company has" : "companies have"} been transferred to your account recently:
                  </div>
                  <div className="max-h-[300px] overflow-y-auto mt-2">
                    <ul className="list-disc pl-5 space-y-4">
                      {transfers.map((t, i) => {
                        const user = transferUsers[t.transfer_to];
                        return (
                          <li key={i}>
                            <strong>{t.company_name}</strong>
                            <div>
                              Transferred on: {formatDate(t.date_transferred)} <br />
                              Approved on: {formatDate(t.date_approved)} <br />
                              Transferred from:{" "}
                              {user ? (
                                <>
                                  {user.profilePicture && (
                                    <img
                                      src={user.profilePicture}
                                      alt={`${user.Firstname} ${user.Lastname}`}
                                      className="inline-block h-6 w-6 rounded-full ml-2"
                                    />
                                  )} &nbsp;
                                  <span className="capitalize">{user.Firstname} {user.Lastname}{" "}</span>
                                </>
                              ) : (
                                t.transfer_to
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </>
              ) : (
                ""
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleDismiss}>Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dismiss confirmation dialog */}
      <Dialog open={showDismissConfirm} onOpenChange={setShowDismissConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Dismiss</DialogTitle>
            <DialogDescription>
              Once you dismiss this alert, you won&apos;t see it again until new transfers are available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDismiss}>Cancel</Button>
            <Button onClick={confirmDismiss}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

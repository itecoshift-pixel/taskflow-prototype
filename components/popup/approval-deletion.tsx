"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";

interface Deletion {
  referenceid: string;
  company_name: string;
  date_removed: string;
  remarks: string;
  status: string;
}

interface UserDetails {
  referenceid: string;
}

export function RemoveDeletionDialog() {
  const searchParams = useSearchParams();
  const [deletions, setDeletions] = useState<Deletion[]>([]);
  const [open, setOpen] = useState(false);
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);
  const { userId, user, setUserId } = useUser();
  const [userDetails, setUserDetails] = useState<UserDetails>({ referenceid: "" });
  const [loadingUser, setLoadingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDeletions, setLoadingDeletions] = useState(false);
  const [errorDeletions, setErrorDeletions] = useState<string | null>(null);
  const [agents, setAgents] = useState<any[]>([]);

  // Ref for audio element to play notification sound
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundPlayed, setSoundPlayed] = useState(false);

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

  // Fetch agents based on userDetails.referenceid (TSM)
  useEffect(() => {
    if (!userDetails.referenceid) return;

    const fetchAgents = async () => {
      try {
        const response = await fetch(
          `/api/fetch-all-agent?id=${encodeURIComponent(userDetails.referenceid)}`
        );
        if (!response.ok) throw new Error("Failed to fetch agents");

        const data = await response.json();
        setAgents(data);
      } catch (err) {
        console.error("Error fetching agents:", err);
        setError("Failed to load agents.");
      }
    };

    fetchAgents();
  }, [userDetails.referenceid]);

  // Map ReferenceID -> agent fullname for display and filtering
  const agentMap = useMemo(() => {
    const map: Record<string, string> = {};
    agents.forEach((agent) => {
      map[agent.ReferenceID?.toLowerCase()] = `${agent.Firstname} ${agent.Lastname}`;
    });
    return map;
  }, [agents]);

  // Fetch active deletions for the user
  useEffect(() => {
    if (!userDetails.referenceid) return;

    const fetchActiveDeletions = async () => {
      setLoadingDeletions(true);
      setErrorDeletions(null);
      try {
        const res = await fetch(
          `/api/approve-deletion?referenceid=${encodeURIComponent(userDetails.referenceid)}`
        );
        if (!res.ok) throw new Error("Failed to fetch active deletions");
        const json = await res.json();

        if (json.success && json.data.length > 0) {
          // Load dismissed list from localStorage
          let dismissedDeletions: string[] = [];
          try {
            dismissedDeletions = JSON.parse(localStorage.getItem("dismissedDeletions") || "[]");
          } catch {
            localStorage.removeItem("dismissedDeletions");
          }

          // Filter out dismissed companies
          const newDeletions = json.data.filter(
            (t: Deletion) => !dismissedDeletions.includes(t.company_name)
          );

          if (newDeletions.length > 0) {
            setDeletions(newDeletions);
            setOpen(true);
          } else {
            setDeletions([]);
            setOpen(false);
          }
        } else {
          setDeletions([]);
          setOpen(false);
        }
      } catch (err: any) {
        console.error("Failed to fetch active deletions", err);
        setErrorDeletions(err.message || "Unknown error");
        setDeletions([]);
        setOpen(false);
      } finally {
        setLoadingDeletions(false);
      }
    };

    fetchActiveDeletions();
  }, [userDetails.referenceid]);

  // Play notification sound when dialog opens and new deletions exist and sound not played yet
  useEffect(() => {
    if (open && deletions.length > 0 && !soundPlayed) {
      const soundKey = "removalSoundPlayedFor";
      const playedFor = localStorage.getItem(soundKey);

      // Create a unique key based on current deletion company names sorted
      const currentIds = deletions.map((d) => d.company_name).sort().join(",");

      if (playedFor !== currentIds) {
        if (!audioRef.current) {
          audioRef.current = new Audio("/reminder-notification.mp3"); // <-- Make sure this path is correct and the file exists
        }
        audioRef.current.play().catch(() => {
          // Autoplay might be blocked, ignore errors silently
        });
        localStorage.setItem(soundKey, currentIds);
        setSoundPlayed(true);
      }
    }
  }, [open, deletions, soundPlayed]);

  function handleDismiss() {
    setShowDismissConfirm(true);
  }

  function confirmDismiss() {
    let dismissedDeletions: string[] = [];
    try {
      dismissedDeletions = JSON.parse(localStorage.getItem("dismissedDeletions") || "[]");
    } catch {
      localStorage.removeItem("dismissedDeletions");
    }
    const newDismissed = [...dismissedDeletions, ...deletions.map(t => t.company_name)];
    localStorage.setItem("dismissedDeletions", JSON.stringify(newDismissed));

    // Clear sound played flag so new deletions in future will play sound again
    localStorage.removeItem("removalSoundPlayedFor");
    setSoundPlayed(false);

    setShowDismissConfirm(false);
    setOpen(false);
  }

  function cancelDismiss() {
    setShowDismissConfirm(false);
  }

  if (loadingUser || loadingDeletions) return null;
  if (error || errorDeletions) return null;

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
      {/* Main Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>New Company for Deletion</DialogTitle>
            <DialogDescription>
              {deletions.length > 0 ? (
                <>
                  <div>
                    {deletions.length} {deletions.length === 1 ? "company has" : "companies have"} been removed by your tsa for subject deletion:
                  </div>
                  <div className="max-h-[300px] overflow-y-auto mt-2">
                    <ul className="list-disc pl-5 space-y-4">
                      {deletions.map((t, i) => {
                        const agentName = agentMap[t.referenceid?.toLowerCase() ?? ""] || "-";
                        return (
                          <li key={i}>
                            <strong>{t.company_name}</strong>
                            <div>
                              Agent: {agentName} <br />
                              Remarks: {t.remarks} <br />
                              Removed on: {formatDate(t.date_removed)} <br />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleDismiss} className="rounded-none p-6">Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dismiss confirmation dialog */}
      <Dialog open={showDismissConfirm} onOpenChange={setShowDismissConfirm}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Confirm Dismiss</DialogTitle>
            <DialogDescription>
              Once you dismiss this alert, you won&apos;t see it again until new deletions are available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDismiss} className="rounded-none p-6">Cancel</Button>
            <Button onClick={confirmDismiss} className="rounded-none p-6">Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

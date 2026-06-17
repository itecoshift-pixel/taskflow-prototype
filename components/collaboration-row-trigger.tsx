"use client";

import React, { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollaborationHubDialog } from "@/components/collaboration-hub-dialog";
import { useUser } from "@/contexts/UserContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { cn } from "@/lib/utils";

interface CollaborationHubRowTriggerProps {
  requestId: string;
  spfNumber: string;
  status?: string;
  collectionName?: string;
  title?: string;
  variant?: "icon" | "button";
  className?: string;
  chatDocId?: string | number;
}

export function CollaborationHubRowTrigger({
  requestId,
  spfNumber,
  status = "PENDING",
  collectionName = "spf_creations",
  title,
  variant = "icon",
  className,
  chatDocId,
}: CollaborationHubRowTriggerProps) {
  const [open, setOpen] = useState(false);
  const { userId } = useUser();
  const { getChatUnreadCount, markChatAsRead } = useNotifications();
  const [userData, setUserData] = useState<{
    userName: string;
    profilePicture?: string;
    userRole: string;
  } | null>(null);

  // The Firestore document ID used for this chat
  const effectiveDocId = chatDocId ? String(chatDocId) : spfNumber;

  // Re-read from context on every render — context state changes will re-render this
  const unreadCount = effectiveDocId ? getChatUnreadCount(effectiveDocId) : 0;
  const hasUnread = unreadCount > 0;

  useEffect(() => {
    if (!userId) return;
    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await res.json();
          setUserData({
            userName: `${data.Firstname || ""} ${data.Lastname || ""}`.trim(),
            profilePicture: data.profilePicture || "",
            userRole: data.Role || "User",
          });
        }
      } catch (e) {
        console.error("Failed to fetch user:", e);
      }
    };
    fetchUser();
  }, [userId]);

  const handleOpen = () => {
    setOpen(true);
    // Immediately clear badge when user clicks to open — persists to localStorage
    if (effectiveDocId) markChatAsRead(effectiveDocId);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    // Also clear on close, in case new messages arrived while dialog was open
    if (!isOpen && effectiveDocId) markChatAsRead(effectiveDocId);
  };

  const dialogNode = (
    <CollaborationHubDialog
      open={open}
      onOpenChange={handleOpenChange}
      requestId={requestId}
      spfNumber={spfNumber}
      collectionName={collectionName}
      currentUserId={userId || ""}
      userName={userData?.userName || "User"}
      profilePicture={userData?.profilePicture}
      userRole={userData?.userRole || "User"}
      status={status}
      title={title || spfNumber}
    />
  );

  if (variant === "button") {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          onClick={handleOpen}
          className={cn(
            "h-9 px-3 rounded-xl flex items-center gap-1.5 border-blue-200 hover:bg-blue-50 hover:border-blue-300 relative",
            hasUnread && "border-red-300 bg-red-50 hover:bg-red-100 hover:border-red-400",
            className
          )}
        >
          <MessageSquare size={14} className={cn("text-blue-600", hasUnread && "text-red-600")} />
          <span className="text-xs font-medium">Chat</span>
          {hasUnread && (
            <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1.5 flex items-center justify-center text-[10px] rounded-full bg-red-600 text-white font-bold shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
        {dialogNode}
      </>
    );
  }

  // ── icon variant (default) ────────────────────────────────────────────────────
  return (
    <>
      <button
        onClick={handleOpen}
        title={hasUnread ? `${unreadCount} unread message${unreadCount > 1 ? "s" : ""}` : "Open collaboration chat"}
        className={cn(
          // Base styles matching the edit/delete/revision buttons in the table
          "relative p-1.5 border border-zinc-200 rounded-none transition-all",
          // Default state
          "text-zinc-400 hover:text-[#be2d2d] hover:border-[#be2d2d]/30 hover:bg-[#be2d2d]/10",
          // Unread state — red tint so it stands out in the row
          hasUnread && "text-red-600 border-red-300 bg-red-50 hover:border-red-400 hover:bg-red-100",
          className
        )}
      >
        {/* Chat icon */}
        <MessageSquare className="w-3.5 h-3.5" />

        {/* Unread badge — overlaid on the upper-right of the icon */}
        {hasUnread && (
          <span
            className={cn(
              "absolute -top-1.5 -right-1.5 z-10",
              "flex items-center justify-center",
              "min-w-[16px] h-4 px-1",
              "rounded-full text-[9px] font-bold leading-none text-white",
              "bg-red-600 border border-white shadow-md",
              // Pulse only when count is fresh (always animate; user can dismiss by opening)
              "animate-pulse"
            )}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {dialogNode}
    </>
  );
}

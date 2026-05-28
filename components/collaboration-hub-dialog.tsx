"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  MessageSquare, Send, X, Minus, Search, ImagePlus, 
  Loader2, Reply, CornerDownRight, ChevronDown, Activity, CheckCircle2,
  Eye, Heart, ThumbsUp, Smile, Lock
} from "lucide-react";
import { dbCollab } from "@/lib/firebase"; 
import { doc, updateDoc, serverTimestamp, arrayUnion, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNotifications } from "@/contexts/NotificationContext";
import { SeenByDialog } from "@/components/seen-by-dialog";

const EspironLogo = () => (
  <div className="flex items-center justify-center size-9 bg-linear-to-br from-[#be2d2d] to-[#5f2828] rounded-xl shadow-lg">
    <div className="relative flex items-center justify-center size-full">
      <MessageSquare size={18} className="text-white" />
      <div className="absolute inset-0 border-2 border-white/20 rounded-xl scale-90" />
    </div>
  </div>
);

interface Message {
  id: string; 
  text: string;
  senderId: string;
  senderName: string;
  senderImage?: string;
  role: string;
  time: string;
  isResolved?: boolean;
  isSystem?: boolean;
  imageUrl?: string;
  seenBy?: string[]; 
  reactions?: Record<string, string[]>; 
  replyTo?: {
    text: string;
    senderName: string;
    senderId?: string;
    originalMsgId?: string; 
  } | null;
  isPrivate?: boolean;
  privateRecipientId?: string;
  privateRecipientName?: string;
}

interface CollaborationHubDialogProps {
  requestId: string;
  spfNumber: string;
  collectionName: string;
  currentUserId: string;
  userName: string;
  profilePicture?: string;
  userRole: string;
  status: string;
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
  // Optional: allow passing numeric id for chat document
  chatDocId?: string | number;
  userDepartment?: string;
}

export function CollaborationHubDialog({
  requestId,
  spfNumber,
  collectionName,
  currentUserId,
  userName,
  profilePicture,
  userRole,
  status,
  title = "dsiconnect",
  open,
  onOpenChange,
  chatDocId,
  userDepartment,
}: CollaborationHubDialogProps) {
  // Use chatDocId if provided, otherwise use spfNumber as document ID for chat
  const effectiveDocId = chatDocId ? String(chatDocId) : spfNumber;
  const [chatMessage, setChatMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lastSeenTime, setLastSeenTime] = useState<number>(Date.now());
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [userNamesMap, setUserNamesMap] = useState<Record<string, { firstName: string; lastName: string; userName: string; profilePicture?: string; department?: string }>>({});
  
  const { updateChatUnreadCount, markChatAsRead } = useNotifications();

  const scrollRef = useRef<HTMLDivElement>(null);
  const unreadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAtBottom = useRef(true);
  const prevMessagesCount = useRef(messages.length);
  const prevStatus = useRef(status);
  const sentSound = useRef<HTMLAudioElement | null>(null);
  const receivedSound = useRef<HTMLAudioElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastReadMessageCount = useRef(0);
  const chatNotifSound = useRef<HTMLAudioElement | null>(null);

  // Fetch messages from Firebase - always listen for notifications even when closed
  useEffect(() => {
    if (!effectiveDocId) return;
    
    // Initialize notification sound
    if (!chatNotifSound.current) {
      chatNotifSound.current = new Audio("/musics/notif-messege-sound.mp3");
      chatNotifSound.current.preload = "auto";
    }
    
    const docRef = doc(dbCollab, collectionName, effectiveDocId);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const newMessages = data.messages || [];
        
        // Check if there are new messages from others while dialog is closed
        if (!open && messages.length > 0 && newMessages.length > messages.length) {
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.senderId !== currentUserId) {
            // Play notification sound
            chatNotifSound.current?.play().catch(() => {});
          }
        }
        
        setMessages(newMessages);
        
        // If dialog is closed, update unread count in notifications
        if (!open && newMessages.length > 0) {
          const unreadCount = newMessages.filter(
            (msg: Message) => 
              msg.senderId !== currentUserId && 
              !msg.seenBy?.includes(currentUserId)
          ).length;
          
          // Only update if there are actually unread messages
          if (unreadCount > 0) {
            updateChatUnreadCount(effectiveDocId, unreadCount);
          }
        }
      }
    }, (error) => {
      console.error("Error fetching messages:", error);
    });

    return () => unsubscribe();
  }, [effectiveDocId, collectionName, open, currentUserId, updateChatUnreadCount, messages.length]);

  // Mark chat as read when dialog opens
  useEffect(() => {
    if (open && effectiveDocId) {
      markChatAsRead(effectiveDocId);
      lastReadMessageCount.current = messages.length;
    }
  }, [open, effectiveDocId, markChatAsRead, messages.length]);

  useEffect(() => {
    sentSound.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
    receivedSound.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
    if (sentSound.current) sentSound.current.volume = 0.3;
    if (receivedSound.current) receivedSound.current.volume = 0.3;
  }, []);

  // Fetch user names for seenBy IDs
  useEffect(() => {
    const fetchUserNames = async () => {
      // Collect all unique user IDs from seenBy arrays (including current user)
      const allUserIds = new Set<string>();
      messages.forEach(msg => {
        msg.seenBy?.forEach(id => {
          allUserIds.add(id);
        });
      });

      if (allUserIds.size === 0) return;

      try {
        const response = await fetch("/api/get-users-by-ids", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: Array.from(allUserIds) })
        });

        if (response.ok) {
          const data = await response.json();
          setUserNamesMap(data.users || {});
        }
      } catch (error) {
        console.error("Failed to fetch user names:", error);
      }
    };

    if (messages.length > 0) {
      fetchUserNames();
    }
  }, [messages]);

  // FEATURE: TYPING INDICATORS (WRITE)
  useEffect(() => {
    const typingRef = doc(dbCollab, "typing_indicators", `${effectiveDocId}_${currentUserId}`);
    if (chatMessage.length > 0) {
      setDoc(typingRef, { userName, updatedAt: serverTimestamp() });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => deleteDoc(typingRef), 3000);
    } else {
      deleteDoc(typingRef);
    }
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      deleteDoc(typingRef);
    };
  }, [chatMessage, effectiveDocId, currentUserId, userName]);

  // Listen to typing indicators from others
  useEffect(() => {
    if (!open || !effectiveDocId) return;
    
    const typingQuery = doc(dbCollab, "typing_indicators", `${requestId}_others`);
    // This is simplified - in production you'd query all typing docs for this request
    
    return () => {};
  }, [open, effectiveDocId]);

  // FEATURE: SYSTEM MESSAGES (STATUS CHANGE)
  useEffect(() => {
    if (prevStatus.current !== status && status !== "PENDING" && open) {
      const injectSystemMessage = async () => {
        try {
          const docRef = doc(dbCollab, collectionName, effectiveDocId);
          await updateDoc(docRef, {
            messages: arrayUnion({
              id: `sys-${Date.now()}`,
              text: `PROJECT STATUS UPDATED TO: ${status}`,
              senderId: "system",
              senderName: "System",
              role: "system",
              time: new Date().toISOString(),
              isSystem: true,
              seenBy: [currentUserId]
            })
          });
        } catch (e) { console.error("System message failed", e); }
      };
      injectSystemMessage();
    }
    prevStatus.current = status;
  }, [status, effectiveDocId, collectionName, currentUserId, open]);

  useEffect(() => {
    if (open && messages.length > 0) {
      const markAsSeen = async () => {
        const needsUpdate = messages.some(
          msg => msg.senderId !== currentUserId && !msg.seenBy?.includes(currentUserId)
        );

        if (needsUpdate) {
          try {
            const updatedMessages = messages.map(msg => {
              if (msg.senderId !== currentUserId && !msg.seenBy?.includes(currentUserId)) {
                return { ...msg, seenBy: [...(msg.seenBy || []), currentUserId] };
              }
              return msg;
            });
            const docRef = doc(dbCollab, collectionName, effectiveDocId); 
            await updateDoc(docRef, { messages: updatedMessages });
            
            // Clear notification count for this chat since all messages are now seen
            if (effectiveDocId) {
              updateChatUnreadCount(effectiveDocId, 0);
            }
          } catch (e) {
            console.error("Failed to update seen status", e);
          }
        }
      };
      markAsSeen();
    }
  }, [open, messages, currentUserId, effectiveDocId, collectionName, updateChatUnreadCount]);

  // Function to check if user can see private messages
  const canSeePrivateMessage = (msg: Message) => {
    if (!msg.isPrivate) return true;
    
    // Message sender can always see their own private messages
    if (msg.senderId === currentUserId) return true;
    
    // Private message recipient can see it
    if (msg.privateRecipientId === currentUserId) return true;
    
    // IT department can see all private messages
    if (userDepartment === "IT") return true;
    
    return false;
  };

  const scrollToMessage = (msgId: string) => {
    const element = document.getElementById(`msg-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("ring-2", "ring-[#dc8c28]", "ring-offset-2", "rounded-xl");
      setTimeout(() => {
        element.classList.remove("ring-2", "ring-[#dc8c28]", "ring-offset-2", "rounded-xl");
      }, 2000);
    } else {
      toast.error("Message not found in history");
    }
  };

  const unreadCount = useMemo(() => {
    return messages.filter(msg => 
      msg.senderId !== currentUserId && 
      !msg.seenBy?.includes(currentUserId)
    ).length;
  }, [messages, currentUserId]);

  const firstUnreadIndex = useMemo(() => {
    return messages.findIndex(msg =>
      msg.senderId !== currentUserId && !msg.seenBy?.includes(currentUserId)
    );
  }, [messages, currentUserId]);

  const filteredMessages = useMemo(() => {
    const visibleMessages = messages.filter(canSeePrivateMessage);
    if (!searchQuery) return visibleMessages;
    return visibleMessages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [messages, searchQuery, currentUserId, userDepartment]);

  // FEATURE: MENTION SUPPORT (RENDER LOGIC)
  const renderMessageText = (text: string) => {
    const mentionRegex = /(@[a-zA-Z0-9 ]+)/g;
    const parts = text.split(mentionRegex);
    return parts.map((part, i) => {
      if (part.match(mentionRegex)) {
        const isMe = part.toLowerCase() === `@${userName.toLowerCase()}`;
        return (
          <span key={i} className={cn(
            "font-black px-1.5 py-0.5 rounded-md",
            isMe ? "bg-[#dc8c28] text-white" : "bg-[#be2d2d]/20 text-[#be2d2d]"
          )}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
      setLastSeenTime(Date.now());
    }
  }, []);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      isAtBottom.current = distanceToBottom < 50;
      setShowScrollButton(distanceToBottom > 100); 
      if (isAtBottom.current && open) setLastSeenTime(Date.now());
    }
  };

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        if (unreadRef.current) unreadRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
        else scrollToBottom("auto");
      }, 200);
    }
  }, [open, scrollToBottom]);

  useEffect(() => {
    if (messages.length > prevMessagesCount.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.senderId !== currentUserId && open) {
        receivedSound.current?.play().catch(() => {});
      }
    }
    prevMessagesCount.current = messages.length;
  }, [messages, currentUserId, open]);

  const sendChat = async (isPrivate = false, recipientId?: string, recipientName?: string) => {
    if (!chatMessage.trim() || isSending) return;
    setIsSending(true);
    const content = chatMessage;
    const currentReply = replyingTo;
    setChatMessage(""); 
    setReplyingTo(null);

    try {
      const docRef = doc(dbCollab, collectionName, effectiveDocId); 
      const newMessage: any = {
        id: Math.random().toString(36).substring(2, 11),
        text: content,
        senderId: currentUserId,
        senderName: userName, 
        senderImage: profilePicture || "",
        role: userRole,
        time: new Date().toISOString(),
        isResolved: false,
        seenBy: [currentUserId],
        reactions: {},
        replyTo: currentReply ? {
          text: currentReply.text || "",
          senderName: currentReply.senderName || "",
          originalMsgId: currentReply.id || ""
        } : null,
      };

      // Only add private fields if the message is private
      if (isPrivate) {
        newMessage.isPrivate = true;
        newMessage.privateRecipientId = recipientId;
        newMessage.privateRecipientName = recipientName;
      }

      try {
        await updateDoc(docRef, {
          messages: arrayUnion(newMessage),
          updatedAt: serverTimestamp()
        });
      } catch (docError: any) {
        // If document doesn't exist, create it
        if (docError.code === 'not-found') {
          await setDoc(docRef, {
            messages: [newMessage],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          throw docError;
        }
      }
      sentSound.current?.play().catch(() => {});
      setLastSeenTime(Date.now());
      setTimeout(() => scrollToBottom("auto"), 100);
    } catch (e) {
      console.error("Firebase send error:", e);
      toast.error("Message failed to send.");
      setChatMessage(content);
    } finally {
      setIsSending(false);
    }
  };

  const toggleReaction = async (msgId: string, emoji: string) => {
    try {
      const docRef = doc(dbCollab, collectionName, effectiveDocId); 
      const updatedMessages = messages.map(m => {
        if (m.id === msgId) {
          const reactions = { ...(m.reactions || {}) };
          const users = reactions[emoji] || [];
          reactions[emoji] = users.includes(currentUserId)
            ? users.filter(id => id !== currentUserId)
            : [...users, currentUserId];
          return { ...m, reactions };
        }
        return m;
      });
      await updateDoc(docRef, { messages: updatedMessages });
      setActiveMessageId(null);
    } catch (e) {
      toast.error("Reaction failed");
    }
  };

  const toggleResolve = async (msgId: string) => {
    try {
      const docRef = doc(dbCollab, collectionName, effectiveDocId); 
      const updatedMessages = messages.map(m => 
        m.id === msgId ? { ...m, isResolved: !m.isResolved } : m
      );
      await updateDoc(docRef, { messages: updatedMessages });
      toast.success("Status updated");
      setActiveMessageId(null);
    } catch (e) {
      toast.error("Failed to update");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-3xl h-[calc(100vh-2rem)] p-0 border-none shadow-2xl rounded-3xl overflow-hidden">
        <DialogTitle className="sr-only">{title} - Collaboration Hub</DialogTitle>
        <div className="flex flex-col h-full bg-gray-100 relative overflow-hidden">
          
          {/* Header */}
          <div className="p-4 bg-linear-to-r from-gray-800 to-gray-900 text-white rounded-b-3xl">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <EspironLogo />
                <div>
                  <h3 className="text-base font-bold tracking-tight text-white">{spfNumber}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse" />
                    <p className="text-xs text-white/70 font-medium uppercase tracking-wider">Online</p>
                    <span className="text-xs text-white/50">•</span>
                    <p className="text-xs text-white/70 font-medium">{title}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10 rounded-full" onClick={() => setIsSearching(!isSearching)}>
                  <Search size={18} />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10 rounded-full" onClick={() => onOpenChange(false)}>
                  <X size={20} />
                </Button>
              </div>
            </div>
            {isSearching && (
              <input
                autoFocus
                className="w-full bg-white/10 border-none rounded-xl px-4 py-2 text-xs text-white placeholder:text-white/40 outline-none ring-1 ring-white/20 focus:ring-[#dc8c28] mt-3"
                placeholder="Search project history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            )}
          </div>

          {/* Messages Area */}
            <div 
              ref={scrollRef} 
              onScroll={handleScroll} 
              onClick={() => setActiveMessageId(null)} 
              className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gray-100 scroll-smooth"
            >
            {filteredMessages.map((msg, i) => {
              // FEATURE: SYSTEM MESSAGE RENDER
              if (msg.isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-4">
                    <span className="px-4 py-1.5 bg-slate-200/50 text-slate-500 text-xs font-black uppercase rounded-full tracking-widest border border-slate-200">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              const isMe = msg.senderId === currentUserId;
              const isFirstUnread = i === firstUnreadIndex;
              const isActive = activeMessageId === msg.id;
              const seenByOthers = msg.seenBy?.filter(id => id !== msg.senderId) || [];

              return (
                <React.Fragment key={msg.id}>
                  {isFirstUnread && (
                    <div ref={unreadRef} className="flex items-center justify-center my-6">
                      <span className="px-4 py-1 bg-[#be2d2d]/10 text-[#be2d2d] text-xs font-black uppercase rounded-full border border-[#be2d2d]/20">
                        New Messages Below
                      </span>
                    </div>
                  )}

                  <div 
                    id={`msg-${msg.id}`} 
                    className={cn("flex gap-3 group relative transition-all duration-300", isMe ? "flex-row-reverse" : "flex-row")}
                  >
                    <Avatar className="h-9 w-9 shrink-0 self-end border-2 border-white shadow-sm">
                      <AvatarImage src={isMe ? profilePicture : msg.senderImage} className="object-cover" />
                      <AvatarFallback className="bg-[#be2d2d] text-xs text-white">{(msg.senderName || "U").charAt(0)}</AvatarFallback>
                    </Avatar>

                    <div className={cn("flex flex-col gap-1 max-w-[75%]", isMe ? "items-end" : "items-start")}>
                      {!isMe && <span className="text-[10px] text-slate-500 font-bold ml-1">{msg.senderName}</span>}
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMessageId(isActive ? null : msg.id);
                        }}
                        className={cn(
                          "px-4 py-2.5 text-[13px] shadow-sm relative transition-all duration-300 cursor-pointer touch-manipulation",
                          isMe ? "bg-[#be2d2d] text-white rounded-2xl rounded-br-none" : "bg-white text-slate-800 rounded-2xl rounded-bl-none",
                          msg.isResolved && "opacity-60 grayscale-[0.5]",
                          isActive && "ring-2 ring-[#dc8c28] ring-offset-1"
                        )}
                      >
                        <div className={cn(
                          "absolute top-full mt-2 flex items-center gap-1 transition-all z-20 bg-white shadow-xl rounded-full p-1 border border-slate-100",
                          (isActive) ? "opacity-100 scale-100 visible" : "opacity-0 scale-95 invisible group-hover:opacity-100 group-hover:scale-100 group-hover:visible",
                          isMe ? "right-0" : "left-0"
                        )}>
                          <button onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, "👍"); }} className="p-1.5 hover:bg-slate-50 rounded-full transition-colors"><ThumbsUp size={14} className="text-[#be2d2d]" /></button>
                          <button onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, "❤️"); }} className="p-1.5 hover:bg-slate-50 rounded-full transition-colors"><Heart size={14} className="text-red-500" /></button>
                          <button onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, "😊"); }} className="p-1.5 hover:bg-slate-50 rounded-full transition-colors"><Smile size={14} className="text-yellow-500" /></button>
                          <div className="w-px h-4 bg-slate-200 mx-1" />
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (!chatMessage.trim()) {
                                setReplyingTo(msg); 
                                setActiveMessageId(null);
                                // Focus on input to encourage typing
                                setTimeout(() => {
                                  const input = document.querySelector('input[placeholder*="Type your message"]') as HTMLInputElement;
                                  if (input) input.focus();
                                }, 100);
                              } else {
                                setReplyingTo(msg); 
                                setShowReplyDialog(true);
                                setActiveMessageId(null);
                              }
                            }} 
                            className="p-1.5 hover:bg-slate-50 rounded-full text-slate-600"
                          >
                            <Reply size={14} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleResolve(msg.id); }} 
                            className="p-1.5 hover:bg-slate-50 rounded-full text-green-600"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        </div>

                        {msg.isResolved && (
                          <div className="flex items-center gap-1 mb-1 text-[9px] font-black uppercase text-green-500 bg-green-50 px-2 py-0.5 rounded-full w-fit">
                            <CheckCircle2 size={10} /> Resolved
                          </div>
                        )}

                        {msg.isPrivate && (
                          <div className="flex items-center gap-1 mb-1 text-[9px] font-black uppercase text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full w-fit">
                            <Lock size={10} /> Private to {msg.privateRecipientName}
                          </div>
                        )}

                        {msg.replyTo && (
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (msg.replyTo?.originalMsgId) scrollToMessage(msg.replyTo.originalMsgId);
                            }}
                            className="mb-2 p-2 bg-black/10 rounded-lg text-[10px] opacity-90 border-l-2 border-white/50 cursor-pointer hover:bg-black/20 transition-all"
                          >
                            <p className="font-bold truncate text-inherit opacity-70">{msg.replyTo.senderName}</p>
                            <p className="truncate line-clamp-1 italic text-inherit">"{msg.replyTo.text}"</p>
                          </div>
                        )}
                        
                        {/* MENTION RENDERING */}
                        <p className="whitespace-pre-wrap leading-relaxed">{renderMessageText(msg.text)}</p>
                        
                        {msg.reactions && Object.entries(msg.reactions).some(([_, users]) => users.length > 0) && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Object.entries(msg.reactions).map(([emoji, users]) => users.length > 0 && (
                              <span key={emoji} className="bg-white/20 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-[10px] border border-white/10">
                                {emoji} {users.length}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className={cn("flex items-center justify-end gap-1 text-[9px] mt-1 opacity-60 font-medium", isMe ? "text-white/80" : "text-slate-400")}>
                          {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <SeenByDialog 
                            seenByIds={msg.seenBy || []} 
                            userNamesMap={userNamesMap} 
                            isMe={isMe}
                            currentUserId={currentUserId}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Scroll to bottom button */}
          {showScrollButton && (
            <button 
              onClick={() => scrollToBottom()}
              className="absolute bottom-28 right-6 h-11 w-11 bg-white border border-slate-200 rounded-full shadow-2xl flex items-center justify-center text-[#be2d2d] hover:scale-110 transition-all z-60 animate-in fade-in zoom-in"
            >
              <ChevronDown size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white">
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-100 relative shadow-[0_-4px_15px_rgba(0,0,0,0.05)] rounded-b-3xl">
            {/* TYPING UI */}
            {typingUsers.length > 0 && (
              <div className="absolute -top-6 left-6 text-[10px] text-slate-400 italic bg-white/80 px-2 py-0.5 rounded-full">
                 Someone is typing...
              </div>
            )}

            {replyingTo && (
              <div className="mb-3 p-2 bg-[#be2d2d]/5 rounded-xl flex items-center justify-between border-l-4 border-[#be2d2d] animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 overflow-hidden text-[11px]">
                  <CornerDownRight size={14} className="text-[#be2d2d] shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-[#be2d2d]">Reply to {replyingTo.senderName}</span>
                    <p className="truncate text-slate-500 italic">"{replyingTo.text}"</p>
                  </div>
                </div>
                <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-red-500 p-1"><X size={16} /></button>
              </div>
            )}
            
            {status !== "APPROVED" && status !== "FINALIZED" ? (
              <div className="flex items-center gap-3">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" />
                <Button size="icon" variant="ghost" disabled={isSending} onClick={() => fileInputRef.current?.click()} className="h-11 w-11 text-slate-400 hover:text-[#be2d2d] hover:bg-[#be2d2d]/10 rounded-2xl transition-colors">
                  <ImagePlus size={20} />
                </Button>
                <input 
                  className="flex-1 bg-slate-100 rounded-2xl px-5 py-3.5 text-sm outline-none border-none focus:ring-2 focus:ring-[#be2d2d]/20 transition-all placeholder:text-slate-400" 
                  placeholder={isSending ? "Syncing..." : "Type your message..."} 
                  value={chatMessage} 
                  disabled={isSending}
                  onChange={(e) => setChatMessage(e.target.value)} 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (replyingTo && chatMessage.trim()) {
                        setShowReplyDialog(true);
                      } else {
                        sendChat();
                      }
                    }
                  }}
                />
                <Button 
                  size="icon" 
                  onClick={() => {
                    if (replyingTo && chatMessage.trim()) {
                      setShowReplyDialog(true);
                    } else {
                      sendChat();
                    }
                  }} 
                  disabled={!chatMessage.trim() || isSending} 
                  className="bg-[#be2d2d] hover:bg-[#8c2323] h-11 w-11 rounded-2xl shadow-lg transition-all active:scale-95"
                >
                  {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </Button>
              </div>
            ) : (
              <div className="py-2 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Project Archive Read Only
              </div>
            )}
          </div>
        </div>

        {/* Reply Dialog */}
        {showReplyDialog && replyingTo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">Reply to Message</h3>
                <button 
                  onClick={() => {
                    setShowReplyDialog(false);
                    setReplyingTo(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="mb-4 p-3 bg-slate-50 rounded-xl border-l-4 border-slate-300">
                <p className="text-sm font-medium text-slate-700">{replyingTo.senderName}</p>
                <p className="text-sm text-slate-600 italic">"{replyingTo.text}"</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (!chatMessage.trim()) {
                      toast.error("Please type a message first");
                      return;
                    }
                    setShowReplyDialog(false);
                    // Send public reply
                    sendChat();
                  }}
                  disabled={!chatMessage.trim()}
                  className="w-full p-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
                >
                  Reply Publicly
                </button>
                
                <button
                  onClick={() => {
                    if (!chatMessage.trim()) {
                      toast.error("Please type a message first");
                      return;
                    }
                    setShowReplyDialog(false);
                    // Send private reply
                    sendChat(true, replyingTo.senderId, replyingTo.senderName);
                  }}
                  disabled={!chatMessage.trim()}
                  className="w-full p-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Lock size={16} />
                  Reply Privately
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

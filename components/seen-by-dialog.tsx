"use client";

import React from "react";
import { Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface SeenByUser {
  firstName: string;
  lastName: string;
  userName: string;
  profilePicture?: string;
  department?: string;
}

interface SeenByDialogProps {
  seenByIds: string[];
  userNamesMap: Record<string, SeenByUser>;
  isMe: boolean;
  currentUserId: string;
}

export function SeenByDialog({ seenByIds, userNamesMap, isMe, currentUserId }: SeenByDialogProps) {
  if (seenByIds.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button 
          className="flex items-center gap-0.5 ml-1 hover:opacity-100 transition-opacity cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <Eye size={10} />
          <span>{seenByIds.length}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Seen by</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {seenByIds.map((userId) => {
            const isCurrentUser = userId === currentUserId;
            const user = userNamesMap[userId];
            
            // Show "You" for current user, or user data from map
            if (isCurrentUser) {
              return (
                <div
                  key={userId}
                  className="flex items-center gap-3 p-2 rounded-lg bg-blue-50 border border-blue-200"
                >
                  <Avatar className="h-12 w-12 border-2 border-blue-400">
                    <AvatarImage 
                      src={user?.profilePicture} 
                      alt="You"
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-blue-600 text-white font-semibold">
                      You
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-blue-700 truncate">
                      You {user ? `(${user.firstName} ${user.lastName})` : ''}
                    </p>
                    {user?.department && (
                      <p className="text-xs text-blue-600 truncate">
                        @{user.department}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            if (!user) return null;

            return (
              <div
                key={userId}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Avatar className="h-12 w-12 border-2 border-slate-200">
                  <AvatarImage 
                    src={user.profilePicture} 
                    alt={`${user.firstName} ${user.lastName}`}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-blue-600 text-white font-semibold">
                    {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-900 truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  {user.department && (
                    <p className="text-xs text-slate-500 truncate">
                      @{user.department}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

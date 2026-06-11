"use client";

import React, { Suspense } from "react";
import ProfileClient from "@/components/general/edit";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";


export default function ProfilePage() {
  return (
    <ProtectedPageWrapper>
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-screen gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 animate-pulse">
            Loading Profile...
          </p>
        </div>
      }>
        <ProfileClient />
      </Suspense>
    </ProtectedPageWrapper>
  );
}

"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
} from "react";
import { supabase } from "@/utils/supabase";
import { useUser } from "@/contexts/UserContext";
import { sileo } from "sileo";

interface QuotationNotification {
  id: string;
  quotationNumber: string;
  companyName: string;
  activityReferenceNumber: string;
  tsm: string;
  dateCreated: string;
}

interface QuotationNotificationContextValue {
  showQuotationNotification: (quotation: QuotationNotification) => void;
  testQuotationNotification: () => void;
}

const QuotationNotificationContext = createContext<QuotationNotificationContextValue>({
  showQuotationNotification: () => {},
  testQuotationNotification: () => {},
});

export function QuotationNotificationProvider({ children }: { children: React.ReactNode }) {
  const { userId, user } = useUser();
  const [referenceid, setReferenceid] = useState<string | null>(null);
  const quotationAudioRef = useRef<HTMLAudioElement | null>(null);

  // ─── Initialize quotation audio ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!quotationAudioRef.current) {
      quotationAudioRef.current = new Audio("/quotation-req.mp3");
      quotationAudioRef.current.preload = "auto";
      console.log("🔔 Quotation Context: Using quotation-req.mp3 for notifications");
    }
  }, []);

  // ─── Update referenceid from user context ───────────────────────────────────────────
  useEffect(() => {
    if (!userId || !user) {
      setReferenceid(null);
      return;
    }

    const refId = user.ReferenceID || "";
    console.log("🔔 Quotation Context: Got referenceid from user context:", refId);
    setReferenceid(refId);
  }, [userId, user]);

  // ─── Play quotation notification sound ───────────────────────────────────────────────
  const playQuotationNotificationSound = useCallback(() => {
    console.log("🔔 Quotation Context: Playing sound...");
    
    const audio = quotationAudioRef.current;
    if (!audio) {
      console.log("🔔 Quotation Context: No audio element found");
      return;
    }
    
    console.log("🔔 Quotation Context: ✅ Audio element found");
    audio.currentTime = 0;
    audio.play().then(() => {
      console.log("🔔 Quotation Context: ✅ Audio played successfully");
    }).catch((error) => {
      console.log("🔔 Quotation Context: ❌ Audio play failed:", error);
    });
  }, []);

  // ─── Show quotation notification ─────────────────────────────────────────────────────
  const showQuotationNotification = useCallback((quotation: QuotationNotification) => {
    console.log("🔔 Quotation Context: 🚨 CALLED with:", quotation);
    console.log("🔔 Quotation Context: 🚨 Page:", window.location.pathname);
    
    try {
      // Play the quotation notification sound
      console.log("🔔 Quotation Context: 🚨 STEP 1: Playing sound...");
      playQuotationNotificationSound();
      
      // Show toast notification - ALWAYS use manual toast with click handler
      console.log("🔔 Quotation Context: 🚨 STEP 2: Creating manual toast with click navigation...");
      
      // Create manual toast with click to navigate
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        color: #1e293b;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        z-index: 9999;
        min-width: 300px;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        border-left: 4px solid #2563eb;
        cursor: pointer;
      `;
      toast.innerHTML = `
        <div style="color: #2563eb; font-weight: bold; margin-bottom: 5px;">📋 New Quotation Request (Click to Review)</div>
        <div style="color: #374151; font-weight: 500;">${quotation.companyName} - ${quotation.quotationNumber}</div>
        <div style="color: #64748b; font-size: 12px; margin-top: 5px;">Click to open in Pending Quotations</div>
      `;
      
      // Add click handler to navigate to pending page
      toast.addEventListener('click', () => {
        console.log("🔔 Quotation Context: Toast clicked, navigating to pending page for quotation:", quotation.id);
        // Store the quotation ID to highlight it on the pending page
        localStorage.setItem('highlightQuotationId', quotation.id);
        // Navigate to pending page
        window.location.href = `/roles/tsm/activity/quotation/pending`;
      });
      
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.style.transform = 'translateX(0)';
      }, 100);
      
      setTimeout(() => {
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast);
          }
        }, 300);
      }, 8000);
      
      console.log("🔔 Quotation Context: 🚨 ✅ Manual toast displayed successfully with click navigation");
      
      console.log("🔔 Quotation Context: 🚨 ✅ Notification process completed successfully");
    } catch (error) {
      console.log("🔔 Quotation Context: 🚨 ❌ ERROR:", error);
    }
  }, [playQuotationNotificationSound]);

  // ─── Manual test function ─────────────────────────────────────────────────────────────
  const testQuotationNotification = useCallback(() => {
    console.log("🔔 Quotation Context: Manual test triggered");
    
    const testQuotation: QuotationNotification = {
      id: 'test-' + Date.now(),
      quotationNumber: 'Q-TEST-' + Math.floor(Math.random() * 1000),
      companyName: 'Test Company (Manual)',
      activityReferenceNumber: 'ACT-TEST',
      tsm: referenceid || 'unknown',
      dateCreated: new Date().toISOString(),
    };
    
    console.log("🔔 Quotation Context: Manual test with:", testQuotation);
    showQuotationNotification(testQuotation);
  }, [referenceid, showQuotationNotification]);

  // ─── Fetch activities like pending page - API CALLS NEEDED ─────────────────────────────
  const fetchActivities = useCallback(async () => {
    if (!referenceid) return;

    console.log("🔔 Quotation Context: Fetching activities for referenceid:", referenceid);

    try {
      const url = new URL("/api/activity/tsm/quotation/fetch", window.location.origin);
      url.searchParams.append("referenceid", referenceid);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`Failed to fetch activities (${res.status})`);
      const data = await res.json();
      console.log("🔔 Quotation Context: Activities fetched successfully:", data.activities?.length || 0);
    } catch (err: any) {
      console.log("🔔 Quotation Context: Error fetching activities:", err.message);
    }
  }, [referenceid]);

  // ─── Global TSM Quotation notification listener (Supabase) - WORKS ON ALL PAGES ─────────────────────────────
  useEffect(() => {
    if (!referenceid) {
      console.log("🔔 Quotation Context: No referenceid available, waiting...");
      return;
    }

    console.log("🔔 Quotation Context: Setting up GLOBAL listener for referenceid:", referenceid);
    console.log("🔔 Quotation Context: Current page:", window.location.pathname);
    
    // Fetch activities on mount like pending page
    fetchActivities();

    console.log("🔔 Quotation Context: 🔄 Creating NEW subscription for referenceid:", referenceid);
console.log("🔔 Quotation Context: 🔄 Current page:", window.location.pathname);
console.log("🔔 Quotation Context: 🔄 Timestamp:", new Date().toISOString());

const channel = supabase
        .channel(`quotation-global-${referenceid}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "history",
                filter: `tsm=eq.${referenceid}`,
            },
            async (payload) => {
                console.log("🔔 Quotation Context: 🚨 GLOBAL PAYLOAD RECEIVED!");
                console.log("🔔 Quotation Context: 🚨 Event type:", payload.eventType);
                console.log("🔔 Quotation Context: 🚨 Page:", window.location.pathname);
                console.log("🔔 Quotation Context: 🚨 Timestamp:", new Date().toISOString());
                console.log("🔔 Quotation Context: 🚨 Payload data:", payload);
                
                // Always refresh data like pending page
                fetchActivities();
                
                if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new) {
                    const newRecord = payload.new as any;
                    console.log("🔔 Quotation Context: 🚨 Processing new/updated record:", newRecord);
                    
                    if (newRecord.type_activity === 'Quotation Preparation' && 
                        newRecord.tsm_approved_status === 'Pending') {
                        
                        console.log("🔔 Quotation Context: ✅ CONDITIONS MET - TRIGGERING GLOBAL NOTIFICATION");
                        
                        const quotation: QuotationNotification = {
                            id: newRecord.id?.toString() || '',
                            quotationNumber: newRecord.quotation_number || 'Unknown',
                            companyName: newRecord.company_name || 'Unknown Company',
                            activityReferenceNumber: newRecord.activity_reference_number || '',
                            tsm: newRecord.tsm || '',
                            dateCreated: newRecord.date_created || new Date().toISOString(),
                        };
                        
                        console.log("🔔 Quotation Context: 🚨 Calling showQuotationNotification with:", quotation);
                        showQuotationNotification(quotation);
                        console.log("🔔 Quotation Context: 🚨 ✅ Notification process completed");
                    } else {
                        console.log("🔔 Quotation Context: ❌ CONDITIONS NOT MET", {
                            type_activity: newRecord.type_activity,
                            tsm_approved_status: newRecord.tsm_approved_status
                        });
                    }
                } else {
                    console.log("🔔 Quotation Context: ❌ NOT INSERT/UPDATE OR NO NEW DATA", {
                        eventType: payload.eventType,
                        hasNew: !!payload.new,
                        hasOld: !!payload.old
                    });
                }
            }
        )
        .subscribe((status) => {
            console.log("🔔 Quotation Context: 🔄 Subscription status:", status);
            if (status === 'SUBSCRIBED') {
                console.log("🔔 Quotation Context: 🔄 ✅ Subscription ACTIVE - listening for changes");
            } else if (status === 'CHANNEL_ERROR') {
                console.log("🔔 Quotation Context: 🔄 ❌ Subscription ERROR - check connection");
            }
        });

    return () => { 
        supabase.removeChannel(channel); 
    };
  }, [referenceid, showQuotationNotification, fetchActivities]);

  // ─── Make test function available globally for console testing ─────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.testQuotationNotification = testQuotationNotification;
      console.log("🔔 Quotation Context: window.testQuotationNotification() available for manual testing");
    }
  }, [testQuotationNotification]);

  return (
    <QuotationNotificationContext.Provider value={{
      showQuotationNotification,
      testQuotationNotification,
    }}>
      {children}
    </QuotationNotificationContext.Provider>
  );
}

export function useQuotationNotifications() {
  const context = useContext(QuotationNotificationContext);
  if (!context) {
    throw new Error("useQuotationNotifications must be used within a QuotationNotificationProvider");
  }
  return context;
}

// Extend Window interface for global test function
declare global {
  interface Window {
    testQuotationNotification?: () => void;
  }
}

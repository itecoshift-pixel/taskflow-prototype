// /pages/api/activity/tsa/breaches/fetch-activity.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 500;
const HISTORY_CHUNK_SIZE = 200;
const ALLOWED_STATUSES = ["Assisted", "Quote-Done"];

function toLocalDateString(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

/* ------------------ Fetch overdue activities ------------------ */
async function fetchOverdueActivities(referenceid: string, fields: string = "*") {
  const todayStr = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });

  let allActivities: any[] = [];
  let offset = 0;
  const MAX_RECORDS = 5000;

  while (offset < MAX_RECORDS) {
    const { data, error } = await supabase
      .from("activity")
      .select(fields)
      .eq("referenceid", referenceid)
      .in("status", ALLOWED_STATUSES)
      .lt("scheduled_date", todayStr) // server-side: past dates only
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allActivities.push(...data);
    if (data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return allActivities;
}

export const config = {
  api: {
    responseLimit: false,
  },
};

/* ------------------ Fetch history for activity refs ------------------ */
async function fetchHistoryForActivities(activityRefs: string[]) {
  if (!activityRefs.length) return [];

  const uniqueRefs = [...new Set(activityRefs)];
  const allHistory: any[] = [];

  for (let i = 0; i < uniqueRefs.length; i += HISTORY_CHUNK_SIZE) {
    const chunk = uniqueRefs.slice(i, i + HISTORY_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("history")
      .select("activity_reference_number, call_type")
      .in("activity_reference_number", chunk);

    if (error) throw error;
    if (data) allHistory.push(...data);
  }

  return allHistory;
}

/* ------------------ API Handler ------------------ */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { referenceid, fields } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const selectFields = typeof fields === "string" ? fields : "*";

  try {
    // 1️⃣ Fetch overdue activities (past dates, allowed statuses only)
    const overdueActivities = await fetchOverdueActivities(referenceid, selectFields);

    if (!overdueActivities.length) {
      return res.status(200).json({ activities: [] });
    }

    // 2️⃣ Fetch history (call_type only — lightweight) for all activity refs
    const activityRefs = overdueActivities
      .map((a) => a.activity_reference_number)
      .filter(Boolean);

    const historyItems = await fetchHistoryForActivities(activityRefs);

    // Build a lookup: activity_reference_number → call_type[]
    const callTypeMap = new Map<string, string[]>();
    for (const h of historyItems) {
      if (!h.activity_reference_number) continue;
      const existing = callTypeMap.get(h.activity_reference_number) ?? [];
      existing.push(h.call_type?.trim() ?? "");
      callTypeMap.set(h.activity_reference_number, existing);
    }

    // 3️⃣ Apply the same filter as the frontend:
    // Assisted items must have at least one history row with call_type === "For Sched"
    const filtered = overdueActivities.filter((a) => {
      if (a.status === "Assisted") {
        const callTypes = callTypeMap.get(a.activity_reference_number) ?? [];
        return callTypes.includes("For Sched");
      }
      return true; // Quote-Done passes through
    });

    return res.status(200).json({ activities: filtered });
  } catch (err: any) {
    console.error("[fetch-activity] handler error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}
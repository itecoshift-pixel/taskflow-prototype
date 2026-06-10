// /pages/api/activity/tsm/breaches/fetch-activity.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 500;

// Based on overdue.tsx: only these statuses are considered overdue
const ALLOWED_STATUSES = ["Assisted", "Quote-Done"];

function toLocalDateString(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

/* ------------------ Fetch overdue activities ------------------ */
async function fetchOverdueActivities(tsm: string, fields: string = "*") {
  console.log("📌 fetchOverdueActivities:", { tsm });

  let allActivities: any[] = [];
  let offset = 0;
  const MAX_RECORDS = 5000;

  const todayStr = toLocalDateString(new Date());

  while (offset < MAX_RECORDS) {
    try {
      const { data, error } = await supabase
        .from("activity")
        .select(fields)
        .eq("tsm", tsm)
        .in("status", ALLOWED_STATUSES) // Only show statuses that can be overdue
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      // Only past dates, exclude today/future
      const filtered = data.filter((a) => {
        const itemScheduledDate = toLocalDateString(a.scheduled_date);
        
        // ❗ ALWAYS exclude TODAY (based on overdue.tsx)
        if (itemScheduledDate === todayStr) {
          return false;
        }

        // past only (still safe)
        if (itemScheduledDate > todayStr) {
          return false;
        }

        return true;
      });

      allActivities.push(...filtered);

      if (data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    } catch (err) {
      console.error("❌ Error fetching overdue activities batch:", offset, err);
      throw err;
    }
  }

  console.log("✅ Total overdue activities fetched:", allActivities.length);
  return allActivities;
}

export const config = {
  api: {
    responseLimit: false,
  },
};

/* ------------------ API Handler ------------------ */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("📥 fetch-activity called with query:", req.query);

  const { tsm, fields } = req.query;

  if (!tsm || typeof tsm !== "string") {
    console.warn("⚠️ Missing or invalid tsm parameter");
    return res.status(400).json({ message: "Missing or invalid tsm" });
  }

  const selectFields = typeof fields === "string" ? fields : "*";

  try {
    // 1️⃣ Fetch overdue activities (past days only)
    const overdueActivities = await fetchOverdueActivities(tsm, selectFields);

    console.log("✅ Overdue activities to return:", overdueActivities.length);

    return res.status(200).json({
      activities: overdueActivities,
    });
  } catch (err: any) {
    console.error("🔥 fetch-activity handler error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

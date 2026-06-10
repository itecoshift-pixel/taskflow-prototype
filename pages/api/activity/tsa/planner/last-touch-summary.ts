import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { referenceid } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ success: false, error: "Missing referenceid" });
  }

  try {
    // 1. Fetch only the necessary columns for last touch calculation
    // We fetch in batches if needed, but we only need account_reference_number and date_created
    const BATCH_SIZE = 1000;
    let lastTouchMap: Record<string, string> = {};
    let offset = 0;
    let hasMore = true;
    const MAX_RECORDS = 10000; // Increased safety cap for this specific summary

    while (hasMore && offset < MAX_RECORDS) {
      const { data, error } = await supabase
        .from("history")
        .select("account_reference_number, date_created")
        .eq("referenceid", referenceid)
        .order("date_created", { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      data.forEach((item) => {
        const ref = item.account_reference_number?.toLowerCase().trim();
        if (ref && !lastTouchMap[ref]) {
          lastTouchMap[ref] = item.date_created;
        }
      });

      if (data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
      
      // Optimization: If we've already found a lot of accounts, we might not need to fetch more
      // but for "No Activity" we need to be thorough. 
      // However, ordering by date_created DESC ensures we get the LATEST first.
    }

    return res.status(200).json({
      success: true,
      lastTouchMap,
    });
  } catch (error: any) {
    console.error("Error in last-touch-summary API:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch last touch summary" });
  }
}

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000;

// Async generator to fetch history in batches by Manager
async function* fetchManagerHistoryBatches(manager: string, fields: string = "*") {
  let lastId: number | null = null;
  let totalFetched = 0;
  const MAX_RECORDS = 10000;

  while (totalFetched < MAX_RECORDS) {
    let query = supabase
      .from("history")
      .select(fields)
      .eq("manager", manager)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) query = query.gt("id", lastId);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || (data as any[]).length === 0) break;

    yield data;
    totalFetched += (data as any[]).length;

    lastId = (data as any[])[(data as any[]).length - 1].id;
    if ((data as any[]).length < BATCH_SIZE) break;
  }
}

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, fields } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const selectFields = typeof fields === "string" ? fields : "*";

  try {
    // ---------------- Fetch from Supabase in batches ----------------
    const activities: any[] = [];
    for await (const batch of fetchManagerHistoryBatches(referenceid, selectFields)) {
      activities.push(...batch);
    }

    return res.status(200).json({ activities, cached: false });
  } catch (err: any) {
    console.error("Server error:", err);
    if (!res.writableEnded) {
      return res.status(500).json({ message: err.message || "Server error" });
    }
  }
}
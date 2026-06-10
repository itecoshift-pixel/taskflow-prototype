import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000;

// Async generator to fetch activity in batches by TSM
async function* fetchActivityBatches(tsm?: string, fields: string = "*") {
  let lastId: number | null = null;
  let totalFetched = 0;
  const MAX_RECORDS = 10000;

  while (totalFetched < MAX_RECORDS) {
    let query = supabase
      .from("activity")
      .select(fields)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (tsm) query = query.eq("tsm", tsm);
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
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { referenceid, fields } = req.query;

  if (referenceid && typeof referenceid !== "string") {
    return res.status(400).json({ error: "Invalid referenceid" });
  }

  const selectFields = typeof fields === "string" ? fields : "*";

  try {
    // ---------------- Fetch from Supabase in batches ----------------
    const activities: any[] = [];
    for await (const batch of fetchActivityBatches(referenceid as string | undefined, selectFields)) {
      activities.push(...batch);
    }

    return res.status(200).json({ success: true, data: activities });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
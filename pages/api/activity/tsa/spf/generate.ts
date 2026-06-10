import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000;

// Fetch all SPF records in batches (optionally filter by date)
async function* fetchAllSPFBatches(fromDate?: string, toDate?: string, fields: string = "*") {
  let lastId: number | null = null;
  let totalFetched = 0;
  const MAX_RECORDS = 5000;

  while (totalFetched < MAX_RECORDS) {
    let query = supabase
      .from("spf_request")
      .select(fields)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) query = query.gt("id", lastId);
    if (fromDate && toDate) query = query.gte("date_created", fromDate).lte("date_created", toDate);

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
  const { from, to, fields } = req.query;

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;
  const selectFields = typeof fields === "string" ? fields : "*";

  try {
    res.setHeader("Content-Type", "application/json");
    res.write(`{"activities":[`); // start JSON array
    let first = true;
    let total = 0;

    for await (const batch of fetchAllSPFBatches(fromDate, toDate, selectFields)) {
      for (const row of batch) {
        const json = JSON.stringify(row);
        res.write(first ? json : `,${json}`);
        first = false;
        total++;
      }
    }

    res.write(`],"total":${total},"cached":false}`);
    res.end();
  } catch (err: any) {
    console.error("Server error:", err);
    if (!res.writableEnded) {
      res.status(500).json({ message: err.message || "Server error" });
    }
  }
}
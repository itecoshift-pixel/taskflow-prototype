import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000;

async function* fetchHistoryBatches(
  referenceid: string,
  fromDate?: string,
  toDate?: string,
  fields: string = "*"
) {
  let lastId: number | null = null;
  let totalFetched = 0;
  const MAX_RECORDS = 5000;

  while (totalFetched < MAX_RECORDS) {
    let query = supabase
      .from("spf_request")
      .select(fields)
      .eq("tsm", referenceid)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) query = query.gt("id", lastId);
    if (fromDate && toDate) query = query.gte("date_created", fromDate).lte("date_created", toDate);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || (data as any[]).length === 0) break;

    // Fetch status and creation id from spf_creation table for each SPF request
    const spfNumbers = (data as any[]).map(item => item.spf_number).filter(Boolean);
    let statusMap = new Map();
    let creationIdMap = new Map();
    
    if (spfNumbers.length > 0) {
      const { data: creationData, error: creationError } = await supabase
        .from("spf_creation")
        .select("id, spf_number, status")
        .in("spf_number", spfNumbers);
      
      if (creationError) {
        console.error("Error fetching data from spf_creation:", creationError);
      } else if (creationData) {
        statusMap = new Map(creationData.map(item => [item.spf_number, item.status]));
        creationIdMap = new Map(creationData.map(item => [item.spf_number, item.id]));
      }
    }

    // Merge status and creation id into the data
    const mergedData = (data as any[]).map(item => ({
      ...item,
      status: statusMap.get(item.spf_number) || item.status || "pending",
      spf_creation_id: creationIdMap.get(item.spf_number) || null
    }));

    yield mergedData;
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
  const { referenceid, from, to, fields } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;
  const selectFields = typeof fields === "string" ? fields : "*";

  try {
    res.setHeader("Content-Type", "application/json");
    res.write(`{"activities":[`); // start JSON array
    let first = true;
    let total = 0;

    for await (const batch of fetchHistoryBatches(referenceid, fromDate, toDate, selectFields)) {
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

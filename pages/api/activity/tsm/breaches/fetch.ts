import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000;

async function fetchAllRows(table: string, referenceid: string, fromDate?: string, toDate?: string, fields: string = "*") {
  let allData: any[] = [];
  let offset = 0;
  const MAX_RECORDS = 5000; // Safety cap

  while (offset < MAX_RECORDS) {
    let query = supabase
      .from(table)
      .select(fields)
      .eq("tsm", referenceid)
      .order("date_created", { ascending: false })
      .order("id", { ascending: false }) // secondary sort to avoid skipping
      .range(offset, offset + BATCH_SIZE - 1);

    if (fromDate) {
      query = query.gte("date_created", fromDate);
    }
    if (toDate) {
      const d = new Date(toDate);
      d.setHours(23, 59, 59, 999);
      query = query.lte("date_created", d.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) break;

    allData.push(...data);

    if (data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return allData;
}

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { tsm, from, to, fields } = req.query;

  if (!tsm || typeof tsm !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;
  // We'll use '*' to avoid errors if some tables lack specific columns
  const selectFields = "*";

  try {
    /* -------------------- 1️⃣ ACTIVITY (Current) -------------------- */
    const activityData = await fetchAllRows("activity", tsm, fromDate, toDate, selectFields);

    /* -------------------- 2️⃣ HISTORY -------------------- */
    const historyData = await fetchAllRows("history", tsm, fromDate, toDate, selectFields);

    /* -------------------- 3️⃣ REVISED QUOTATIONS -------------------- */
    const revisedData = await fetchAllRows("revised_quotations", tsm, fromDate, toDate, selectFields);

    /* -------------------- 4️⃣ MEETINGS -------------------- */
    const meetingsData = await fetchAllRows("meetings", tsm, fromDate, toDate, selectFields);

    const documentationData = await fetchAllRows("documentation", tsm, fromDate, toDate, selectFields);

    /* -------------------- 5️⃣ NORMALIZE + MERGE -------------------- */
    const activities = [
      ...(activityData || []).map((item) => ({ ...item, table_source: "activity" })),
      ...(historyData || []).map((item) => ({ ...item, table_source: "history" })),
      ...(revisedData || []).map((item) => ({ ...item, table_source: "revised_quotations" })),
      ...(meetingsData || []).map((item) => ({ ...item, table_source: "meeting" })),
      ...(documentationData || []).map((item) => ({ ...item, table_source: "documentation" })),
    ].sort(
      (a, b) =>
        new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    );

    return res.status(200).json({ activities });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

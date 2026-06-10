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

    if (fromDate && toDate) {
      query = query.gte("date_created", fromDate).lte("date_created", toDate);
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
  const selectFields = typeof fields === "string" ? fields : "*";

  try {
    /* -------------------- 1️⃣ HISTORY -------------------- */
    const historyData = await fetchAllRows("history", tsm, fromDate, toDate, selectFields);

    /* -------------------- 2️⃣ REVISED QUOTATIONS -------------------- */
    const revisedData = await fetchAllRows("revised_quotations", tsm, fromDate, toDate, selectFields);

    /* -------------------- 3️⃣ MEETINGS -------------------- */
    const meetingsData = await fetchAllRows("meetings", tsm, fromDate, toDate, selectFields);

    const documentationData = await fetchAllRows("documentation", tsm, fromDate, toDate, selectFields);

    /* -------------------- 4️⃣ NORMALIZE + MERGE -------------------- */
    const activities = [
      ...(historyData || []).map((item) => ({ source: "history", ...item })),
      ...(revisedData || []).map((item) => ({ source: "revised_quotations", ...item })),
      ...(meetingsData || []).map((item) => ({ source: "meeting", ...item })),
      ...(documentationData || []).map((item) => ({ source: "documentation", ...item })),
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

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000;

// Async generator to fetch any table in batches
async function* fetchTableBatches(
  table: string,
  manager: string,
  from?: string,
  to?: string,
  fields: string = "*"
) {
  let lastId: number | null = null;
  let totalFetched = 0;
  const MAX_RECORDS = 5000;

  while (totalFetched < MAX_RECORDS) {
    let query = supabase
      .from(table)
      .select(fields)
      .eq("manager", manager)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) query = query.gt("id", lastId);
    if (from) query = query.gte("date_created", from);
    if (to) query = query.lte("date_created", to);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || (data as any[]).length === 0) break;

    yield data;
    totalFetched += (data as any[]).length;
    lastId = (data as any[])[(data as any[]).length - 1].id;
    if ((data as any[]).length < BATCH_SIZE) break;
  }
}

// Normalize each table to a common structure
function normalizeRecord(item: any, source: string) {
  switch (source) {
    case "history":
      return { ...item, type_activity: item.type_activity, start_date: item.start_date, end_date: item.end_date, source: item.source };
    case "documentation":
      return { ...item, type_activity: item.doc_type || "Documentation", start_date: item.start_date || null, end_date: item.end_date || null, source };
    case "revised_quotations":
      return { ...item, type_activity: "Revised Quotation", start_date: item.start_date || null, end_date: item.end_date || item.date_created || null, source };
    case "meetings":
      return { ...item, type_activity: "Client Meeting", start_date: item.start_date || null, end_date: item.end_date || item.meeting_start || null, source };
    default:
      return { ...item, type_activity: "Unknown", start_date: null, end_date: null, source };
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
    return res.status(400).json({ message: "referenceid (manager) is required" });
  }

  const fromDate = typeof from === "string" ? `${from}T00:00:00Z` : undefined;
  const toDate   = typeof to   === "string" ? `${to}T23:59:59Z`   : undefined;
  const selectFields = typeof fields === "string" ? fields : "*";

  try {
    // Tables to fetch — each runs independently so one failure doesn't kill the rest
    const tables = ["history", "documentation", "revised_quotations", "meetings"];
    const allActivities: any[] = [];

    for (const table of tables) {
      try {
        for await (const batch of fetchTableBatches(table, referenceid, fromDate, toDate, selectFields)) {
          const normalizedBatch = batch.map((item) => normalizeRecord(item, table));
          allActivities.push(...normalizedBatch);
        }
      } catch (tableErr: any) {
        // Table may not exist or have no manager column — skip silently
        console.warn(`manager-all-agent-history: skipping table "${table}":`, tableErr?.message);
      }
    }

    // Sort by date_created / start_date descending
    allActivities.sort(
      (a, b) =>
        new Date(b.date_created || b.start_date).getTime() -
        new Date(a.date_created || a.start_date).getTime()
    );

    return res.status(200).json({ activities: allActivities });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

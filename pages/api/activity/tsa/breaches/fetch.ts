import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 500;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;
const HARD_MAX_FOR_FETCH_ALL = 10000; // For fetchAll mode, allow up to 10k per request

async function fetchAllRows(
  table: string,
  referenceid: string,
  fromDate?: string,
  toDate?: string,
  limit?: number,
  fields: string = "*"
) {
  let allData: any[] = [];
  let offset = 0;
  let hasMore = false;

  while (true) {
    let query = supabase
      .from(table)
      .select(fields)
      .eq("referenceid", referenceid)
      .order("date_created", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (fromDate) query = query.gte("date_created", fromDate);
    if (toDate) {
      const d = new Date(toDate);
      d.setHours(23, 59, 59, 999);
      query = query.lte("date_created", d.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) break;

    // Check if adding this batch would exceed the limit
    if (limit && allData.length + data.length > limit) {
      const remaining = limit - allData.length;
      allData.push(...data.slice(0, remaining));
      hasMore = true;
      break;
    }

    allData.push(...data);

    if (data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;

    // Stop if we've reached the limit
    if (limit && allData.length >= limit) {
      hasMore = true;
      break;
    }
  }

  return { data: allData, hasMore };
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
  const { referenceid, from, to, limit, fetchAll, cursor, fields } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  // Check if this is a fetch-all request
  const isFetchAll = fetchAll === "true";
  // We'll use '*' to avoid errors if some tables lack specific columns
  const selectFields = "*";

  // Parse limit - allow higher limit for fetchAll mode but cap at HARD_MAX
  let parsedLimit: number;
  if (isFetchAll) {
    parsedLimit = Math.min(
      parseInt(typeof limit === "string" ? limit : String(HARD_MAX_FOR_FETCH_ALL), 10) || HARD_MAX_FOR_FETCH_ALL,
      HARD_MAX_FOR_FETCH_ALL
    );
  } else {
    parsedLimit = Math.min(
      parseInt(typeof limit === "string" ? limit : String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      MAX_LIMIT
    );
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;
  const cursorDate = typeof cursor === "string" ? cursor : undefined;

  try {
    // Per-table limit to distribute the load
    const perTableLimit = Math.ceil(parsedLimit / 5);

    /* -------------------- 1️⃣ ACTIVITY (Current) -------------------- */
    const { data: activityData, hasMore: activityHasMore } = await fetchAllRows(
      "activity", referenceid, fromDate, toDate, perTableLimit, selectFields
    );

    /* -------------------- 2️⃣ HISTORY -------------------- */
    const { data: historyData, hasMore: historyHasMore } = await fetchAllRows(
      "history", referenceid, fromDate, toDate, perTableLimit, selectFields
    );

    /* -------------------- 3️⃣ REVISED QUOTATIONS -------------------- */
    const { data: revisedData, hasMore: revisedHasMore } = await fetchAllRows(
      "revised_quotations", referenceid, fromDate, toDate, perTableLimit, selectFields
    );

    /* -------------------- 4️⃣ MEETINGS -------------------- */
    const { data: meetingsData, hasMore: meetingsHasMore } = await fetchAllRows(
      "meetings", referenceid, fromDate, toDate, perTableLimit, selectFields
    );

    /* -------------------- 5️⃣ DOCUMENTATION -------------------- */
    const { data: documentationData, hasMore: docHasMore } = await fetchAllRows(
      "documentation", referenceid, fromDate, toDate, perTableLimit, selectFields
    );

    /* -------------------- 6️⃣ NORMALIZE + MERGE -------------------- */
    let activities = [
      ...(activityData || []).map((item) => ({ ...item, table_source: "activity" })),
      ...(historyData || []).map((item) => ({ ...item, table_source: "history" })),
      ...(revisedData || []).map((item) => ({ ...item, table_source: "revised_quotations" })),
      ...(meetingsData || []).map((item) => ({ ...item, table_source: "meeting" })),
      ...(documentationData || []).map((item) => ({ ...item, table_source: "documentation" })),
    ].sort(
      (a, b) =>
        new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    );

    // Generate next cursor based on last item's date
    let nextCursor: string | null = null;
    const hasMore = activities.length > parsedLimit ||
      activityHasMore || historyHasMore || revisedHasMore || meetingsHasMore || docHasMore;

    if (activities.length > parsedLimit) {
      activities = activities.slice(0, parsedLimit);
    }

    // Generate cursor from the last item's date_created
    if (hasMore && activities.length > 0) {
      const lastItem = activities[activities.length - 1];
      if (lastItem?.date_created) {
        // Use the date of the last item as cursor for next request
        const lastDate = new Date(lastItem.date_created);
        // Subtract 1ms to ensure we don't include the last item again
        lastDate.setMilliseconds(lastDate.getMilliseconds() - 1);
        nextCursor = lastDate.toISOString();
      }
    }

    return res.status(200).json({
      activities,
      pagination: {
        limit: parsedLimit,
        returned: activities.length,
        hasMore,
        nextCursor,
        isFetchAll,
      },
      filters: {
        from: fromDate || null,
        to: toDate || null,
        cursor: cursorDate || null,
      },
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

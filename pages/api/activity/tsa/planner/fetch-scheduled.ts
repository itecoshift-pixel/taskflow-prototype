import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 500;
const CHUNK_SIZE = 200;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;
const HARD_MAX_FOR_FETCH_ALL = 10000; // For fetchAll mode, allow up to 10k per request

// ─────────────────────────────────────────────────────────────────────────────
// ROOT CAUSE OF MISSING MARCH DATA:
//
// The previous cursor used `.gt("id", lastId)` COMBINED with a
// `scheduled_date` range filter. This is incorrect because:
//
//   - Rows are ordered by `id` (globally sequential insert order)
//   - But `scheduled_date` is independent of `id`
//   - A row with scheduled_date = March 13 may have id = 200
//     while another with scheduled_date = March 20 has id = 150
//
// So when the cursor advances past id=1000, it skips all rows whose
// scheduled_date is in range but whose id <= 1000 was already passed.
// Result: entire date ranges appear missing even though data exists.
//
// FIX: When a date range is provided, use scheduled_date as the primary
// sort + cursor key instead of id. This ensures the cursor stays aligned
// with the date filter and never skips rows in the target range.
//
// When NO date filter is provided (fetching all), use id-based cursor
// as before — it is safe when there is no date boundary to respect.
// ─────────────────────────────────────────────────────────────────────────────

async function* fetchActivityBatches(
  referenceid: string,
  scheduledFrom?: string,
  scheduledTo?: string,
  limit?: number,
) {
  const hasDateFilter = !!(scheduledFrom || scheduledTo);
  let totalFetched = 0;

  if (hasDateFilter) {
    // ── Date-filtered mode: cursor on (scheduled_date, id) ────────────────
    let lastScheduledDate: string | null = null;
    let lastId: number | null = null;

    while (true) {
      let query = supabase
        .from("activity")
        .select("*")
        .eq("referenceid", referenceid)
        .order("scheduled_date", { ascending: true })
        .order("id", { ascending: true })
        .limit(BATCH_SIZE);

      if (scheduledFrom) query = query.gte("scheduled_date", scheduledFrom);
      if (scheduledTo)   query = query.lte("scheduled_date", scheduledTo);

      // Composite cursor: rows after (lastScheduledDate, lastId)
      if (lastScheduledDate !== null && lastId !== null) {
        // Supabase doesn't support composite cursors natively, so we use
        // a manual OR condition:
        // (scheduled_date > lastScheduledDate)
        // OR (scheduled_date = lastScheduledDate AND id > lastId)
        query = query.or(
          `scheduled_date.gt.${lastScheduledDate},and(scheduled_date.eq.${lastScheduledDate},id.gt.${lastId})`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;

      yield data;
      totalFetched += data.length;

      // Stop if we reached the overall limit
      if (limit && totalFetched >= limit) break;

      if (data.length < BATCH_SIZE) break;

      const last = data[data.length - 1];
      lastScheduledDate = last.scheduled_date;
      lastId = last.id;
    }
  } else {
    // ── No date filter: safe to use id-only cursor ────────────────────────
    let lastId: number | null = null;

    while (true) {
      let query = supabase
        .from("activity")
        .select("*")
        .eq("referenceid", referenceid)
        .order("id", { ascending: true })
        .limit(BATCH_SIZE);

      if (lastId !== null) query = query.gt("id", lastId);

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;

      yield data;
      totalFetched += data.length;

      // Stop if we reached the overall limit
      if (limit && totalFetched >= limit) break;

      if (data.length < BATCH_SIZE) break;
      lastId = data[data.length - 1].id;
    }
  }
}

// ─── History batches — cursor-based, chunked ──────────────────────────────────
async function* fetchHistoryBatches(activityReferenceNumbers: string[]) {
  if (!activityReferenceNumbers.length) return;

  const chunks: string[][] = [];
  for (let i = 0; i < activityReferenceNumbers.length; i += CHUNK_SIZE) {
    chunks.push(activityReferenceNumbers.slice(i, i + CHUNK_SIZE));
  }

  for (const chunk of chunks) {
    let lastHistoryId: number | null = null;

    while (true) {
      let query = supabase
        .from("history")
        .select("*")
        .in("activity_reference_number", chunk)
        .order("id", { ascending: true })
        .limit(BATCH_SIZE);

      if (lastHistoryId !== null) query = query.gt("id", lastHistoryId);

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;

      yield data;

      if (data.length < BATCH_SIZE) break;
      lastHistoryId = data[data.length - 1].id;
    }
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { referenceid, from, to, limit, fetchAll, cursor } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  // Check if this is a fetch-all request
  const isFetchAll = fetchAll === "true";

  // Parse limit - allow higher limit for fetchAll mode
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

  // Normalize to YYYY-MM-DD
  let scheduledFrom: string | undefined;
  let scheduledTo: string | undefined;
  let cursorDate: string | undefined;

  if (typeof from === "string" && from) {
    scheduledFrom = from.length > 10 ? from.slice(0, 10) : from;
  }
  if (typeof to === "string" && to) {
    scheduledTo = to.length > 10 ? to.slice(0, 10) : to;
  }
  if (typeof cursor === "string" && cursor) {
    cursorDate = cursor;
  }

  // Adjust date range if cursor is provided
  if (cursorDate) {
    scheduledTo = cursorDate; // Set end date to cursor for fetching older data
  }

  // Track data for cursor generation
  let lastActivityDate: string | null = null;

  try {
    res.setHeader("Content-Type", "application/json");
    res.write(`{"activities":[`);

    let firstActivity = true;
    const allActivityReferenceNumbers: string[] = [];
    let totalActivities = 0;
    let hasMoreActivities = false;

    for await (const batch of fetchActivityBatches(referenceid, scheduledFrom, scheduledTo, parsedLimit)) {
      for (const row of batch) {
        if (totalActivities >= parsedLimit) {
          hasMoreActivities = true;
          break;
        }

        // Track the oldest date seen (for next cursor)
        if (!lastActivityDate || new Date(row.scheduled_date) < new Date(lastActivityDate)) {
          lastActivityDate = row.scheduled_date;
        }

        if (row.activity_reference_number) {
          allActivityReferenceNumbers.push(row.activity_reference_number);
        }
        const json = JSON.stringify(row);
        res.write(firstActivity ? json : `,${json}`);
        firstActivity = false;
        totalActivities++;
      }
      if (hasMoreActivities) break;
    }

    res.write(`],"history":[`);

    let firstHistory = true;
    let totalHistory = 0;

    const uniqueRefs = [...new Set(allActivityReferenceNumbers)];

    // Limit history based on activities fetched
    const historyLimit = parsedLimit * 2;
    let historyCount = 0;

    for await (const batch of fetchHistoryBatches(uniqueRefs)) {
      for (const row of batch) {
        if (historyCount >= historyLimit) break;

        const json = JSON.stringify(row);
        res.write(firstHistory ? json : `,${json}`);
        firstHistory = false;
        totalHistory++;
        historyCount++;
      }
      if (historyCount >= historyLimit) break;
    }

    // Generate next cursor
    let nextCursor: string | null = null;
    if (hasMoreActivities && lastActivityDate) {
      const cursorDate = new Date(lastActivityDate);
      cursorDate.setDate(cursorDate.getDate() - 1); // Go back 1 day
      nextCursor = cursorDate.toISOString().slice(0, 10); // YYYY-MM-DD format
    }

    res.write(`],"total_activities":${totalActivities},"total_history":${totalHistory},"has_more":${hasMoreActivities},"next_cursor":"${nextCursor || ""}","is_fetch_all":${isFetchAll},"limit":${parsedLimit}}`);
    res.end();
  } catch (err: any) {
    console.error("[fetch-scheduled] Server error:", err);
    if (!res.writableEnded) {
      res.status(500).json({ message: err.message || "Server error" });
    }
  }
}
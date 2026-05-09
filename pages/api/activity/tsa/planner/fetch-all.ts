import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE    = 1000;
const IN_CHUNK_SIZE = 500;

// ─── Types ────────────────────────────────────────────────────────────────────

interface FetchResult {
  activities: any[];
  history: any[];
  total_activities: number;
  total_history: number;
  has_more: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch all rows from a query by paginating with cursor on `id` */
async function fetchAllRows(buildQuery: (lastId: number | null) => any): Promise<any[]> {
  const rows: any[] = [];
  let lastId: number | null = null;

  while (true) {
    const { data, error } = await buildQuery(lastId);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < BATCH_SIZE) break;
    lastId = data[data.length - 1].id;
  }

  return rows;
}

/** Split an array into chunks of size n */
function chunk<T>(arr: T[], n: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += n) result.push(arr.slice(i, i + n));
  return result;
}

// ─── Activity fetcher ─────────────────────────────────────────────────────────

async function fetchActivitiesByReferenceId(
  referenceid: string,
  fromISO?: string,
  toISO?: string,
  companySearch?: string,          // ilike search on activity-level fields
  activityRefNums?: string[],      // IN filter — from history search results
): Promise<any[]> {
  const allRows: any[] = [];

  // We need a union of:
  //   A) activities matching the company/field-level search
  //   B) activities whose activity_reference_number is in activityRefNums
  //
  // Supabase doesn't support UNION, so run two separate queries and dedupe.

  const buildBaseQuery = (lastId: number | null) => {
    let q = supabase
      .from("activity")
      .select("*")
      .eq("referenceid", referenceid)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (fromISO) q = q.gte("date_created", fromISO);
    if (toISO)   q = q.lt("date_created",  toISO);
    if (lastId)  q = q.gt("id",            lastId);

    return q;
  };

  // ── Branch A: activity-level field search ──────────────────────────────────
  if (companySearch) {
    const rows = await fetchAllRows((lastId) => {
      const q = buildBaseQuery(lastId).or(
        [
          `company_name.ilike.%${companySearch}%`,
          `contact_person.ilike.%${companySearch}%`,
          `contact_number.ilike.%${companySearch}%`,
          `email_address.ilike.%${companySearch}%`,
          `address.ilike.%${companySearch}%`,
          `activity_reference_number.ilike.%${companySearch}%`,
          `ticket_reference_number.ilike.%${companySearch}%`,
          `status.ilike.%${companySearch}%`,
          `type_client.ilike.%${companySearch}%`,
        ].join(","),
      );
      return q;
    });
    allRows.push(...rows);
  }

  // ── Branch B: activities resolved from history search ─────────────────────
  if (activityRefNums && activityRefNums.length > 0) {
    const uniqueRefs = [...new Set(activityRefNums)];
    for (const ch of chunk(uniqueRefs, IN_CHUNK_SIZE)) {
      const rows = await fetchAllRows((lastId) =>
        buildBaseQuery(lastId).in("activity_reference_number", ch),
      );
      allRows.push(...rows);
    }
  }

  // ── If no search at all, fetch everything in date range ────────────────────
  if (!companySearch && (!activityRefNums || activityRefNums.length === 0)) {
    const rows = await fetchAllRows((lastId) => buildBaseQuery(lastId));
    allRows.push(...rows);
  }

  // Dedupe by id
  const seen = new Set<number>();
  return allRows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

// ─── History fetcher ──────────────────────────────────────────────────────────

async function fetchHistoryForActivities(activityRefNums: string[]): Promise<any[]> {
  if (!activityRefNums.length) return [];

  const uniqueRefs = [...new Set(activityRefNums)];
  const allRows: any[] = [];

  for (const ch of chunk(uniqueRefs, IN_CHUNK_SIZE)) {
    const rows = await fetchAllRows((lastId) => {
      let q = supabase
        .from("history")
        .select("*")
        .in("activity_reference_number", ch)
        .order("id", { ascending: true })
        .limit(BATCH_SIZE);
      if (lastId) q = q.gt("id", lastId);
      return q;
    });
    allRows.push(...rows);
  }

  return allRows;
}

/**
 * Search the history table for matching quotation_number / so_number / dr_number
 * and return the distinct activity_reference_numbers.
 */
async function resolveActivityRefsFromHistory(
  referenceid: string,
  search: string,
  fromISO?: string,
  toISO?: string,
): Promise<string[]> {
  const rows = await fetchAllRows((lastId) => {
    let q = supabase
      .from("history")
      .select("id, activity_reference_number")
      .eq("referenceid", referenceid)
      .or(
        [
          `quotation_number.ilike.%${search}%`,
          `so_number.ilike.%${search}%`,
          `dr_number.ilike.%${search}%`,
        ].join(","),
      )
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (fromISO) q = q.gte("date_created", fromISO);
    if (toISO)   q = q.lt("date_created",  toISO);
    if (lastId)  q = q.gt("id",            lastId);

    return q;
  });

  return [
    ...new Set(
      rows
        .map((r: any) => r.activity_reference_number)
        .filter(Boolean),
    ),
  ];
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { referenceid, from, to, limit, search } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const searchStr = typeof search === "string" && search.trim() ? search.trim() : undefined;
  const hasFrom   = typeof from   === "string" && from.trim().length > 0;
  const hasTo     = typeof to     === "string" && to.trim().length > 0;

  // Guard: require at least one filter to avoid loading everything on mount
  if (!searchStr && !hasFrom) {
    return res.status(200).json({
      activities:        [],
      history:           [],
      total_activities:  0,
      total_history:     0,
      has_more:          false,
    });
  }

  const fromISO = hasFrom ? new Date(from as string).toISOString() : undefined;
  let toISO: string | undefined;
  if (hasTo) {
    const toDay = new Date(to as string);
    toDay.setDate(toDay.getDate() + 1); // include the full "to" day
    toISO = toDay.toISOString();
  }

  try {
    // ── Step 1: If there's a search term, resolve activity refs from history ──
    // (handles searches on quotation_number, so_number, dr_number)
    let historyDerivedRefs: string[] = [];
    if (searchStr) {
      historyDerivedRefs = await resolveActivityRefsFromHistory(
        referenceid,
        searchStr,
        fromISO,
        toISO,
      );
    }

    // ── Step 2: Fetch activities (union of direct match + history-resolved) ───
    const activities = await fetchActivitiesByReferenceId(
      referenceid,
      fromISO,
      toISO,
      searchStr,           // branch A: company_name / field-level search
      historyDerivedRefs,  // branch B: resolved from quotation/SO/DR search
    );

    // Sort by date_updated desc (mirrors original behaviour)
    activities.sort(
      (a, b) =>
        new Date(b.date_updated ?? b.date_created).getTime() -
        new Date(a.date_updated ?? a.date_created).getTime(),
    );

    // ── Step 3: Fetch all history for the found activities ────────────────────
    const activityRefNums = activities
      .map((a) => a.activity_reference_number)
      .filter(Boolean);

    const history = await fetchHistoryForActivities(activityRefNums);

    // ── Step 4: Respond ───────────────────────────────────────────────────────
    const parsedLimit = limit ? parseInt(String(limit), 10) : 0;
    const hasMore = parsedLimit > 0 && activities.length >= parsedLimit;

    return res.status(200).json({
      activities,
      history,
      total_activities: activities.length,
      total_history:    history.length,
      has_more:         hasMore,
    } as FetchResult);

  } catch (err: any) {
    console.error("[fetch-all] Server error:", err);
    return res.status(500).json({ message: err.message || "Internal server error" });
  }
}
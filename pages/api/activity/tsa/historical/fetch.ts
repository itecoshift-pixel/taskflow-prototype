import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const {
    referenceid,
    page,
    limit,
    search,
    status,
    type_activity,
    source,
    type_client,
    call_status,
    quotation_status,
    from,
    to,
    fields
  } = req.query;

  if (!referenceid) {
    return res.status(400).json({ success: false, error: "Missing referenceid" });
  }

  const selectFields = typeof fields === "string" ? fields : "*";

  try {
    const itemsPerPage = Math.min(
      parseInt(limit as string) || PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const currentPage = parseInt(page as string) || 1;
    const offset = (currentPage - 1) * itemsPerPage;

    let query = supabase
      .from("history")
      .select(selectFields, { count: "exact" })
      .eq("referenceid", referenceid);

    // Apply filters directly in query for performance
    if (status && status !== "all") query = query.eq("status", status);
    if (type_activity && type_activity !== "all") query = query.eq("type_activity", type_activity);
    if (source && source !== "all") query = query.eq("source", source);
    if (type_client && type_client !== "all") query = query.eq("type_client", type_client);
    if (call_status && call_status !== "all") query = query.eq("call_status", call_status);
    if (quotation_status && quotation_status !== "all") query = query.eq("quotation_status", quotation_status);
    if (from && to) query = query.gte("date_created", from).lte("date_created", to);

    // Apply search if provided
    if (search && typeof search === "string") {
      const s = `%${search}%`;
      query = query.or(`company_name.ilike.${s},project_name.ilike.${s},quotation_number.ilike.${s},remarks.ilike.${s}`);
    }

    const { data, error, count } = await query
      .order("date_updated", { ascending: false })
      .order("date_created", { ascending: false })
      .range(offset, offset + itemsPerPage - 1);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      activities: data || [],
      pagination: {
        current_page: currentPage,
        items_per_page: itemsPerPage,
        total_count: count || 0,
        total_pages: Math.ceil((count || 0) / itemsPerPage),
      },
    });
  } catch (error: any) {
    console.error("Historical fetch error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

// Fetches history for a specific account, filtered by the requesting user's referenceid.
// Strategy 1: exact match by account_reference_number + referenceid
// Strategy 2: exact match by company_name + referenceid (fallback)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { account_reference_number, company_name, referenceid } = req.query;

  const refNum   = typeof account_reference_number === "string" ? account_reference_number.trim() : "";
  const compName = typeof company_name === "string" ? company_name.trim() : "";
  const userId   = typeof referenceid === "string" ? referenceid.trim() : "";

  if (!refNum && !compName) {
    return res.status(400).json({ message: "Provide account_reference_number or company_name" });
  }

  if (!userId) {
    return res.status(400).json({ message: "Provide referenceid" });
  }

  const COLS = "id, company_name, account_reference_number, activity_reference_number, type_activity, remarks, status, date_created, date_updated";

  try {
    // ── Strategy 1: exact match by account_reference_number + referenceid ──
    if (refNum) {
      const { data, error } = await supabase
        .from("history")
        .select(COLS)
        .eq("account_reference_number", refNum)
        .eq("referenceid", userId)
        .order("date_created", { ascending: false })
        .limit(100);

      if (error) throw error;

      if (data && data.length > 0) {
        return res.status(200).json({ activities: data });
      }
    }

    // ── Strategy 2: exact match by company_name + referenceid ───────────────
    if (compName) {
      const { data, error } = await supabase
        .from("history")
        .select(COLS)
        .eq("company_name", compName)
        .eq("referenceid", userId)
        .order("date_created", { ascending: false })
        .limit(100);

      if (error) throw error;

      return res.status(200).json({ activities: data || [] });
    }

    return res.status(200).json({ activities: [] });
  } catch (err: any) {
    console.error("[fetch-by-account] Error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

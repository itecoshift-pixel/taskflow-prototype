import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

// ─── Response shape ───────────────────────────────────────────────────────────
// {
//   actualOb:       number  — count of OB Touchbase Successful rows
//   quoteOb:        number  — unique ref nums that have Quotation Preparation
//   soOb:           number  — unique ref nums that have Sales Order Preparation
//   siOb:           number  — unique ref nums that have Delivered / Closed Transaction
//   quoteAmtActual: number  — sum of quotation_amount from Quotation Preparation rows
//   soAmtActual:    number  — sum of so_amount from Sales Order Preparation rows
//   siAmtActual:    number  — sum of actual_sales from Delivered / Closed Transaction rows
// }

const BATCH = 1000;
const CHUNK = 500; // max for .in() per request

// ── Fetch all OB Successful activity_reference_numbers ────────────────────────

async function fetchAllRefNums(
  referenceid: string,
  fromDate?: string,
  toDate?: string
): Promise<string[]> {
  const all: string[] = [];
  let offset = 0;

  while (true) {
    let q = supabase
      .from("history")
      .select("activity_reference_number")
      .eq("referenceid", referenceid)
      .eq("source", "Outbound - Touchbase")
      .eq("call_status", "Successful")
      .not("activity_reference_number", "is", null)
      .range(offset, offset + BATCH - 1);

    if (fromDate) q = q.gte("date_created", fromDate);
    if (toDate)   q = q.lte("date_created", toDate);

    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;

    data.forEach((r) => {
      if (r.activity_reference_number) all.push(r.activity_reference_number);
    });

    if (data.length < BATCH) break;
    offset += BATCH;
  }

  return all;
}

// ── Count unique ref nums that have a given type_activity ─────────────────────

async function countByTypeActivity(
  uniqueRefs: string[],
  typeActivity: string
): Promise<number> {
  if (uniqueRefs.length === 0) return 0;

  const matched = new Set<string>();

  for (let i = 0; i < uniqueRefs.length; i += CHUNK) {
    const chunk = uniqueRefs.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("history")
      .select("activity_reference_number")
      .in("activity_reference_number", chunk)
      .eq("type_activity", typeActivity)
      .not("activity_reference_number", "is", null);

    if (error) throw error;
    data?.forEach((r) => {
      if (r.activity_reference_number) matched.add(r.activity_reference_number);
    });
  }

  return matched.size;
}

// ── Sum an amount field for rows matching type_activity ───────────────────────

async function sumAmountByTypeActivity(
  uniqueRefs: string[],
  typeActivity: string,
  amountField: "quotation_amount" | "so_amount" | "actual_sales"
): Promise<number> {
  if (uniqueRefs.length === 0) return 0;

  let total = 0;

  for (let i = 0; i < uniqueRefs.length; i += CHUNK) {
    const chunk = uniqueRefs.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("history")
      .select(`activity_reference_number, ${amountField}`)
      .in("activity_reference_number", chunk)
      .eq("type_activity", typeActivity)
      .not(amountField, "is", null);

    if (error) throw error;

    // Sum per unique ref num — take the highest value per ref to avoid double-counting
    const bestPerRef = new Map<string, number>();
    (data ?? []).forEach((r: Record<string, any>) => {
      const ref = r.activity_reference_number as string | null;
      const val = Number(r[amountField]) || 0;
      if (ref && val > 0) {
        const existing = bestPerRef.get(ref) ?? 0;
        if (val > existing) bestPerRef.set(ref, val);
      }
    });

    bestPerRef.forEach((v) => { total += v; });
  }

  return total;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate   = typeof to   === "string" ? to   : undefined;

  try {
    // Step 1 — get all OB Successful ref numbers in date range
    const obRefNums  = await fetchAllRefNums(referenceid, fromDate, toDate);
    const actualOb   = obRefNums.length;
    const uniqueRefs = [...new Set(obRefNums)];

    // Step 2 — counts + amounts in parallel
    const [
      quoteOb,
      soOb,
      siOb,
      quoteAmtActual,
      soAmtActual,
      siAmtActual,
    ] = await Promise.all([
      countByTypeActivity(uniqueRefs, "Quotation Preparation"),
      countByTypeActivity(uniqueRefs, "Sales Order Preparation"),
      countByTypeActivity(uniqueRefs, "Delivered / Closed Transaction"),
      sumAmountByTypeActivity(uniqueRefs, "Quotation Preparation",          "quotation_amount"),
      sumAmountByTypeActivity(uniqueRefs, "Sales Order Preparation",        "so_amount"),
      sumAmountByTypeActivity(uniqueRefs, "Delivered / Closed Transaction", "actual_sales"),
    ]);

    return res.status(200).json({
      actualOb,
      quoteOb,
      soOb,
      siOb,
      quoteAmtActual,
      soAmtActual,
      siAmtActual,
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

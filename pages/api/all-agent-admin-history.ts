import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("history")
        .select("*")
        .order("date_created", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        return res.status(500).json({ message: error.message });
      }

      const batch = data ?? [];
      allData = allData.concat(batch);
      hasMore = batch.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    return res.status(200).json({ activities: allData });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
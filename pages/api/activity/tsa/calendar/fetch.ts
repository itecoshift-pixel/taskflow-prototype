import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    let allData: any[] = [];
    let offset = 0;

    while (true) {
      let query = supabase
        .from("history")
        .select(`
          id,
          activity_reference_number,
          referenceid,
          tsm,
          manager,
          type_activity,
          date_created,
          date_updated,
          start_date,
          end_date,
          status,
          company_name,
          remarks
        `)
        .eq("referenceid", referenceid)
        // 🔑 STABLE ORDERING (IMPORTANT)
        .order("date_updated", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);

      if (fromDate && toDate) {
        query = query.gte("date_updated", fromDate).lte("date_updated", toDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase error:", error);
        return res.status(500).json({ message: error.message });
      }

      if (!data || data.length === 0) break;

      allData.push(...data);

      if (data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }

    // Fetch meetings
    let allMeetings: any[] = [];
    offset = 0;

    while (true) {
      let query = supabase
        .from("meetings")
        .select(`
          id,
          referenceid,
          tsm,
          manager,
          type_activity,
          start_date,
          end_date,
          date_updated,
          company_name,
          remarks
        `)
        .eq("referenceid", referenceid)
        .order("date_updated", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);

      if (fromDate && toDate) {
        query = query.gte("date_updated", fromDate).lte("date_updated", toDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase error (meetings):", error);
        return res.status(500).json({ message: error.message });
      }

      if (!data || data.length === 0) break;

      allMeetings.push(...data);

      if (data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }

    // Fetch documentation
    let allDocumentation: any[] = [];
    offset = 0;

    while (true) {
      let query = supabase
        .from("documentation")
        .select(`
          id,
          referenceid,
          tsm,
          manager,
          type_activity,
          remarks,
          start_date,
          end_date,
          date_created
        `)
        .eq("referenceid", referenceid)
        .order("date_created", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);

      if (fromDate && toDate) {
        query = query.gte("date_created", fromDate).lte("date_created", toDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase error (documentation):", error);
        return res.status(500).json({ message: error.message });
      }

      if (!data || data.length === 0) break;

      // Normalize: use date_created as date_updated so sorting works uniformly
      allDocumentation.push(...data.map((d) => ({ ...d, date_updated: d.date_created })));

      if (data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }

    // Fetch SPF Creation
    let allSpf: any[] = [];
    offset = 0;

    while (true) {
      let query = supabase
        .from("spf_request")
        .select(`
          id,
          spf_number,
          referenceid,
          tsm,
          manager,
          customer_name,
          special_instructions,
          item_description,
          start_date,
          end_date,
          date_created,
          date_updated
        `)
        .eq("referenceid", referenceid)
        .order("date_updated", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);

      if (fromDate && toDate) {
        query = query.gte("date_updated", fromDate).lte("date_updated", toDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase error (spf_request):", error);
        return res.status(500).json({ message: error.message });
      }

      if (!data || data.length === 0) break;

      allSpf.push(...data.map((d) => ({
        ...d,
        type_activity: "SPF Creation",
        activity_reference_number: d.spf_number,
        company_name: d.customer_name,
        remarks: [d.special_instructions, d.item_description].filter(Boolean).join(" | "),
        date_updated: d.date_updated || d.date_created
      })));

      if (data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }

    const combinedData = [...allData, ...allMeetings, ...allDocumentation, ...allSpf].sort(
      (a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime()
    );

    return res.status(200).json({
      activities: combinedData,
      total: combinedData.length,
      cached: false,
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const referenceId = req.query.id as string; // This is the TSM ReferenceID passed as query param
    const role = req.query.role as string;
    const department = req.query.department as string;

    let supabaseQuery = supabase.from("users").select(`
        Firstname,
        Lastname,
        ReferenceID,
        TSM,
        Manager,
        profilePicture,
        Position,
        Status,
        Role,
        TargetQuota,
        Connection
      `);

    const isSuperAdmin = role === "SuperAdmin";
    const isProcurement = department === "Procurement";

    if (!isSuperAdmin && !isProcurement) {
      if (!referenceId) {
        return res.status(400).json({ error: "ReferenceID (TSM) is required" });
      }
      supabaseQuery = supabaseQuery.eq("TSM", referenceId);
    }

    // Fetch all agents from Supabase based on the query
    const { data: agents, error } = await supabaseQuery
      .not("Status", "in", '("Resigned", "Terminated")')
      .eq("Department", "Sales");

    if (error) throw error;

    // Return only relevant agent info
    res.status(200).json(agents || []);
  } catch (error) {
    console.error("Error fetching agents from Supabase:", error);
    res.status(500).json({ error: "Server error fetching agents" });
  }
}

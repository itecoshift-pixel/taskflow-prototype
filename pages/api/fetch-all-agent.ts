import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const referenceId = req.query.id as string; // This is the TSM ReferenceID passed as query param

    if (!referenceId) {
      return res.status(400).json({ error: "ReferenceID (TSM) is required" });
    }

    // Fetch all agents whose TSM field matches the provided ReferenceID from Supabase
    const { data: agents, error } = await supabase
      .from("users")
      .select("Firstname, Lastname, ReferenceID, profilePicture")
      .eq("TSM", referenceId);

    if (error) throw error;

    if (!agents || agents.length === 0) {
      return res.status(200).json([]); // Return empty array instead of 404 for better frontend handling
    }

    // Return only relevant agent info
    res.status(200).json(agents);
  } catch (error) {
    console.error("Error fetching agents from Supabase:", error);
    res.status(500).json({ error: "Server error fetching agents" });
  }
}

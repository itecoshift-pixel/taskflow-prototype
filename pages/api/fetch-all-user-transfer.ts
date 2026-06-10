import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    // Fetch only users with role Territory Sales Associate
    // and Status NOT in ['Resigned', 'Terminated'] from Supabase
    const { data: agents, error } = await supabase
      .from("users")
      .select("Firstname, Lastname, ReferenceID, profilePicture")
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned", "Terminated")')
      .order("Lastname", { ascending: true });

    if (error) throw error;

    if (!agents || agents.length === 0) {
      return res.status(404).json({ error: "No agents found" });
    }

    res.status(200).json(agents);
  } catch (error) {
    console.error("Error fetching agents from Supabase:", error);
    res.status(500).json({ error: "Server error fetching agents" });
  }
}

import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    // Fetch all agents whose Status is NOT "Resigned" or "Terminated"
    const { data: agents, error } = await supabase
      .from("users")
      .select("Firstname, Lastname, ReferenceID, profilePicture, Position, Status, Role, TargetQuota")
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned", "Terminated")');

    if (error) {
      console.error("Error fetching agents from Supabase:", error);
      return res.status(500).json({ error: "Server error fetching agents" });
    }

    if (!agents || agents.length === 0) {
      return res.status(404).json({ error: "No agents found" });
    }

    // Return only relevant agent info, excluding sensitive data like passwords
    res.status(200).json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).json({ error: "Server error fetching agents" });
  }
}

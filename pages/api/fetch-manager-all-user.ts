import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const referenceId = req.query.id as string; // This is the Manager ReferenceID passed as query param

    if (!referenceId) {
      return res.status(400).json({ error: "ReferenceID (Manager) is required" });
    }

    // Fetch all agents whose Manager field matches the provided ReferenceID
    const { data: agents, error } = await supabase
      .from("users")
      .select("Firstname, Lastname, ReferenceID, TSM, profilePicture, Position, Status, Role, TargetQuota, Connection")
      .eq("Manager", referenceId)
      .not("Status", "in", '("Resigned", "Terminated")');

    if (error) {
      console.error("Error fetching agents from Supabase:", error);
      return res.status(500).json({ error: "Server error fetching agents" });
    }

    if (!agents || agents.length === 0) {
      return res.status(404).json({ error: "No agents found for this Manager" });
    }

    // Return only relevant agent info, excluding sensitive data like passwords
    res.status(200).json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).json({ error: "Server error fetching agents" });
  }
}

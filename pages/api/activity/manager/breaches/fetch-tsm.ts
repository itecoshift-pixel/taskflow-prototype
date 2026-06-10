import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const referenceid = req.query.id as string; // This is the Manager ReferenceID passed as query param

    if (!referenceid) {
      return res.status(400).json({ error: "ReferenceID (Manager) is required" });
    }

    // Fetch all TSMs whose Manager field matches the provided ReferenceID
    // and whose Status is NOT "Resigned", "Terminated", or "Inactive"
    const { data: agents, error } = await supabase
      .from("users")
      .select("Firstname, Lastname, ReferenceID, profilePicture, Position, Status, Role, TargetQuota, Connection")
      .eq("Manager", referenceid)
      .eq("Role", "Territory Sales Manager")
      .not("Status", "in", '("Resigned", "Terminated", "Inactive")');

    if (error) {
      console.error("Error fetching TSMs from Supabase:", error);
      return res.status(500).json({ error: "Server error fetching TSMs" });
    }

    if (!agents || agents.length === 0) {
      return res.status(404).json({ error: "No TSMs found for this Manager" });
    }

    // Return only relevant agent info, excluding sensitive data like passwords
    res.status(200).json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).json({ error: "Server error fetching agents" });
  }
}

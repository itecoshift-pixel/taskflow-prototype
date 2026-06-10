import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const referenceId = req.query.id as string; // This is the Manager's ReferenceID passed as query param

    if (!referenceId) {
      return res.status(400).json({ error: "ReferenceID (Manager) is required" });
    }

    // Fetch TSMs filtered by Manager, Role=TSM, and Status not Resigned or Terminated
    const { data: tsms, error } = await supabase
      .from("users")
      .select("Firstname, Lastname, ReferenceID, profilePicture, Position, Status, Role, TargetQuota")
      .eq("Manager", referenceId)
      .eq("Role", "Territory Sales Manager")
      .not("Status", "in", '("Resigned", "Terminated")')
      .order("Lastname", { ascending: true });

    if (error) {
      console.error("Error fetching TSMs from Supabase:", error);
      return res.status(500).json({ error: "Server error fetching TSMs" });
    }

    if (!tsms || tsms.length === 0) {
      return res.status(404).json({ error: "No TSMs found for this Manager" });
    }

    res.status(200).json(tsms);
  } catch (error) {
    console.error("Error fetching TSMs:", error);
    res.status(500).json({ error: "Server error fetching TSMs" });
  }
}

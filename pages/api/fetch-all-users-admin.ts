import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { data: agents, error } = await supabase
      .from("users")
      .select("Firstname, Lastname, ReferenceID, profilePicture, Position, Status, Role, TargetQuota, Department, Connection, Manager, TSM")
      .eq("Department", "Sales")
      .not("Status", "in", '("Resigned", "Terminated")');

    if (error) {
      console.error("Error fetching agents from Supabase:", error);
      return res.status(500).json({ error: "Server error fetching agents" });
    }

    if (!agents || agents.length === 0) {
      return res
        .status(404)
        .json({ error: "No agents found" });
    }

    return res.status(200).json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    return res
      .status(500)
      .json({ error: "Server error fetching agents" });
  }
}

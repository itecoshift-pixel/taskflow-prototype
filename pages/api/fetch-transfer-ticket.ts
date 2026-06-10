import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { tsm } = req.query;

    // Base query: users with Role 'Territory Sales Associate' and not resigned/terminated
    let queryBuilder = supabase
      .from("users")
      .select("Firstname, Lastname, TSM, ReferenceID, profilePicture")
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned", "Terminated")');

    // Filter by TSM if tsm query param exists
    if (tsm && typeof tsm === "string") {
      queryBuilder = queryBuilder.eq("TSM", tsm);
    }

    const { data: users, error } = await queryBuilder.order("Lastname", { ascending: true });

    if (error) {
      console.error("Error fetching users from Supabase:", error);
      return res.status(500).json({ error: "Server error fetching users" });
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ error: "No Territory Sales Associate users found" });
    }

    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Server error fetching users" });
  }
}

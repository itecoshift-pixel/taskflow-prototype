// pages/api/fetch-agent.ts

import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    // Fetch all users from Supabase, exclude Password
    const { data: users, error } = await supabase
      .from("users")
      .select("*, Password") // select all, then we filter out Password
      .order("Firstname", { ascending: true });

    if (error) throw error;

    // Filter out Password manually to be safe
    const sanitizedUsers = users.map(({ Password, ...rest }) => rest);

    res.status(200).json(sanitizedUsers);
  } catch (error) {
    console.error("Error fetching users from Supabase:", error);
    res.status(500).json({ error: "Server error fetching users" });
  }
}

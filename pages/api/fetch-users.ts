import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    // Fetch all users regardless of Role, but exclude resigned/terminated
    const { data: users, error } = await supabase
      .from("users")
      .select("Firstname, Lastname, ReferenceID, profilePicture")
      .not("Status", "in", '("Resigned", "Terminated")')
      .order("Lastname", { ascending: true });

    if (error) {
      console.error("Error fetching users from Supabase:", error);
      return res.status(500).json({ error: "Server error fetching users" });
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ error: "No users found" });
    }

    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Server error fetching users" });
  }
}

import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { userIds } = req.body;

  if (!userIds || !Array.isArray(userIds)) {
    return res.status(400).json({ message: "Invalid userIds array" });
  }

  try {
    const normalizedIds = Array.from(
      new Set(
        userIds
          .map((id) => String(id).trim())
          .filter(Boolean)
      )
    );

    // `users.id` is a bigint in Supabase. Ignore non-numeric IDs instead of
    // sending invalid values like Firebase-style hex strings to `.in("id", ...)`.
    const numericIds = normalizedIds.filter((id) => /^\d+$/.test(id));

    if (numericIds.length === 0) {
      return res.status(200).json({ users: {} });
    }

    const { data: users, error } = await supabase
      .from("users")
      .select("id, Firstname, Lastname, userName, profilePicture, Department")
      .in("id", numericIds);

    if (error) throw error;

    // Create a map of userId -> user data
    const userMap: Record<string, { firstName: string; lastName: string; userName: string; profilePicture?: string; department?: string }> = {};
    
    users?.forEach(user => {
      userMap[user.id.toString()] = {
        firstName: user.Firstname || "",
        lastName: user.Lastname || "",
        userName: user.userName || "",
        profilePicture: user.profilePicture || "",
        department: user.Department || ""
      };
    });

    return res.status(200).json({ users: userMap });
  } catch (err) {
    console.error("Error fetching users from Supabase:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

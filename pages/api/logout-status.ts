import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  try {
    const { error } = await supabase
      .from("users")
      .update({ Connection: "Offline" })
      .eq("id", userId);

    if (error) throw error;

    return res.status(200).json({ message: "ConnectionStatus updated to Offline" });
  } catch (error) {
    console.error("Error updating connection status", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

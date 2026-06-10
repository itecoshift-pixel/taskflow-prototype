import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const userId = req.query.id as string;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    // 1. Fetch the primary user from Supabase instead of MongoDB
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 2. Fetch Manager and TSM details using their ReferenceIDs from Supabase
    // Using parallel fetch for efficiency
    const [managerResult, tsmResult] = await Promise.all([
      user.Manager ? supabase.from("users").select("*").eq("ReferenceID", user.Manager).single() : Promise.resolve({ data: null }),
      user.TSM ? supabase.from("users").select("*").eq("ReferenceID", user.TSM).single() : Promise.resolve({ data: null }),
    ]);

    const managerData = managerResult.data;
    const tsmData = tsmResult.data;

    // 3. Construct the response
    const { Password, ...userData } = user;

    res.status(200).json({
      ...userData,
      userId: user.id.toString(), // Ensure frontend gets the ID as a string
      managerDetails: managerData ? {
        firstname: managerData.Firstname,
        lastname: managerData.Lastname,
        email: managerData.Email,
        profilePicture: managerData.profilePicture,
        signatureImage: managerData.signatureImage,
        contact: managerData.ContactNumber
      } : null,
      tsmDetails: tsmData ? {
        firstname: tsmData.Firstname,
        lastname: tsmData.Lastname,
        email: tsmData.Email,
        profilePicture: tsmData.profilePicture,
        signatureImage: tsmData.signatureImage,
        contact: tsmData.ContactNumber
      } : null
    });

  } catch (error) {
    console.error("Error fetching user hierarchy from Supabase:", error);
    res.status(500).json({ error: "Server error" });
  }
}

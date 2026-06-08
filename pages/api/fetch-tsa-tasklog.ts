import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const referenceid = (req.query.referenceid as string)?.trim();

  if (!referenceid) {
    return res.status(400).json({ error: "referenceid query parameter is required" });
  }

  try {
    const db = await connectToDatabase();

    // Query TaskLog collection filtering by exact ReferenceID
    // Using exact match instead of regex for better performance and to avoid timeouts
    // Added limit to prevent large data transfers
    const siteVisits = await db
      .collection("TaskLog")
      .find({
        ReferenceID: referenceid,
      })
      .sort({ date_created: -1 })
      .limit(200)
      .toArray();

    res.status(200).json({ success: true, siteVisits });
  } catch (error) {
    console.error("Error fetching site visits:", error);
    res.status(500).json({ error: "Server error fetching site visits" });
  }
}

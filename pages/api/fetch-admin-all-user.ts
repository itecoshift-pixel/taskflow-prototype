import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const db = await connectToDatabase();
    const referenceId = req.query.id as string; // This is the TSM ReferenceID passed as query param
    const role = req.query.role as string;
    const department = req.query.department as string;

    let query = {};

    const isSuperAdmin = role === "SuperAdmin";
    const isProcurement = department === "Procurement";

    if (!isSuperAdmin && !isProcurement) {
      if (!referenceId) {
        return res.status(400).json({ error: "ReferenceID (TSM) is required" });
      }
      query = { TSM: referenceId };
    }

    // Fetch all agents based on the query
    const agents = await db
      .collection("users")
      .find({
        ...query,
        Status: { $nin: ["Resigned", "Terminated"] },
        Department: "Sales",
      })
      .project({
        Firstname: 1,
        Lastname: 1,
        ReferenceID: 1,
        TSM: 1,
        Manager: 1,
        profilePicture: 1,
        Position: 1,
        Status: 1,
        Role: 1,
        TargetQuota: 1,
        Connection: 1,
        _id: 0,
      })
      .toArray();


    // Return only relevant agent info, excluding sensitive data like passwords
    res.status(200).json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).json({ error: "Server error fetching agents" });
  }
}

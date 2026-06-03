import type { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";

// GET /api/tasklog/by-account?account_reference_number=<ref>
// Returns TaskLog records where SiteVisitAccount matches the given account_reference_number.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { account_reference_number } = req.query;

  if (!account_reference_number || typeof account_reference_number !== "string") {
    return res.status(400).json({ error: "account_reference_number is required" });
  }

  try {
    const db = await connectToDatabase();

    // SiteVisitAccount can be stored under several field name casings
    const taskLogs = await db
      .collection("TaskLog")
      .find({
        $or: [
          { SiteVisitAccount: account_reference_number },
          { siteVisitAccount: account_reference_number },
          { SitevisitAccount: account_reference_number },
          { sitevisitAccount: account_reference_number },
          { "Site Visit Account": account_reference_number },
          { account_reference_number: account_reference_number },
        ],
      })
      .sort({ date_created: -1 })
      .toArray();

    const formatted = taskLogs.map((log) => ({
      _id: log._id?.toString(),
      ReferenceID: log.ReferenceID ?? null,
      Type: log.Type ?? null,
      Location: log.Location ?? log.location ?? null,
      SiteVisitAccount:
        log.SiteVisitAccount ??
        log.siteVisitAccount ??
        log.SitevisitAccount ??
        log.sitevisitAccount ??
        log["Site Visit Account"] ??
        log.account_reference_number ??
        null,
      date_created: log.date_created ?? null,
      PhotoURL: log.PhotoURL ?? log.photoURL ?? null,
      Status: log.Status ?? log.status ?? null,
    }));

    return res.status(200).json({ taskLogs: formatted });
  } catch (err: any) {
    console.error("[tasklog/by-account]", err.message);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

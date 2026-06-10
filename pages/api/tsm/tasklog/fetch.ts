import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { tsm, manager, type, from, to } = req.query;

  if (!tsm && !manager) {
    return res.status(400).json({ error: "tsm or manager query parameter is required" });
  }

  try {
    const db = await connectToDatabase();

    // Build query filter
    const filter: any = {};

    // Filter by Type (e.g., "Site Visit")
    if (type) {
      filter.Type = type;
    }

    // Filter by date range - treat dates as Philippines time (UTC+8)
    if (from || to) {
      filter.date_created = {};
      if (from) {
        // Parse YYYY-MM-DD and treat as start of day in Philippines (UTC+8)
        const [year, month, day] = (from as string).split('-').map(Number);
        const fromDate = new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0)); // Subtract 8 hours for PH timezone
        filter.date_created.$gte = fromDate;
      }
      if (to) {
        // Parse YYYY-MM-DD and treat as end of day in Philippines (UTC+8)
        const [year, month, day] = (to as string).split('-').map(Number);
        const toDate = new Date(Date.UTC(year, month - 1, day, -8 + 23, 59, 59, 999)); // End of PH day in UTC
        filter.date_created.$lte = toDate;
      }
    }

    let agentReferenceIds: string[] = [];

    if (tsm) {
      // Filter by TSM - find all agents under this TSM from Supabase
      const { data: agents, error: agentsError } = await supabase
        .from("users")
        .select("ReferenceID")
        .eq("TSM", tsm);
      
      if (agentsError) throw agentsError;
      agentReferenceIds = agents.map(agent => agent.ReferenceID);
    } else if (manager) {
      // Filter by Manager - find all TSMs under this Manager, then agents under those TSMs from Supabase
      // First, get all TSMs under this Manager
      const { data: tsms, error: tsmsError } = await supabase
        .from("users")
        .select("ReferenceID")
        .eq("Manager", manager)
        .eq("Role", "Territory Sales Manager");
      
      if (tsmsError) throw tsmsError;
      const tsmIds = tsms.map(tsm => tsm.ReferenceID);
      
      if (tsmIds.length === 0) {
        return res.status(200).json({ taskLogs: [] });
      }

      // Then get all agents under those TSMs
      const { data: agents, error: agentsError } = await supabase
        .from("users")
        .select("ReferenceID")
        .in("TSM", tsmIds);
      
      if (agentsError) throw agentsError;
      agentReferenceIds = agents.map(agent => agent.ReferenceID);
    }

    if (agentReferenceIds.length === 0) {
      return res.status(200).json({ taskLogs: [] });
    }

    // Filter TaskLog by ReferenceID (agents under this TSM)
    filter.ReferenceID = { $in: agentReferenceIds };

    // Query TaskLog collection
    // Added limit to prevent performance issues with large datasets
    const taskLogs = await db
      .collection("TaskLog")
      .find(filter)
      .sort({ date_created: -1 })
      .limit(500)
      .toArray();

    // Map to expected format - handle all possible field name variations
    const formattedLogs = taskLogs.map(log => {
      // Try all possible casings for SiteVisitAccount
      const siteVisitAccount = log.SiteVisitAccount 
        || log.siteVisitAccount 
        || log.SitevisitAccount 
        || log.sitevisitAccount
        || log["Site Visit Account"]
        || log["site visit account"]
        || null;
      
      // Try all possible casings for Location
      const location = log.Location 
        || log.location 
        || log["Location"]
        || null;
      
      return {
        ReferenceID: log.ReferenceID,
        Type: log.Type,
        SiteVisitAccount: siteVisitAccount,
        Location: location,
        date_created: log.date_created,
      };
    });

    res.status(200).json({ success: true, taskLogs: formattedLogs });
  } catch (error) {
    console.error("Error fetching task logs:", error);
    res.status(500).json({ error: "Server error fetching task logs" });
  }
}

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  try {
    // Build base query for history table - filter for APPROVED quotations (no pagination)
    let query = supabase
      .from("history")
      .select("*")
      .eq("manager", referenceid)
      .eq("type_activity", "Quotation Preparation")
      .or("tsm_approved_status.eq.Approved By Sales Head,tsm_approved_status.eq.Approved");

    // Apply date range filter
    if (from && typeof from === "string") {
      query = query.gte("date_created", from);
    }
    if (to && typeof to === "string") {
      query = query.lte("date_created", to);
    }

    // Execute query (no pagination limit)
    const { data, error } = await query;

    if (error) {
      console.error("History query error:", error);
      throw error;
    }

    // Filter out items without meaningful data
    const filteredData = (data || []).filter((item: any) => {
      const columnsToCheck = ["activity_reference_number", "referenceid", "quotation_number", "quotation_amount"];
      return columnsToCheck.some((col) => {
        const val = item[col];
        if (val === null || val === undefined) return false;
        if (typeof val === "string") return val.trim() !== "";
        if (typeof val === "number") return !isNaN(val);
        return Boolean(val);
      });
    });

    // Get all unique TSM and Agent reference IDs
    const tsmIds = [...new Set(filteredData.map((item: any) => item.tsm).filter(Boolean))];
    const agentIds = [...new Set(filteredData.map((item: any) => item.referenceid).filter(Boolean))];
    
    // Fetch TSM data from Supabase
    const tsmMap = new Map<string, any>();
    if (tsmIds.length > 0) {
      const { data: tsmUsers } = await supabase
        .from("users")
        .select("ReferenceID, Firstname, Lastname")
        .in("ReferenceID", tsmIds);
      
      tsmUsers?.forEach((tsm: any) => {
        tsmMap.set(tsm.ReferenceID, `${tsm.Firstname} ${tsm.Lastname}`);
      });
    }
    
    // Fetch Agent data from Supabase
    const agentMap = new Map<string, any>();
    if (agentIds.length > 0) {
      const { data: agentUsers } = await supabase
        .from("users")
        .select("ReferenceID, Firstname, Lastname")
        .in("ReferenceID", agentIds);
      
      agentUsers?.forEach((agent: any) => {
        agentMap.set(agent.ReferenceID, `${agent.Firstname} ${agent.Lastname}`);
      });
    }

    // Calculate TSM statistics
    const tsmStatsMap = new Map<string, any>();
    filteredData.forEach((item: any) => {
      const tsmId = item.tsm || "unknown";
      const tsmName = tsmMap.get(tsmId) || "Unknown TSM";

      if (!tsmStatsMap.has(tsmId)) {
        tsmStatsMap.set(tsmId, {
          tsmId,
          tsmName,
          approved: 0,
          total: 0,
        });
      }

      const stat = tsmStatsMap.get(tsmId)!;
      stat.total += 1;
      stat.approved += 1; // All items are approved in this API
    });

    // Calculate Agent statistics
    const agentStatsMap = new Map<string, any>();
    filteredData.forEach((item: any) => {
      const agentId = item.referenceid || "unknown";
      const agentName = agentMap.get(agentId) || "Unknown Agent";

      if (!agentStatsMap.has(agentId)) {
        agentStatsMap.set(agentId, {
          agentId,
          agentName,
          total: 0,
        });
      }

      const stat = agentStatsMap.get(agentId)!;
      stat.total += 1;
    });

    // Generate TSM filter options
    const tsmOptions = Array.from(tsmStatsMap.values()).map((tsm: any) => ({
      value: tsm.tsmId,
      label: tsm.tsmName,
    }));

    // Generate Agent filter options
    const agentOptions = Array.from(agentStatsMap.values()).map((agent: any) => ({
      value: agent.agentId,
      label: agent.agentName,
    }));

    const response = {
      tsmStats: Array.from(tsmStatsMap.values()).sort((a, b) => b.total - a.total),
      agentStats: Array.from(agentStatsMap.values()).sort((a, b) => b.total - a.total),
      tsmOptions,
      agentOptions,
      totalCount: filteredData.length,
      approvedCount: filteredData.length, // All are approved
    };

    return res.status(200).json(response);
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ 
      message: err.message || "Server error",
      tsmStats: [],
      agentStats: [],
      tsmOptions: [],
      agentOptions: [],
      totalCount: 0,
      approvedCount: 0,
    });
  }
}

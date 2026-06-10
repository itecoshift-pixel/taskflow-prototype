import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 5000;

const COMPLETED_STATUSES = ["Cancelled", "Done", "Completed", "Delivered"];

async function fetchOverdueActivities(referenceid: string) {
  const COMPLETED_STATUSES = ["Cancelled", "Done", "Completed", "Delivered"];
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const todayISO = todayDate.toISOString();

  const { data, error } = await supabase
    .from("activity")
    .select("*")
    .eq("referenceid", referenceid)
    .lt("scheduled_date", todayISO)
    .not("status", "in", `(${COMPLETED_STATUSES.join(",")})`)
    .order("scheduled_date", { ascending: false })
    .limit(1000); // Limit to 1000 most recent overdue to prevent strain

  if (error) throw error;
  return data || [];
}

async function fetchUnsuccessfulHistory(activityIds: string[]) {
  if (!activityIds.length) return [];

  const { data, error } = await supabase
    .from("history")
    .select("*")
    .in("activity_reference_number", activityIds)
    .eq("call_status", "Unsuccessful")
    .eq("type_activity", "Outbound Calls")
    .order("date_created", { ascending: false })
    .limit(1000);

  if (error) throw error;

  // Filter out those that eventually became successful
  const { data: successfulData, error: errSuccess } = await supabase
    .from("history")
    .select("activity_reference_number")
    .in("activity_reference_number", activityIds)
    .eq("call_status", "Successful")
    .eq("type_activity", "Outbound Calls");

  if (errSuccess) throw errSuccess;

  const successfulSet = new Set(successfulData?.map((h) => h.activity_reference_number));
  return (data || []).filter((h) => !successfulSet.has(h.activity_reference_number));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  try {
    const activities = await fetchOverdueActivities(referenceid);
    const activityIds = activities.map((a) => a.activity_reference_number);
    const unsuccessfulHistory = await fetchUnsuccessfulHistory(activityIds);

    return res.status(200).json({
      activities,
      history: unsuccessfulHistory,
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
}
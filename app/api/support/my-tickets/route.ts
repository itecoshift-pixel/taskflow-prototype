import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

// GET /api/support/my-tickets?requestor_id=<id>
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestor_id = searchParams.get("requestor_id");

  if (!requestor_id) {
    return NextResponse.json({ success: false, error: "requestor_id required" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("tickets")
      .select("ticket_id, ticket_subject, status, date_created, technician_name, processed_by")
      .eq("requestor_id", requestor_id)
      .order("date_created", { ascending: false })
      .limit(20);

    if (error) throw error;

    // Fetch unseen bot message counts per ticket in one query
    const ticketIds = (data ?? []).map((t: any) => t.ticket_id);
    const unseenMap: Record<string, number> = {};

    if (ticketIds.length > 0) {
      const { data: unseenData } = await supabase
        .from("ticket_conversations")
        .select("ticket_id")
        .in("ticket_id", ticketIds)
        .neq("sender", "user")
        .eq("is_seen", false);

      if (unseenData) {
        for (const row of unseenData) {
          unseenMap[row.ticket_id] = (unseenMap[row.ticket_id] ?? 0) + 1;
        }
      }
    }

    const tickets = (data ?? []).map((t: any) => ({
      ticket_id:       t.ticket_id,
      ticket_subject:  t.ticket_subject,
      status:          t.status,
      date_created:    t.date_created,
      technician_name: t.technician_name,
      processed_by:    t.processed_by,
      unseen_count:    unseenMap[t.ticket_id] ?? 0,
    }));

    return NextResponse.json({ success: true, tickets });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

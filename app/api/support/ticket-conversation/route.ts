import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

// GET /api/support/ticket-conversation?ticket_id=<id>
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticket_id = searchParams.get("ticket_id");

  if (!ticket_id) {
    return NextResponse.json({ success: false, error: "ticket_id required" }, { status: 400 });
  }

  try {
    const [ticketRes, convRes] = await Promise.all([
      supabase
        .from("tickets")
        .select("ticket_id, ticket_subject, status, requestor_name, department, group_services, remarks, date_created, technician_name, processed_by")
        .eq("ticket_id", ticket_id)
        .single(),
      supabase
        .from("ticket_conversations")
        .select("id, sender, message, file_url, file_type, file_name, date_created, is_seen")
        .eq("ticket_id", ticket_id)
        .order("date_created", { ascending: true }),
    ]);

    if (ticketRes.error) throw ticketRes.error;
    if (convRes.error)   throw convRes.error;

    return NextResponse.json({
      success: true,
      ticket:        ticketRes.data,
      conversations: convRes.data ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

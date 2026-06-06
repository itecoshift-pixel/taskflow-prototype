import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

async function generateTicketId(): Promise<string> {
  const today = new Date();
  const yyyy  = today.getFullYear();
  const mm    = String(today.getMonth() + 1).padStart(2, "0");
  const dd    = String(today.getDate()).padStart(2, "0");
  const prefix = `DSI-${yyyy}-${mm}-${dd}-`;

  // Find the highest sequence number for today
  const { data, error } = await supabase
    .from("tickets")
    .select("ticket_id")
    .like("ticket_id", `${prefix}%`)
    .order("ticket_id", { ascending: false })
    .limit(1);

  if (error) throw error;

  let nextSeq = 1;
  if (data && data.length > 0) {
    const lastId  = data[0].ticket_id as string;
    const lastSeq = parseInt(lastId.replace(prefix, ""), 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(3, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      requestor_name, requestor_id, department, mode, group_services,
      remarks, ticket_subject, session_id,
    } = body;

    if (!requestor_name || !ticket_subject) {
      return NextResponse.json(
        { success: false, error: "requestor_name and ticket_subject are required" },
        { status: 400 }
      );
    }

    const ticket_id = await generateTicketId();

    // ── 1. Create the ticket ────────────────────────────────────────────────
    const { data, error } = await supabase
      .from("tickets")
      .insert([{
        ticket_id,
        requestor_name,
        requestor_id:   requestor_id   ?? null,
        department:     department     ?? null,
        mode:           mode           ?? null,
        group_services: group_services ?? null,
        remarks:        remarks        ?? null,
        ticket_subject,
        status:         "Pending",
        date_created:   new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;

    // ── 2. Migrate conversation from session_id → real ticket_id ───────────
    // Any messages saved with the temp session_id are re-linked to the ticket
    if (session_id && session_id !== ticket_id) {
      await supabase
        .from("ticket_conversations")
        .update({ ticket_id })
        .eq("ticket_id", session_id);
      // Ignore migration errors — non-critical
    }

    return NextResponse.json({ success: true, ticket: data });
  } catch (err: any) {
    console.error("[support/create-ticket]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

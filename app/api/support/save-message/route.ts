import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

// POST /api/support/save-message
export async function POST(req: NextRequest) {
  try {
    const { ticket_id, sender, message, file_url, file_type, file_name } = await req.json();

    if (!ticket_id || !sender) {
      return NextResponse.json(
        { success: false, error: "ticket_id and sender are required" },
        { status: 400 }
      );
    }

    // Allow file-only messages (no text required if there's a file)
    if (!message && !file_url) {
      return NextResponse.json(
        { success: false, error: "message or file_url is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("ticket_conversations").insert([{
      ticket_id,
      sender,
      message:    message   ?? "",
      file_url:   file_url  ?? null,
      file_type:  file_type ?? null,
      file_name:  file_name ?? null,
      date_created: new Date().toISOString(),
      is_seen: sender === "user" ? true : false,
    }]);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[support/save-message]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

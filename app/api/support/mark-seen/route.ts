import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

// POST /api/support/mark-seen
// Marks all unseen bot messages for a ticket as seen
export async function POST(req: NextRequest) {
  try {
    const { ticket_id } = await req.json();

    if (!ticket_id) {
      return NextResponse.json(
        { success: false, error: "ticket_id required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("ticket_conversations")
      .update({ is_seen: true })
      .eq("ticket_id", ticket_id)
      .neq("sender", "user")
      .eq("is_seen", false);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[support/mark-seen]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

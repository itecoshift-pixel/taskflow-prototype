import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

export interface TableStyles {
  th_bg: string;
  td_text: string;
  th_text: string;
  table_bg: string;
  tfoot_bg: string;
  td_border: string;
  th_border: string;
  tr_border: string;
  td_padding: string;
  tfoot_text: string;
  th_padding: string;
  tr_hover_bg: string;
  table_border: string;
  td_font_size: string;
  tfoot_border: string;
  th_font_size: string;
  tfoot_padding: string;
  tfoot_font_size: string;
  table_border_radius: string;
}

export const DEFAULT_TABLE_STYLES: TableStyles = {
  th_bg: "#f8fafc",
  td_text: "#334155",
  th_text: "#475569",
  table_bg: "#ffffff",
  tfoot_bg: "#f8fafc",
  td_border: "#e2e8f0",
  th_border: "#e2e8f0",
  tr_border: "#e2e8f0",
  td_padding: "10",
  tfoot_text: "#94a3b8",
  th_padding: "10",
  tr_hover_bg: "#f1f5f9",
  table_border: "#e2e8f0",
  td_font_size: "12",
  tfoot_border: "#e2e8f0",
  th_font_size: "11",
  tfoot_padding: "10",
  tfoot_font_size: "11",
  table_border_radius: "6",
};

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("customize")
      .select("table_styles")
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: true, table_styles: DEFAULT_TABLE_STYLES },
        { status: 200 }
      );
    }

    // Merge with defaults so missing keys always have a fallback
    const merged: TableStyles = { ...DEFAULT_TABLE_STYLES, ...data.table_styles };

    return NextResponse.json(
      { success: true, table_styles: merged },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching table styles:", error);
    return NextResponse.json(
      { success: true, table_styles: DEFAULT_TABLE_STYLES },
      { status: 200 }
    );
  }
}

export const dynamic = "force-dynamic";

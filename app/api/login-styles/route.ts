import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key);
}

export interface LoginFormStyles {
  card_bg: string;
  card_border: string;
  card_shadow: string;
  left_bg: string;
  divider: string;
  title_color: string;
  subtitle_color: string;
  label_color: string;
  input_bg: string;
  input_border: string;
  input_text: string;
  btn_bg: string;
  btn_text: string;
  tab_active: string;
  link_color: string;
}

export const DEFAULT_LOGIN_FORM_STYLES: LoginFormStyles = {
  card_bg: "#ffffff",
  card_border: "#e2e8f0",
  card_shadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
  left_bg: "#ffffff",
  divider: "#e2e8f0",
  title_color: "#1e293b",
  subtitle_color: "#94a3b8",
  label_color: "#334155",
  input_bg: "#f8fafc",
  input_border: "#e2e8f0",
  input_text: "#1e293b",
  btn_bg: "#4f46e5",
  btn_text: "#ffffff",
  tab_active: "#4f46e5",
  link_color: "#4f46e5",
};

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("customize")
      .select("login_form_styles")
      .eq("id", 1)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json(
        { success: true, data: DEFAULT_LOGIN_FORM_STYLES },
        { status: 200 }
      );
    }

    const merged: LoginFormStyles = {
      ...DEFAULT_LOGIN_FORM_STYLES,
      ...(data?.login_form_styles ?? {}),
    };

    return NextResponse.json(
      { success: true, data: merged },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

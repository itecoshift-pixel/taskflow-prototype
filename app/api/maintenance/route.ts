import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key);
}

export interface MaintenanceStyles {
  bg: string;
  border: string;
  title_color: string;
  message_color: string;
  icon_color: string;
}

export const DEFAULT_MAINTENANCE_STYLES: MaintenanceStyles = {
  bg: "#fffbeb",
  border: "#f59e0b",
  title_color: "#92400e",
  message_color: "#78350f",
  icon_color: "#f59e0b",
};

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("customize")
      .select(
        "maintenance_enabled, maintenance_title, maintenance_message, maintenance_banner_preset, maintenance_styles"
      )
      .eq("id", 1)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json(
        {
          success: true,
          data: {
            maintenance_enabled: false,
            maintenance_title: "System Maintenance",
            maintenance_message:
              "We are currently performing scheduled maintenance. Please check back shortly.",
            maintenance_banner_preset: "warning",
            maintenance_styles: DEFAULT_MAINTENANCE_STYLES,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          maintenance_enabled:       data?.maintenance_enabled       ?? false,
          maintenance_title:         data?.maintenance_title         ?? "System Maintenance",
          maintenance_message:       data?.maintenance_message       ?? "We are currently performing scheduled maintenance. Please check back shortly.",
          maintenance_banner_preset: data?.maintenance_banner_preset ?? "warning",
          maintenance_styles:        { ...DEFAULT_MAINTENANCE_STYLES, ...(data?.maintenance_styles ?? {}) },
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

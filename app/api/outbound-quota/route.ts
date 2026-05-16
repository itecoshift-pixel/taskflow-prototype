import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

export async function GET() {
    try {
        const { data, error } = await supabase
            .from("customize")
            .select("outbound_quota")
            .limit(1)
            .single();

        if (error) {
            console.error("Supabase error fetching outbound_quota:", error);
            return NextResponse.json(
                { success: false, error: "outbound_quota not found" },
                { status: 404 }
            );
        }

        if (!data) {
            return NextResponse.json(
                { success: false, error: "outbound_quota not found" },
                { status: 404 }
            );
        }

        const quota = Number(data.outbound_quota);

        if (!Number.isFinite(quota) || quota <= 0) {
            return NextResponse.json(
                { success: false, error: "outbound_quota is not a valid number" },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { success: true, outbound_quota: quota },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error fetching outbound quota:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch outbound quota" },
            { status: 500 }
        );
    }
}

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.TASKFLOW_DB_URL!);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const referenceid = searchParams.get("referenceid");

    if (!referenceid) {
      return NextResponse.json({ success: false, error: "Missing referenceid" }, { status: 400 });
    }

    // Accounts that became Active today based on it_approved_date
    const today = new Date().toISOString().split("T")[0];

    const accounts = await sql`
      SELECT
        id,
        company_name,
        type_client,
        status,
        COALESCE(it_approved_date, date_approved) AS it_approved_date,
        account_reference_number
      FROM accounts
      WHERE referenceid = ${referenceid}
        AND LOWER(status) = 'active'
        AND (
          (it_approved_date IS NOT NULL AND TO_CHAR(it_approved_date::date, 'YYYY-MM-DD') = ${today})
          OR
          (it_approved_date IS NULL AND date_approved IS NOT NULL AND TO_CHAR(date_approved::date, 'YYYY-MM-DD') = ${today})
        )
      ORDER BY COALESCE(it_approved_date, date_approved) DESC;
    `;

    return NextResponse.json({ success: true, data: accounts }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching newly approved accounts:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch accounts." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";

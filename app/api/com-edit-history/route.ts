import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) throw new Error("TASKFLOW_DB_URL is not set.");
const Xchire_sql = neon(Xchire_databaseUrl);

// GET /api/com-edit-history?account_id=<id>
// GET /api/com-edit-history?account_reference_number=<ref>
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const account_id               = searchParams.get("account_id");
  const account_reference_number = searchParams.get("account_reference_number");

  if (!account_id && !account_reference_number) {
    return NextResponse.json(
      { success: false, error: "account_id or account_reference_number required" },
      { status: 400 }
    );
  }

  try {
    const rows = account_id
      ? await Xchire_sql`
          SELECT id, account_id, account_reference_number, referenceid, changed_by,
                 changed_at, field_name, old_value, new_value, reason
          FROM account_edit_history
          WHERE account_id = ${account_id}
          ORDER BY changed_at DESC
          LIMIT 100;
        `
      : await Xchire_sql`
          SELECT id, account_id, account_reference_number, referenceid, changed_by,
                 changed_at, field_name, old_value, new_value, reason
          FROM account_edit_history
          WHERE account_reference_number = ${account_reference_number!}
          ORDER BY changed_at DESC
          LIMIT 100;
        `;

    return NextResponse.json({ success: true, history: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

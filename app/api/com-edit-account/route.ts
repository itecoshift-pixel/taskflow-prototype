import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { logAuditTrailApp } from "@/lib/auditTrail";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}
const Xchire_sql = neon(Xchire_databaseUrl);

function normalizeField(value: any): string {
  if (Array.isArray(value)) {
    const filtered = value.filter((v) => v && v.trim() !== "");
    return filtered.join(", ");
  }
  if (typeof value === "string") return value.trim();
  return "";
}

// Fields to track in history
const TRACKED_FIELDS: { key: string; label: string }[] = [
  { key: "company_name",     label: "Company Name" },
  { key: "contact_person",   label: "Contact Person" },
  { key: "contact_number",   label: "Contact Number" },
  { key: "email_address",    label: "Email Address" },
  { key: "address",          label: "Address" },
  { key: "delivery_address", label: "Delivery Address" },
  { key: "region",           label: "Region" },
  { key: "type_client",      label: "Type Client" },
  { key: "industry",         label: "Industry" },
  { key: "status",           label: "Status" },
  { key: "company_group",    label: "Company Group" },
  { key: "tin_number",       label: "TIN Number" },
];

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      referenceid,
      company_name,
      contact_person,
      contact_number,
      email_address,
      address,
      delivery_address,
      region,
      type_client,
      date_updated,
      industry,
      status,
      company_group,
      tin_number,
      reason,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing account id." }, { status: 400 });
    }

    const contactPersonNorm  = normalizeField(contact_person);
    const contactNumberNorm  = normalizeField(contact_number);
    const emailAddressNorm   = normalizeField(email_address);

    // ── Fetch existing record BEFORE update ──────────────────────────────
    const existing = await Xchire_sql`
      SELECT company_name, contact_person, contact_number, email_address,
             address, delivery_address, region, type_client, industry,
             status, company_group, tin_number, account_reference_number
      FROM accounts
      WHERE id = ${id}
      LIMIT 1;
    `;

    // ── Perform the update ───────────────────────────────────────────────
    const updated = await Xchire_sql`
      UPDATE accounts SET
        referenceid      = ${referenceid},
        company_name     = ${company_name},
        contact_person   = ${contactPersonNorm},
        contact_number   = ${contactNumberNorm},
        email_address    = ${emailAddressNorm},
        address          = ${address},
        delivery_address = ${delivery_address},
        region           = ${region},
        type_client      = ${type_client},
        date_updated     = ${date_updated},
        industry         = ${industry},
        status           = ${status},
        company_group    = ${company_group},
        tin_number       = ${tin_number || null},
        reason           = ${reason || null}
      WHERE id = ${id}
      RETURNING *;
    `;

    if (updated.length === 0) {
      return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
    }

    // ── Log changed fields to history table ─────────────────────────────
    if (existing.length > 0) {
      const old = existing[0];
      const now = new Date().toISOString();

      // Build new values map (normalized for comparison)
      const newValues: Record<string, string> = {
        company_name:     company_name     ?? "",
        contact_person:   contactPersonNorm,
        contact_number:   contactNumberNorm,
        email_address:    emailAddressNorm,
        address:          address          ?? "",
        delivery_address: delivery_address ?? "",
        region:           region           ?? "",
        type_client:      type_client      ?? "",
        industry:         industry         ?? "",
        status:           status           ?? "",
        company_group:    company_group    ?? "",
        tin_number:       tin_number       ?? "",
      };

      const historyRows: any[] = [];
      for (const { key, label } of TRACKED_FIELDS) {
        const oldVal = (old[key] ?? "").toString().trim();
        const newVal = (newValues[key] ?? "").toString().trim();
        if (oldVal !== newVal) {
          historyRows.push({
            account_id:               id.toString(),
            account_reference_number: (old.account_reference_number ?? "").toString(),
            referenceid:              referenceid ?? null,
            changed_by:               referenceid ?? null,
            changed_at:               now,
            field_name:               label,
            old_value:                oldVal || null,
            new_value:                newVal || null,
            reason:                   reason || null,
          });
        }
      }

      // Bulk insert history rows
      if (historyRows.length > 0) {
        for (const row of historyRows) {
          await Xchire_sql`
            INSERT INTO account_edit_history
              (account_id, account_reference_number, referenceid, changed_by, changed_at, field_name, old_value, new_value, reason)
            VALUES
              (${row.account_id}, ${row.account_reference_number}, ${row.referenceid}, ${row.changed_by},
               ${row.changed_at}, ${row.field_name}, ${row.old_value}, ${row.new_value}, ${row.reason});
          `;
        }
      }
    }

    // ── Audit trail ──────────────────────────────────────────────────────
    await logAuditTrailApp(
      req,
      "update",
      "company account",
      id,
      company_name,
      `Updated company account: ${company_name}`,
      { company_name, status, region }
    );

    return NextResponse.json({ success: true, data: updated[0] }, { status: 200 });
  } catch (error: any) {
    console.error("Error updating account:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update account." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";

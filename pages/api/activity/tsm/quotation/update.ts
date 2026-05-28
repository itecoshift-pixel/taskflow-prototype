import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const {
    quotation_number,
    tsm_approved_status,
    tsm_remarks,
    contact,
    email,
    signature,
  } = req.body;

  /* =============================
     1️⃣ VALIDATION
  ============================= */
  if (!quotation_number || typeof quotation_number !== "string") {
    return res.status(400).json({
      message: "Missing or invalid quotation_number",
    });
  }

  const allowedStatuses = ["Approved", "Decline", "Endorsed to Sales Head"];
  if (!allowedStatuses.includes(tsm_approved_status)) {
    return res.status(400).json({
      message: "Invalid tsm_approved_status",
    });
  }

  if (
    tsm_approved_status === "Decline" &&
    (!tsm_remarks || !tsm_remarks.trim())
  ) {
    return res.status(400).json({
      message: "TSM remarks is required when declining",
    });
  }

  try {
    const now = new Date().toISOString();

    /* =============================
       2️⃣ UPDATE HISTORY
    ============================= */
    console.log("🔔 TSM API: Updating history table", {
      quotation_number,
      tsm_approved_status,
      timestamp: new Date().toISOString()
    });
    
    const { data: historyData, error: historyError } = await supabase
      .from("history")
      .update({
        tsm_approved_status,
      })
      .eq("quotation_number", quotation_number)
      .select();

    if (historyError) {
      console.log("🔔 TSM API: ❌ History update failed", historyError);
      return res.status(500).json({
        message: historyError.message,
      });
    }

    if (!historyData || historyData.length === 0) {
      console.log("🔔 TSM API: ❌ No history record found");
      return res.status(404).json({
        message: "No matching history record found",
      });
    }

    console.log("🔔 TSM API: ✅ History updated successfully", historyData);

    /* =============================
       3️⃣ FETCH SIGNATORY (SAFE)
    ============================= */
    const { data: signatory, error: signatoryFetchError } = await supabase
      .from("signatories")
      .select("id")
      .eq("quotation_number", quotation_number)
      .maybeSingle(); // 

    if (signatoryFetchError) {
      return res.status(500).json({
        message: signatoryFetchError.message,
      });
    }

    if (!signatory) {
      return res.status(404).json({
        message: "No matching signatory found",
      });
    }

    /* =============================
       4️⃣ UPDATE SIGNATORY
    ============================= */
    const { data: updatedSignatory, error: signatoryUpdateError } =
      await supabase
        .from("signatories")
        .update({
          tsm_contact_number: contact ?? null,
          tsm_email_address: email ?? null,
          tsm_signature:
            tsm_approved_status === "Decline"
              ? null
              : signature ?? null,
          tsm_remarks: tsm_remarks ?? null,
          tsm_approval_date: now,
        })
        .eq("id", signatory.id)
        .select()
        .single(); // safe now (ID-based)

    if (signatoryUpdateError) {
      return res.status(500).json({
        message: signatoryUpdateError.message,
      });
    }

    /* =============================
       5️⃣ LOG AUDIT TRAIL
    ============================= */
    // Log audit trail for TSM quotation approval
    await logAuditTrailWithSession(
      req,
      "update",
      "quotation approval",
      quotation_number,
      quotation_number,
      `TSM ${tsm_approved_status === "Decline" ? "declined" : "approved"} quotation`,
      { status: tsm_approved_status, tsm_remarks }
    );

    /* =============================
       6️⃣ SUCCESS RESPONSE
    ============================= */
    return res.status(200).json({
      success: true,
      history: historyData[0],
      signatory: updatedSignatory,
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({
      message: "Server error",
    });
  }
}
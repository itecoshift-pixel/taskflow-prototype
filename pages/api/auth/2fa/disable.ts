import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { getUserIdFromSession, logAuditTrailWithSession } from "@/lib/auditTrail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const userIdStr = getUserIdFromSession(req);
    if (!userIdStr) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = parseInt(userIdStr, 10);

    // Fetch existing credentials
    const { data: user } = await supabase
      .from("users")
      .select("credentials")
      .eq("id", userId)
      .single();

    const currentCredentials = user?.credentials || {};
    const { twoFactorSecret, ...remainingCredentials } = currentCredentials;

    const { error: updateError } = await supabase
      .from("users")
      .update({
        credentials: remainingCredentials,
        twoFactorEnabled: false,
      })
      .eq("id", userId);

    if (updateError) throw updateError;

    await logAuditTrailWithSession(
      req,
      "action",
      "2FA",
      userId.toString(),
      "Two-Factor Authentication",
      "Disabled 2FA for the account"
    );

    return res.status(200).json({ success: true, message: "2FA disabled successfully" });
  } catch (error: any) {
    console.error("2FA Disable Error:", error);
    return res.status(500).json({ message: error.message || "Internal server error" });
  }
}

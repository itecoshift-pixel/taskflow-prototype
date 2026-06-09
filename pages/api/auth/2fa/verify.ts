import { NextApiRequest, NextApiResponse } from "next";
import { verify } from "otplib";
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
    const { secret, token } = req.body;

    if (!secret || !token) {
      return res.status(400).json({ message: "Secret and token are required" });
    }

    const result = await verify({ token, secret });

    if (!result.valid) {
      return res.status(400).json({ message: "Invalid OTP token" });
    }

    // Fetch existing credentials
    const { data: user } = await supabase
      .from("users")
      .select("credentials")
      .eq("id", userId)
      .single();

    const currentCredentials = user?.credentials || {};

    // Save secret in credentials and enable 2FA
    const { error: updateError } = await supabase
      .from("users")
      .update({
        credentials: {
          ...currentCredentials,
          twoFactorSecret: secret,
        },
        twoFactorEnabled: true,
      })
      .eq("id", userId);

    if (updateError) throw updateError;

    await logAuditTrailWithSession(
      req,
      "action",
      "2FA",
      userId.toString(),
      "Two-Factor Authentication",
      "Enabled 2FA for the account"
    );

    return res.status(200).json({ success: true, message: "2FA enabled successfully" });
  } catch (error: any) {
    console.error("2FA Verify Error:", error);
    return res.status(500).json({ message: error.message || "Internal server error" });
  }
}

import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";
import { supabase } from "@/utils/supabase";
import { hashPassword } from "@/lib/auth";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const db = await connectToDatabase();

  const reset = await db.collection("password_resets").findOne({
    token,
    expiresAt: { $gt: new Date() },
  });

  if (!reset) {
    return res.status(400).json({ message: "Token expired or invalid" });
  }

  const hashedPassword = await hashPassword(newPassword);

  // Update password in Supabase instead of MongoDB
  const { error: updateError } = await supabase
    .from("users")
    .update({
      Password: hashedPassword,
      LoginAttempts: 0,
      Status: "Active",
      LockUntil: null,
    })
    .eq("Email", reset.email);

  if (updateError) {
    console.error("Error updating password in Supabase:", updateError);
    return res.status(500).json({ message: "Server error resetting password" });
  }

  // 🔥 delete token after use in MongoDB
  await db.collection("password_resets").deleteOne({ token });

  // Log audit trail for password reset
  await logAuditTrailWithSession(
    req,
    "update",
    "password",
    reset.email,
    reset.email,
    `Password reset for ${reset.email}`,
    { action: "password_reset" }
  );

  return res.status(200).json({ message: "Password reset successful" });
}

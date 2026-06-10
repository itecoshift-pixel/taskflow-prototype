import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";
import { supabase } from "@/utils/supabase";
import crypto from "crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  // Check user in Supabase instead of MongoDB
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("Email")
    .eq("Email", email)
    .single();

  // ⚠️ silent success (security)
  if (userError || !user) {
    return res.status(200).json({ message: "If email exists, reset link was sent." });
  }

  const db = await connectToDatabase();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

  // Store reset token in MongoDB (keeping existing logic for password_resets)
  await db.collection("password_resets").insertOne({
    email,
    token,
    expiresAt,
    createdAt: new Date(),
  });

  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL_PROD}/auth/reset-password?token=${token}`;

  try {
    await resend.emails.send({
      from: "Taskflow Support <onboarding@resend.dev>", // Note: Use your verified domain in production
      to: email,
      subject: "Reset Your Taskflow Password",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>Password Reset Request</h2>
          <p>You requested a password reset for your Taskflow account.</p>
          <p>Click the button below to reset your password. This link will expire in 30 minutes.</p>
          <div style="margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; rounded: 8px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #666; font-size: 12px;">${resetLink}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({ message: "Reset link sent." });
  } catch (error) {
    console.error("Error sending email via Resend:", error);
    return res.status(500).json({ message: "Failed to send reset email." });
  }
}

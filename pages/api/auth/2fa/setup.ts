import { NextApiRequest, NextApiResponse } from "next";
import { generateSecret, generateURI } from "otplib";

import { supabase } from "@/utils/supabase";
import { getUserIdFromSession } from "@/lib/auditTrail";

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
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user session" });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("Email, credentials")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      console.error("2FA Setup Fetch Error:", userError, "for ID:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    // Use credentials JSONB to store 2FA secret
    const credentials = user.credentials || {};
    let secret = credentials.twoFactorSecret;
    
    if (!secret) {
      secret = generateSecret();
    }

    const otpauth = generateURI({
      issuer: "Taskflow",
      label: user.Email,
      secret: secret,
    });

    return res.status(200).json({
      secret,
      otpauth,
    });
  } catch (error: any) {
    console.error("2FA Setup Error:", error);
    return res.status(500).json({ message: error.message || "Internal server error" });
  }
}

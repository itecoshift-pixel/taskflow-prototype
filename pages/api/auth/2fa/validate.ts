import { NextApiRequest, NextApiResponse } from "next";
import { verify } from "otplib";
import { supabase } from "@/utils/supabase";
import { serialize } from "cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { userId, token, deviceId } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ message: "User ID and token are required" });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", parseInt(userId))
      .single();

    if (userError || !user) {
      return res.status(404).json({ message: "User not found" });
    }

    const credentials = user.credentials || {};
    const secret = credentials.twoFactorSecret;

    if (!user.twoFactorEnabled || !secret) {
      return res.status(400).json({ message: "2FA is not enabled for this user" });
    }

    const result = await verify({
      token,
      secret: secret,
    });

    if (!result.valid) {
      return res.status(401).json({ message: "Invalid OTP token" });
    }

    // Success - Complete login
    await supabase
      .from("users")
      .update({
        LoginAttempts: 0,
        Status: "Active",
        LockUntil: null,
        DeviceId: deviceId || user.DeviceId,
        Connection: "Online",
        LastLoginAt: new Date().toISOString()
      })
      .eq("id", userId);

    res.setHeader(
      "Set-Cookie",
      serialize("session", userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== "development",
        sameSite: "strict",
        maxAge: 60 * 60 * 12,
        path: "/",
      })
    );

    return res.status(200).json({
      message: "Login successful",
      userId,
      Role: user.Role,
      Department: user.Department,
      Status: user.Status,
      ReferenceID: user.ReferenceID,
      TSM: user.TSM,
      Manager: user.Manager,
    });
  } catch (error: any) {
    console.error("2FA Validation Error:", error);
    return res.status(500).json({ message: error.message || "Internal server error" });
  }
}

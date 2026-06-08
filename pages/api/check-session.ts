// pages/api/check-session.ts

import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";
import { parse } from "cookie";
import { ObjectId } from "mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
  const sessionUserId = cookies.session;
  const deviceId = req.headers["x-device-id"];

  if (!sessionUserId || !ObjectId.isValid(sessionUserId) || !deviceId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = await connectToDatabase();
  const users = db.collection("users");

  const user = await users.findOne({ _id: new ObjectId(sessionUserId) });
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  // Check if user logged in with master password (no DeviceId set)
  const isMasterPasswordLogin = !user.DeviceId;
  
  if (!isMasterPasswordLogin && user.DeviceId !== deviceId) {
    // Get client IP address and device info for the security alert
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || "Unknown device";
    
    return res.status(409).json({ 
      error: "Multiple device access detected", 
      ipAddress: clientIp,
      deviceInfo: userAgent
    });
  }

  return res.status(200).json({ 
    message: "Session valid", 
    user,
    isMasterPasswordLogin // Return this info to the frontend
  });
}
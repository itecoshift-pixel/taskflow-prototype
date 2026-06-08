// pages/api/override-session.ts

import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";
import { parse } from "cookie";
import { ObjectId } from "mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
  const sessionUserId = cookies.session;
  const deviceId = req.headers["x-device-id"];

  if (!sessionUserId || !ObjectId.isValid(sessionUserId) || !deviceId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const db = await connectToDatabase();
    const users = db.collection("users");

    const user = await users.findOne({ _id: new ObjectId(sessionUserId) });
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Check if this is a master password login (no DeviceId set)
    const isMasterPasswordLogin = !user.DeviceId;
    
    const updateData: any = { Connection: "Online" };
    
    // Only set DeviceId for non-master password logins to allow multiple access
    if (!isMasterPasswordLogin) {
      updateData.DeviceId = deviceId;
    }
    
    await users.updateOne(
      { _id: new ObjectId(sessionUserId) },
      { $set: updateData }
    );

    return res.status(200).json({ message: "Session overridden successfully" });
  } catch (error) {
    console.error("Session override error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
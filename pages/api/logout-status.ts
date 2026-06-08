import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb"; // <-- import dito

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { userId } = req.body;

  if (!userId || !ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Valid userId is required" });
  }

  try {
    const db = await connectToDatabase();
    const users = db.collection("users");

    await users.updateOne(
      { _id: new ObjectId(userId) }, // <-- dito
      { $set: { Connection: "Offline" } }
    );

    return res.status(200).json({ message: "ConnectionStatus updated to Offline" });
  } catch (error) {
    console.error("Error updating connection status", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

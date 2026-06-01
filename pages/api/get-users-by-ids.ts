import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { userIds } = req.body;

  if (!userIds || !Array.isArray(userIds)) {
    return res.status(400).json({ message: "Invalid userIds array" });
  }

  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection("users");

    // Convert string IDs to ObjectId
    const objectIds = userIds
      .filter(id => ObjectId.isValid(id))
      .map(id => new ObjectId(id));

    // Fetch users with only necessary fields
    const users = await usersCollection
      .find({ _id: { $in: objectIds } })
      .project({ 
        _id: 1, 
        Firstname: 1, 
        Lastname: 1,
        userName: 1,
        profilePicture: 1,
        Department: 1
      })
      .toArray();

    // Create a map of userId -> user data
    const userMap: Record<string, { firstName: string; lastName: string; userName: string; profilePicture?: string; department?: string }> = {};
    
    users.forEach(user => {
      userMap[user._id.toString()] = {
        firstName: user.Firstname || "",
        lastName: user.Lastname || "",
        userName: user.userName || "",
        profilePicture: user.profilePicture || "",
        department: user.Department || ""
      };
    });

    return res.status(200).json({ users: userMap });
  } catch (err) {
    console.error("Error fetching users:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

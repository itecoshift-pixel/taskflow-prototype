// import { NextApiRequest, NextApiResponse } from "next";
// import { connectToDatabase } from "@/lib/mongodb";
// import { ObjectId } from "mongodb";

// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   if (req.method === "GET") {
//     const db = await connectToDatabase();
//     const userId = req.query.id as string;

//     if (!userId) {
//       return res.status(400).json({ error: "User ID is required" });
//     }

//     try {
//       // Find the user by ID
//       const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });

//       if (user) {
//         // Respond with all user fields except the password
//         const { password, ...userData } = user;
//         res.status(200).json(userData);
//       } else {
//         res.status(404).json({ error: "User not found" });
//       }
//     } catch (error) {
//       console.error("Error fetching user data:", error);
//       res.status(500).json({ error: "Invalid user ID format or server error" });
//     }
//   } else {
//     res.setHeader("Allow", ["GET"]);
//     res.status(405).json({ error: `Method ${req.method} not allowed` });
//   }
// }

import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const userId = req.query.id as string;

  if (!userId || !ObjectId.isValid(userId)) {
    return res.status(400).json({ error: "Invalid or missing User ID" });
  }

  try {
    const db = await connectToDatabase();

    // 1. Fetch the primary user
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 2. Fetch Manager and TSM details using their ReferenceIDs
    // We fetch them in parallel to save time
    const [managerData, tsmData] = await Promise.all([
      user.Manager ? db.collection("users").findOne({ ReferenceID: user.Manager }) : null,
      user.TSM ? db.collection("users").findOne({ ReferenceID: user.TSM }) : null,
    ]);

    // 3. Construct the response
    const { password, ...userData } = user;

    res.status(200).json({
      ...userData,
      managerDetails: managerData ? {
        firstname: managerData.Firstname,
        lastname: managerData.Lastname,
        email: managerData.Email,
        profilePicture: managerData.profilePicture,
        signatureImage: managerData.signatureImage,
        contact: managerData.ContactNumber
      } : null,
      tsmDetails: tsmData ? {
        firstname: tsmData.Firstname,
        lastname: tsmData.Lastname,
        email: tsmData.Email,
        profilePicture: tsmData.profilePicture,
        signatureImage: tsmData.signatureImage,
        contact: tsmData.ContactNumber
      } : null
    });

  } catch (error) {
    console.error("Error fetching user hierarchy:", error);
    res.status(500).json({ error: "Server error" });
  }
}

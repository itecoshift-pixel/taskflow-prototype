import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import { v2 as cloudinary } from "cloudinary";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Utility to extract Public ID from a Cloudinary URL
 * Example: .../v12345/folder/image_id.png -> folder/image_id
 */

const extractPublicId = (url: string) => {
  if (!url || !url.includes("cloudinary")) return null;
  const parts = url.split("/");
  const uploadIndex = parts.indexOf("upload");
  if (uploadIndex === -1) return null;
  
  // Join all parts after 'upload/' and the version (v1234567)
  const relevantParts = parts.slice(uploadIndex + 2); 
  const fileWithExtension = relevantParts.join("/");
  return fileWithExtension.split(".")[0];
};

export default async function updateProfile(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    id,
    Firstname,
    Lastname,
    Email,
    Role,
    Department,
    Status,
    ContactNumber,
    Password,
    profilePicture,
    signatureImage,
    OtherEmail,
    AnotherNumber,
    Address,
    Birthday,
    Gender
  } = req.body;

  if (!id || !ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Valid User ID is required" });
  }

  try {
    const db = await connectToDatabase();
    const userCollection = db.collection("users");
    const userObjectId = new ObjectId(id);

    // 1. Fetch current user data for asset comparison
    const currentUser = await userCollection.findOne({ _id: userObjectId });
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const updatedUser: any = {
      Firstname,
      Lastname,
      Email,
      Role,
      Department,
      Status,
      ContactNumber,
      OtherEmail,
      AnotherNumber,
      Address,
      Birthday,
      Gender,
      updatedAt: new Date(),
    };

    // 2. Handle Profile Picture Deletion/Update
    if (profilePicture && profilePicture !== currentUser.profilePicture) {
      const oldPublicId = extractPublicId(currentUser.profilePicture);
      if (oldPublicId) {
        await cloudinary.uploader.destroy(oldPublicId).catch(err => 
          console.error("Cloudinary Delete Error (Profile):", err)
        );
      }
      updatedUser.profilePicture = profilePicture;
    }

    // 3. Handle Signature Image Deletion/Update
    if (signatureImage && signatureImage !== currentUser.signatureImage) {
      const oldPublicId = extractPublicId(currentUser.signatureImage);
      if (oldPublicId) {
        await cloudinary.uploader.destroy(oldPublicId).catch(err => 
          console.error("Cloudinary Delete Error (Signature):", err)
        );
      }
      updatedUser.signatureImage = signatureImage;
    }

    // 4. Handle Password Hashing
    if (Password && Password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(Password, 10);
      updatedUser.Password = hashedPassword;
    }

    const result = await userCollection.updateOne(
      { _id: userObjectId },
      { $set: updatedUser }
    );

    if (result.matchedCount === 1) {
      // Log audit trail for profile update
      await logAuditTrailWithSession(
        req,
        "update",
        "user profile",
        id,
        `${Firstname} ${Lastname}`,
        `Updated profile for ${Firstname} ${Lastname}`,
        { updatedFields: Object.keys(updatedUser).filter(k => k !== "updatedAt") }
      );

      return res.status(200).json({ message: "Profile updated successfully" });
    } else {
      return res.status(404).json({ error: "No changes applied" });
    }
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
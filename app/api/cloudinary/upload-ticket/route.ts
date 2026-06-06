import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const isPdf = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");

    if (!isPdf && !isImage) {
      return NextResponse.json({ error: "Only images and PDFs are allowed" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUri = `data:${file.type};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "support/tickets",
      resource_type: isPdf ? "raw" : "image",
      // For PDFs store original filename
      ...(isPdf && { use_filename: true, unique_filename: true }),
    });

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      fileType: isPdf ? "pdf" : "image",
      fileName: file.name,
    });
  } catch (error) {
    console.error("[upload-ticket] error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// GET /api/support/download-file?url=<encoded_url>&name=<filename>
// Proxies the file from Cloudinary and forces a download
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fileUrl = searchParams.get("url");
  const fileName = searchParams.get("name") ?? "download";

  if (!fileUrl) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Only allow Cloudinary URLs
  if (!fileUrl.startsWith("https://res.cloudinary.com/")) {
    return NextResponse.json({ error: "Invalid file source" }, { status: 403 });
  }

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error("Failed to fetch file");

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

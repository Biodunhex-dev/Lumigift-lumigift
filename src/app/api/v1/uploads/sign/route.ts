import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, withCsrf } from "@/server/middleware";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "gif", "webp"];
const UPLOAD_FOLDER = "gift-media";

function sign(params: Record<string, string | number>): string {
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!secret) throw new Error("CLOUDINARY_API_SECRET is not set");

  const payload = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  return crypto
    .createHash("sha256")
    .update(payload + secret)
    .digest("hex");
}

export const POST = withErrorHandler(withCsrf(async (_req: NextRequest) => {
  const timestamp = Math.floor(Date.now() / 1000);

  const params: Record<string, string | number> = {
    timestamp,
    folder: UPLOAD_FOLDER,
    allowed_formats: ALLOWED_FORMATS.join(","),
    max_file_size: MAX_FILE_BYTES,
  };

  const signature = sign(params);

  return NextResponse.json({
    signature,
    timestamp,
    folder: UPLOAD_FOLDER,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
}));

import { NextRequest, NextResponse } from "next/server";
import { sendOtp } from "@/lib/sms";
import { storeOtp } from "@/lib/otp";
import { withErrorHandler, withCsrf, validateRequest } from "@/server/middleware";
import { getRedisClient } from "@/lib/redis";
import { sendOtpBodySchema } from "@/lib/schemas";
import type { ApiResponse } from "@/types";

// Uniform success message — never reveal whether the number is registered.
const OTP_RESPONSE = { message: "If this number is registered, an OTP has been sent." };

async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<{ allowed: boolean; retryAfter: number }> {
  const redis = await getRedisClient();
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSec);
  const ttl = await redis.ttl(key);
  return { allowed: count <= limit, retryAfter: ttl };
}

export const POST = withErrorHandler(withCsrf(async (req: NextRequest) => {
  // ── Validate request body ────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const validation = validateRequest(sendOtpBodySchema, body);
  if (!validation.success) return validation.errorResponse;

  const { phone } = validation.data;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  // Per-phone: 3 requests per 10 minutes
  const phoneCheck = await checkRateLimit(`rl:otp:phone:${phone}`, 3, 600);
  if (!phoneCheck.allowed) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Too many OTP requests for this number." },
      { status: 429, headers: { "Retry-After": String(phoneCheck.retryAfter) } }
    );
  }

  // Per-IP: 10 requests per hour
  const ipCheck = await checkRateLimit(`rl:otp:ip:${ip}`, 10, 3600);
  if (!ipCheck.allowed) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Too many OTP requests from this IP." },
      { status: 429, headers: { "Retry-After": String(ipCheck.retryAfter) } }
    );
  }

  const otp = await sendOtp(phone);
  await storeOtp(phone, otp);

  if (process.env.NODE_ENV === "development") {
    console.warn(`[DEV] OTP for ${phone}: ${otp}`);
  }

  // Always return the same body regardless of whether the number is registered.
  return NextResponse.json<ApiResponse<{ message: string }>>({
    success: true,
    data: OTP_RESPONSE,
  });
}));

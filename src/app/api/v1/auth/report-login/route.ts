import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { withErrorHandler, validateRequest } from "@/server/middleware";
import { reportLoginBodySchema, reportLoginQuerySchema } from "@/lib/schemas";
import type { ApiResponse } from "@/types";

/**
 * POST /api/v1/auth/report-login
 * Body: { userId: string; fingerprint: string }
 *
 * Also accepts GET with ?uid=&fp= so the SMS link works directly in a browser.
 */
async function handler(req: NextRequest): Promise<NextResponse> {
  let userId: string;
  let fingerprint: string;

  if (req.method === "GET") {
    // ── Validate GET query params ──────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const queryValidation = validateRequest(reportLoginQuerySchema, {
      uid: searchParams.get("uid") ?? undefined,
      fp: searchParams.get("fp") ?? undefined,
    });
    if (!queryValidation.success) return queryValidation.errorResponse;

    userId = queryValidation.data.uid;
    fingerprint = queryValidation.data.fp;
  } else {
    // ── Validate POST request body ─────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const bodyValidation = validateRequest(reportLoginBodySchema, body);
    if (!bodyValidation.success) return bodyValidation.errorResponse;

    userId = bodyValidation.data.userId;
    fingerprint = bodyValidation.data.fingerprint;
  }

  await pool.query(
    `INSERT INTO suspicious_login_reports (user_id, fingerprint)
     VALUES ($1, $2)`,
    [userId, fingerprint]
  );

  return NextResponse.json<ApiResponse<{ message: string }>>({
    success: true,
    data: { message: "Report received. Our team will review your account shortly." },
  });
}

export const GET = withErrorHandler(handler);
export const POST = withErrorHandler(handler);

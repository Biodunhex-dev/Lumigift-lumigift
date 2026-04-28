/**
 * GET /api/v1/csrf
 *
 * Issues a fresh CSRF token for the current session.
 *
 * - Sets an HttpOnly `csrf-token` cookie (not readable by JS)
 * - Returns the token value in the response body so the frontend can store it
 *   in memory and attach it as the `x-csrf-token` header on mutations
 *
 * The endpoint is intentionally unauthenticated — a CSRF token is needed even
 * before the user logs in (e.g. for the OTP / register flows).
 */

import { NextResponse } from "next/server";
import { generateCsrfToken, setCsrfCookie } from "@/lib/csrf";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

export const GET = withErrorHandler(async () => {
  const token = generateCsrfToken();

  const res = NextResponse.json<ApiResponse<{ csrfToken: string }>>({
    success: true,
    data: { csrfToken: token },
  });

  setCsrfCookie(res, token);

  return res;
});

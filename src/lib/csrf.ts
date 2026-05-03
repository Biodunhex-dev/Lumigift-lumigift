/**
 * CSRF protection utilities.
 *
 * Strategy: Double-Submit Cookie pattern with HMAC signing.
 *
 * 1. Server generates a token: HMAC-SHA256(sessionId | timestamp, CSRF_SECRET)
 * 2. Token is stored in an HttpOnly cookie (`csrf-token`) so JS cannot read it.
 * 3. The raw token value is also returned in the API response body so the
 *    frontend can store it in memory and send it as the `x-csrf-token` header.
 * 4. On mutation requests the server compares the header value against the
 *    cookie value using a timing-safe comparison.
 *
 * Webhook routes (Paystack, Stripe) and cron routes are excluded — they use
 * their own signature-based authentication.
 */

import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { ApiError } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const COOKIE_NAME = "csrf-token";
const HEADER_NAME = "x-csrf-token";
/** Token lifetime: 24 hours */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSecret(): string {
  const secret = process.env.CSRF_SECRET;
  if (!secret) throw new Error("Missing required environment variable: CSRF_SECRET");
  return secret;
}

/**
 * Generate a new CSRF token.
 * Format: `<random-hex>.<timestamp>.<hmac>`
 */
export function generateCsrfToken(): string {
  const nonce = randomBytes(16).toString("hex");
  const timestamp = Date.now().toString();
  const secret = getSecret();

  const hmac = createHmac("sha256", secret)
    .update(`${nonce}.${timestamp}`)
    .digest("hex");

  return `${nonce}.${timestamp}.${hmac}`;
}

/**
 * Verify a CSRF token string.
 * Returns false if the token is malformed, expired, or the HMAC is invalid.
 */
export function verifyCsrfToken(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const [nonce, timestamp, providedHmac] = parts;

    // Check expiry
    const issued = parseInt(timestamp, 10);
    if (isNaN(issued) || Date.now() - issued > TOKEN_TTL_MS) return false;

    // Recompute HMAC
    const secret = getSecret();
    const expectedHmac = createHmac("sha256", secret)
      .update(`${nonce}.${timestamp}`)
      .digest("hex");

    // Timing-safe comparison
    const a = Buffer.from(providedHmac.padEnd(expectedHmac.length, "\0"));
    const b = Buffer.from(expectedHmac);
    if (a.length !== b.length) return false;

    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Attach the CSRF token cookie to a response.
 * The cookie is HttpOnly so it cannot be read by JavaScript — the token value
 * must be delivered separately via the response body.
 */
export function setCsrfCookie(res: NextResponse, token: string): void {
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: isProd,
    path: "/",
    maxAge: TOKEN_TTL_MS / 1000, // seconds
  });
}

// ── Route handler types ───────────────────────────────────────────────────────

type Handler = (_req: NextRequest, _context?: unknown) => Promise<NextResponse>;

/**
 * Middleware wrapper that enforces CSRF token validation for state-mutating
 * HTTP methods (POST, PUT, PATCH, DELETE).
 *
 * The client must:
 *   1. Obtain a token from `GET /api/v1/csrf`
 *   2. Include it as the `x-csrf-token` request header on every mutation
 *
 * Returns HTTP 403 on token mismatch or absence.
 */
export function withCsrf(handler: Handler): Handler {
  return async (req, context) => {
    const method = req.method.toUpperCase();
    const MUTATION_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

    if (!MUTATION_METHODS.includes(method)) {
      return handler(req, context);
    }

    const headerToken = req.headers.get(HEADER_NAME);
    const cookieToken = req.cookies.get(COOKIE_NAME)?.value;

    if (!headerToken || !cookieToken) {
      return NextResponse.json<ApiError>(
        { success: false, error: "CSRF token missing", code: "CSRF_MISSING" },
        { status: 403 }
      );
    }

    // Both tokens must match and be individually valid
    if (headerToken !== cookieToken || !verifyCsrfToken(headerToken)) {
      return NextResponse.json<ApiError>(
        { success: false, error: "CSRF token invalid", code: "CSRF_INVALID" },
        { status: 403 }
      );
    }

    return handler(req, context);
  };
}

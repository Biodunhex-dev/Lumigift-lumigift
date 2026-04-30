import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ApiError } from "@/types";
import { requestLogger, getCorrelationId } from "@/lib/logger";

// Re-export CSRF middleware so callers can import from one place
export { withCsrf } from "@/lib/csrf";

type Handler = (_req: NextRequest, _context?: unknown) => Promise<NextResponse>;

/** Wraps a route handler — returns 401 if no session. */
export function withAuth(handler: Handler): Handler {
  return async (req, _context) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json<ApiError>(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    return handler(req, _context);
  };
}

const API_VERSION = "v1";

/** Wraps a route handler with a try/catch — returns 500 on unhandled errors. */
export function withErrorHandler(handler: Handler): Handler {
  return async (req, context) => {
    const correlationId = getCorrelationId(req.headers);
    const log = requestLogger(correlationId);
    try {
      const res = await handler(req, context);
      res.headers.set("X-API-Version", API_VERSION);
      res.headers.set("x-correlation-id", correlationId);
      return res;
    } catch (err) {
      log.error({ err }, "[API Error]");
      const res = NextResponse.json<ApiError>(
        { success: false, error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      );
      res.headers.set("X-API-Version", API_VERSION);
      res.headers.set("x-correlation-id", correlationId);
      return res;
    }
  };
}

/** Rate-limit helper (simple in-memory; swap for Redis in production). */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}

import { NextResponse } from "next/server";
import { getPoolMetrics } from "@/lib/db";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

/**
 * GET /api/v1/health/db
 * Returns database connection pool metrics for monitoring.
 * Should be protected in production (e.g., via API key or internal network).
 */
export const GET = withErrorHandler(async () => {
  // In a real app, you might check for a secret token or admin session here
  const metrics = getPoolMetrics();
  
  return NextResponse.json<ApiResponse<typeof metrics>>({
    success: true,
    data: metrics,
  });
});

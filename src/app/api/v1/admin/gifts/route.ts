import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, rateLimit, validateRequest, searchParamsToObject } from "@/server/middleware";
import { requireAdmin } from "@/server/middleware/admin";
import { adminListGifts, logAdminAction, type AdminGiftPage } from "@/server/services/admin-gift.service";
import { adminGiftsQuerySchema } from "@/lib/schemas";
import type { ApiResponse } from "@/types";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  // Rate-limit: 60 requests per minute per admin
  if (!rateLimit(`admin:${auth.userId}`, 60, 60_000)) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Too many requests", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  // ── Validate query params ────────────────────────────────────────────────
  const validation = validateRequest(
    adminGiftsQuerySchema,
    searchParamsToObject(req.nextUrl.searchParams)
  );
  if (!validation.success) return validation.errorResponse;

  const { search, status, cursor, limit: queryLimit } = validation.data;

  const page = adminListGifts({
    search,
    status,
    cursor,
    limit: queryLimit,
  });

  logAdminAction(auth.userId, "list_gifts", "all");

  return NextResponse.json<ApiResponse<AdminGiftPage>>({ success: true, data: page });
});

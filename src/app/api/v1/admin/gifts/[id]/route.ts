import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, rateLimit, validateRequest } from "@/server/middleware";
import { requireAdmin } from "@/server/middleware/admin";
import { adminGetGift, logAdminAction } from "@/server/services/admin-gift.service";
import { giftIdParamSchema } from "@/lib/schemas";
import type { ApiResponse, Gift } from "@/types";

export const GET = withErrorHandler(async (req: NextRequest, context: unknown) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  if (!rateLimit(`admin:${auth.userId}`, 60, 60_000)) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Too many requests", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  // ── Validate path param ──────────────────────────────────────────────────
  const { params } = context as { params: { id: string } };
  const paramValidation = validateRequest(giftIdParamSchema, params);
  if (!paramValidation.success) return paramValidation.errorResponse;

  const gift = adminGetGift(paramValidation.data.id);

  if (!gift) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Gift not found" },
      { status: 404 }
    );
  }

  logAdminAction(auth.userId, "view_gift", gift.id);

  return NextResponse.json<ApiResponse<Gift>>({ success: true, data: gift });
});

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createGiftSchema,
  giftsQuerySchema,
} from "@/lib/schemas";
import {
  createGift,
  getGiftsBySenderPaginated,
  getGiftsBySenderPage,
} from "@/server/services/gift.service";
import { withErrorHandler, withCsrf, validateRequest, searchParamsToObject } from "@/server/middleware";
import type { ApiResponse, Gift } from "@/types";
import type { GiftPage, GiftPageOffset } from "@/server/services/gift.service";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  const userId = (session.user as { id: string }).id;

  // ── Validate query params ────────────────────────────────────────────────
  const validation = validateRequest(
    giftsQuerySchema,
    searchParamsToObject(req.nextUrl.searchParams)
  );
  if (!validation.success) return validation.errorResponse;

  const { page, limit, status, cursor, pageSize } = validation.data;

  // Offset-based pagination (page + limit)
  if (req.nextUrl.searchParams.has("page") || req.nextUrl.searchParams.has("limit") || req.nextUrl.searchParams.has("status")) {
    const result = await getGiftsBySenderPage(userId, page, limit, status);
    return NextResponse.json<ApiResponse<GiftPageOffset>>({ success: true, data: result });
  }

  // Cursor-based pagination (legacy)
  const page2 = await getGiftsBySenderPaginated(userId, cursor ?? null, pageSize);
  return NextResponse.json<ApiResponse<GiftPage>>({ success: true, data: page2 });
});

export const POST = withErrorHandler(withCsrf(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // ── Validate request body ────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const validation = validateRequest(createGiftSchema, body);
  if (!validation.success) return validation.errorResponse;

  const userId = (session.user as { id: string }).id;
  const { gift, paymentUrl } = await createGift(
    userId,
    validation.data,
    validation.data.recipientIsRegistered
  );

  return NextResponse.json<ApiResponse<{ gift: Gift; paymentUrl: string }>>(
    { success: true, data: { gift, paymentUrl } },
    { status: 201 }
  );
}));

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGiftById, cancelGift } from "@/server/services/gift.service";
import { refundPayment } from "@/lib/paystack";
import { withErrorHandler, withCsrf, validateRequest } from "@/server/middleware";
import { giftIdParamSchema } from "@/lib/schemas";
import type { ApiResponse, Gift } from "@/types";

export const GET = withErrorHandler(
  async (_req: NextRequest, context: unknown) => {
    // ── Validate path param ────────────────────────────────────────────────
    const { params } = context as { params: { id: string } };
    const paramValidation = validateRequest(giftIdParamSchema, params);
    if (!paramValidation.success) return paramValidation.errorResponse;

    const gift = await getGiftById(paramValidation.data.id);

    if (!gift) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Gift not found" },
        { status: 404 }
      );
    }

    // Strip sensitive sender info for public claim page
    const safeGift: Partial<Gift> = {
      id: gift.id,
      recipientName: gift.recipientName,
      amountNgn: gift.amountNgn,
      message: gift.message,
      mediaUrl: gift.mediaUrl,
      unlockAt: gift.unlockAt,
      status: gift.status,
    };

    return NextResponse.json<ApiResponse<Partial<Gift>>>({
      success: true,
      data: safeGift,
    });
  }
);

export const DELETE = withErrorHandler(
  withCsrf(async (_req: NextRequest, context: unknown) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ── Validate path param ──────────────────────────────────────────────
    const { params } = context as { params: { id: string } };
    const paramValidation = validateRequest(giftIdParamSchema, params);
    if (!paramValidation.success) return paramValidation.errorResponse;

    const gift = await getGiftById(paramValidation.data.id);

    if (!gift) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Gift not found" },
        { status: 404 }
      );
    }

    const userId = (session.user as { id: string }).id;
    if (gift.senderId !== userId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    if (gift.status !== "locked" && gift.status !== "pending_payment") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Gift cannot be cancelled in its current state" },
        { status: 409 }
      );
    }

    if (new Date() >= gift.unlockAt) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Gift unlock time has already passed" },
        { status: 409 }
      );
    }

    // Trigger Paystack refund (reference convention matches gift creation)
    const paystackRef = `lumigift_${gift.id}`;
    await refundPayment(paystackRef);

    const cancelled = await cancelGift(gift.id);

    return NextResponse.json<ApiResponse<Gift>>({
      success: true,
      data: cancelled!,
    });
  })
);

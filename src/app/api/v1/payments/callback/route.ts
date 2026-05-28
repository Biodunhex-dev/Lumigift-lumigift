import { NextRequest, NextResponse } from "next/server";
import { verifyPayment } from "@/lib/paystack";
import { updateGiftStatus } from "@/server/services/gift.service";
import { validateSlippage } from "@/server/services/exchange-rate.service";
import { withErrorHandler, validateRequest, searchParamsToObject } from "@/server/middleware";
import { paystackCallbackQuerySchema } from "@/lib/schemas";

/** Paystack redirects here after payment. */
export const GET = withErrorHandler(async (req: NextRequest) => {
  // ── Validate query params ────────────────────────────────────────────────
  const validation = validateRequest(
    paystackCallbackQuerySchema,
    searchParamsToObject(new URL(req.url).searchParams)
  );

  if (!validation.success) {
    // Paystack callback — redirect to error page rather than returning JSON
    return NextResponse.redirect(new URL("/error?code=bad_callback", req.url));
  }

  const { reference, giftId } = validation.data;

  const result = await verifyPayment(reference);

  if (result.status === "success") {
    // Validate slippage before locking funds
    const slippage = await validateSlippage(giftId);
    if (!slippage.valid) {
      await updateGiftStatus(giftId, "pending_payment");
      const reason = slippage.reason === "rate_expired" ? "rate_expired" : "rate_slippage";
      return NextResponse.redirect(new URL(`/gift/${giftId}/payment-failed?reason=${reason}`, req.url));
    }

    await updateGiftStatus(giftId, "locked");
    return NextResponse.redirect(new URL(`/gift/${giftId}/success`, req.url));
  }

  await updateGiftStatus(giftId, "pending_payment");
  return NextResponse.redirect(new URL(`/gift/${giftId}/payment-failed`, req.url));
});

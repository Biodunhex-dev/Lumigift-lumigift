import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { updateGiftStatus } from "@/server/services/gift.service";
import type { ApiResponse } from "@/types";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!webhookSecret) {
  throw new Error("Missing required environment variable: STRIPE_WEBHOOK_SECRET");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-05-27.dahlia",
});

// Next.js must not parse the body — Stripe needs the raw bytes for signature verification.
// In App Router, request body is not pre-parsed, so no config needed.

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Missing Stripe-Signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const giftId = intent.metadata?.giftId;
    if (giftId) await updateGiftStatus(giftId, "locked");
  }

  return NextResponse.json<ApiResponse<{ received: boolean }>>({
    success: true,
    data: { received: true },
  });
}

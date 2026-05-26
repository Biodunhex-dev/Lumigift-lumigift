import { randomUUID } from "crypto";
import type { Gift, GiftStatus } from "@/types";
import type { CreateGiftInput } from "@/types/schemas";
import { initializePayment, ngnToKobo } from "@/lib/paystack";
import { serverConfig } from "@/server/config";
import { sendGiftReceivedEmail } from "@/lib/email";

// ─── Exchange rate helper ─────────────────────────────────────────────────────
// In production, fetch from a live FX provider (e.g. Stellar DEX or Coingecko).
const NGN_PER_USDC = 1600;

export function ngnToUsdc(ngn: number): string {
  return (ngn / NGN_PER_USDC).toFixed(7);
}

// ─── In-memory store (replace with DB in production) ─────────────────────────
const gifts = new Map<string, Gift>();

export async function createGift(
  senderId: string,
  input: CreateGiftInput
): Promise<{ gift: Gift; paymentUrl: string }> {
  const id = randomUUID();
  const amountUsdc = ngnToUsdc(input.amountNgn);

  const gift: Gift = {
    id,
    senderId,
    recipientPhone: input.recipientPhone,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail || undefined,
    amountNgn: input.amountNgn,
    amountUsdc,
    message: input.message,
    unlockAt: new Date(input.unlockAt),
    status: "pending_payment",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  gifts.set(id, gift);

  const payment = await initializePayment({
    email: `${senderId}@lumigift.app`, // placeholder; use real email from user record
    amountKobo: ngnToKobo(input.amountNgn),
    reference: `lumigift_${id}`,
    callbackUrl: `${serverConfig.app.url}/api/payments/callback?giftId=${id}`,
    metadata: { giftId: id, senderId },
  });

  // Send email notification if recipient email is available (optional field)
  if (input.recipientEmail) {
    sendGiftReceivedEmail(input.recipientEmail, {
      recipientName: input.recipientName,
      unlockAt: new Date(input.unlockAt),
    }).catch((err) => console.error("[email] gift_received failed:", err));
  }

  return { gift, paymentUrl: payment.authorizationUrl };
}

export async function getGiftById(id: string): Promise<Gift | null> {
  return gifts.get(id) ?? null;
}

export async function updateGiftStatus(id: string, status: GiftStatus): Promise<Gift | null> {
  const gift = gifts.get(id);
  if (!gift) return null;
  gift.status = status;
  gift.updatedAt = new Date();
  gifts.set(id, gift);
  return gift;
}

export async function getGiftsBySender(senderId: string): Promise<Gift[]> {
  return [...gifts.values()].filter((g) => g.senderId === senderId);
}

export async function getGiftsByRecipient(phone: string): Promise<Gift[]> {
  return [...gifts.values()].filter((g) => g.recipientPhone === phone);
}

export async function getGiftsByStatus(status: GiftStatus): Promise<Gift[]> {
  return [...gifts.values()].filter((g) => g.status === status);
}

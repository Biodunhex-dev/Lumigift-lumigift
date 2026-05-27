import { randomUUID, createHash } from "crypto";
import pool from "@/lib/db";
import type { Gift, GiftStatus } from "@/types";
import type { CreateGiftInput } from "@/types/schemas";
import { initializePayment, ngnToKobo } from "@/lib/paystack";
import { formatNGN } from "@/lib/currency";
import { serverConfig } from "@/server/config";
import { assertValidTransition } from "./gift-state-machine";
import { createGiftInvitation } from "./invitation.service";
import { sendGiftInvitation } from "@/lib/sms";
import { stripHtmlTags } from "@/lib/sanitize";
import { createAuditLog } from "./audit.service";
import { sendGiftReceivedEmail } from "@/lib/email";

// ─── Exchange rate helper ─────────────────────────────────────────────────────
import { getExchangeRate, lockExchangeRate } from "@/server/services/exchange-rate.service";

/**
 * Converts a Nigerian Naira amount to its USDC equivalent using the live
 * NGN/USDC exchange rate fetched from Stellar Horizon (Redis-cached for 60 s).
 *
 * @param ngn - Amount in Nigerian Naira.
 * @returns The USDC equivalent formatted to 7 decimal places (Stellar precision).
 */
export async function ngnToUsdc(ngn: number): Promise<string> {
  const { ngnPerUsdc } = await getExchangeRate();
  return (ngn / ngnPerUsdc).toFixed(7);
}

/** Hash a phone number for storage. Plaintext is never persisted. */
export function hashPhone(phone: string): string {
  return createHash("sha256").update(phone).digest("hex");
}

// ─── In-memory store (replace with DB in production) ─────────────────────────
export const gifts = new Map<string, Gift>();

/**
 * Creates a new gift record and initializes a Paystack payment session.
 *
 * The gift is stored with status `"pending_payment"` until the Paystack
 * callback confirms the NGN payment, at which point it transitions to
 * `"funded"` and the USDC is locked in the escrow contract.
 *
 * If the recipient is not registered, an invitation token is created and sent via SMS.
 *
 * @param senderId - The authenticated user's ID.
 * @param input - Validated gift creation input (recipient, amount, unlock date, etc.).
 * @param recipientIsRegistered - Whether the recipient is already registered on Lumigift.
 * @returns The created {@link Gift} and the Paystack `paymentUrl` to redirect the user to.
 * @throws If the exchange rate fetch or Paystack initialization fails.
 */
export async function createGift(
  senderId: string,
  input: CreateGiftInput,
  recipientIsRegistered: boolean = true
): Promise<{ gift: Gift; paymentUrl: string }> {
  // ── Daily sending limit check ──────────────────────────────────────────────
  const { dailyLimitNgn } = serverConfig.giftLimits;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTotal = [...gifts.values()]
    .filter((g) => g.senderId === senderId && g.createdAt >= todayStart)
    .reduce((sum, g) => sum + g.amountNgn, 0);
  if (todayTotal + input.amountNgn > dailyLimitNgn) {
    throw new Error(`Daily sending limit of ${formatNGN(dailyLimitNgn)} exceeded`);
  }

  const id = randomUUID();
  const amountUsdc = await ngnToUsdc(input.amountNgn);
  const recipientPhoneHash = hashPhone(input.recipientPhone);

  // Sanitize message content to prevent stored XSS
  const sanitizedMessage = input.message ? stripHtmlTags(input.message) : undefined;

  const gift: Gift = {
    id,
    senderId,
    recipientPhoneHash,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail || undefined,
    amountNgn: input.amountNgn,
    amountUsdc,
    message: sanitizedMessage,
    unlockAt: new Date(input.unlockAt),
    status: "pending_payment",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  gifts.set(id, gift);

  // Lock the exchange rate for slippage protection (expires in 5 minutes)
  await lockExchangeRate(id);

  // Create audit log for gift creation
  await createAuditLog({
    eventType: "gift_created",
    userId: senderId,
    giftId: id,
    amountNgn: input.amountNgn,
    amountUsdc,
    metadata: {
      recipientName: input.recipientName,
      unlockAt: input.unlockAt,
      paymentProvider: input.paymentProvider,
      recipientIsRegistered,
    },
  });

  // If recipient is unregistered, create an invitation and send SMS
  if (!recipientIsRegistered) {
    try {
      const invitationToken = await createGiftInvitation(
        id,
        recipientPhoneHash,
        input.recipientPhone
      );

      // Get sender name for the invitation SMS
      const { rows } = await pool.query<{ display_name: string }>(
        "SELECT display_name FROM users WHERE id = $1",
        [senderId]
      );
      const senderName = rows[0]?.display_name || "Someone";

      // Send invitation SMS (fire-and-forget to not block payment flow)
      sendGiftInvitation(input.recipientPhone, invitationToken, senderName).catch((err) =>
        console.error("[gift] sendGiftInvitation failed:", err)
      );
    } catch (err) {
      console.error("[gift] Failed to create/send invitation:", err);
      // Don't block gift creation on invitation failure
    }
  }

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
    }).catch((err: unknown) => console.error("[email] gift_received failed:", err));
  }

  return { gift, paymentUrl: payment.authorizationUrl };
}

/**
 * Retrieves a gift by its unique ID.
 *
 * @param id - The gift UUID.
 * @returns The {@link Gift} if found, or `null` if it does not exist.
 */
export async function getGiftById(id: string): Promise<Gift | null> {
  return gifts.get(id) ?? null;
}

/**
 * Updates the status of a gift, enforcing valid state-machine transitions.
 *
 * @param id - The gift UUID.
 * @param status - The target {@link GiftStatus}.
 * @returns The updated {@link Gift}, or `null` if the gift does not exist.
 * @throws If the transition from the current status to `status` is not allowed.
 */
export async function updateGiftStatus(id: string, status: GiftStatus): Promise<Gift | null> {
  const gift = gifts.get(id);
  if (!gift) return null;
  assertValidTransition(gift.status, status);
  const previousStatus = gift.status;
  gift.status = status;
  gift.updatedAt = new Date();
  gifts.set(id, gift);

  // Create audit log for status change
  const eventType = status === "funded" ? "gift_funded" as const : 
                    status === "claimed" ? "gift_claimed" as const :
                    status === "cancelled" ? "gift_cancelled" as const : null;

  if (eventType) {
    await createAuditLog({
      eventType,
      userId: gift.senderId,
      giftId: id,
      amountNgn: gift.amountNgn,
      amountUsdc: gift.amountUsdc,
      metadata: {
        previousStatus,
        newStatus: status,
      },
    });
  }

  return gift;
}

/**
 * Returns all gifts created by a given sender.
 *
 * @param senderId - The authenticated user's ID.
 * @returns An array of {@link Gift} objects, possibly empty.
 */
export async function getGiftsBySender(senderId: string): Promise<Gift[]> {
  return [...gifts.values()].filter((g) => g.senderId === senderId);
}

/** Paginated result for {@link getGiftsBySenderPaginated}. */
export interface GiftPage {
  gifts: Gift[];
  total: number;
  nextCursor: string | null;
}

/** Offset-based paginated result for {@link getGiftsBySenderPage}. */
export interface GiftPageOffset {
  data: Gift[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: {
    all: number;
    pending: number;
    claimed: number;
    expired: number;
  };
}

/**
 * Returns a cursor-paginated page of gifts for a sender, sorted by creation
 * date descending (newest first).
 *
 * @param senderId - The authenticated user's ID.
 * @param cursor - The ID of the last gift from the previous page, or `null` for
 *   the first page.
 * @param limit - Maximum number of gifts to return per page.
 * @returns A {@link GiftPage} containing the gifts, total count, and next cursor.
 */
export async function getGiftsBySenderPaginated(
  senderId: string,
  cursor: string | null,
  limit: number
): Promise<GiftPage> {
  const all = [...gifts.values()]
    .filter((g) => g.senderId === senderId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const startIndex = cursor ? all.findIndex((g) => g.id === cursor) + 1 : 0;
  const page = all.slice(startIndex, startIndex + limit);
  const nextCursor = startIndex + limit < all.length ? page[page.length - 1].id : null;

  return { gifts: page, total: all.length, nextCursor };
}

/**
 * Returns an offset-paginated page of gifts for a sender, sorted newest first.
 * Max limit is capped at 100 to prevent abuse.
 *
 * @param senderId - The authenticated user's ID.
 * @param page - 1-based page number (default 1).
 * @param limit - Items per page, max 100 (default 10).
 * @param status - Optional status to filter by.
 * @returns A {@link GiftPageOffset} with data, total, page, limit, totalPages.
 */
export async function getGiftsBySenderPage(
  senderId: string,
  page: number,
  limit: number,
  status?: GiftStatus
): Promise<GiftPageOffset> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const allGifts = [...gifts.values()].filter((g) => g.senderId === senderId);

  const counts = {
    all: allGifts.length,
    pending: allGifts.filter((g) =>
      ["pending_payment", "funded", "locked", "scheduled", "unlocked"].includes(g.status)
    ).length,
    claimed: allGifts.filter((g) => g.status === "claimed").length,
    expired: allGifts.filter((g) => g.status === "expired").length,
  };

  let filtered = allGifts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  if (status && status !== ("all" as any)) {
    if (status === ("pending" as any)) {
      filtered = filtered.filter((g) =>
        ["pending_payment", "funded", "locked", "scheduled", "unlocked"].includes(g.status)
      );
    } else {
      filtered = filtered.filter((g) => g.status === status);
    }
  }

  const offset = (safePage - 1) * safeLimit;
  const data = filtered.slice(offset, offset + safeLimit);
  const total = filtered.length;
  const totalPages = Math.ceil(total / safeLimit) || 1;

  return { data, total, page: safePage, limit: safeLimit, totalPages, counts };
}

/**
 * Returns all gifts where the recipient's phone number matches `phone`.
 *
 * @param phone - E.164-formatted recipient phone number.
 * @returns An array of {@link Gift} objects, possibly empty.
 */
export async function getGiftsByRecipient(phone: string): Promise<Gift[]> {
  const hash = hashPhone(phone);
  return [...gifts.values()].filter((g) => g.recipientPhoneHash === hash);
}

/**
 * Cancels a gift by setting its status to `"cancelled"`.
 * Does not validate the current status — callers should check eligibility first.
 *
 * @param id - The gift UUID.
 * @returns The updated {@link Gift}, or `null` if the gift does not exist.
 */
export async function cancelGift(id: string): Promise<Gift | null> {
  const gift = gifts.get(id);
  if (!gift) return null;
  gift.status = "cancelled";
  gift.updatedAt = new Date();
  gifts.set(id, gift);
  return gift;
}

/**
 * Stores the Stellar transaction hash of the claim operation on the gift record.
 * Called after a successful USDC transfer to the recipient.
 *
 * @param id - The gift UUID.
 * @param txHash - The Stellar transaction hash (64-character hex string).
 * @returns The updated {@link Gift}, or `null` if the gift does not exist.
 */
export async function storeClaimTxHash(id: string, txHash: string): Promise<Gift | null> {
  const gift = gifts.get(id);
  if (!gift) return null;
  gift.claimTxHash = txHash;
  gift.updatedAt = new Date();
  gifts.set(id, gift);
  return gift;
}

/**
 * Retrieves a gift by its on-chain Soroban contract ID.
 *
 * @param contractId - The deployed escrow contract address (C…).
 * @returns The matching {@link Gift}, or `null` if not found.
 */
export async function getGiftByContractId(contractId: string): Promise<Gift | null> {
  for (const gift of gifts.values()) {
    if (gift.contractId === contractId) return gift;
  }
  return null;
}

/**
 * Updates a gift's status only if the transition is valid.
 * Unlike {@link updateGiftStatus}, this is idempotent: if the gift is already
 * in `status` the call is a no-op rather than throwing.
 *
 * @param id - The gift UUID.
 * @param status - The target {@link GiftStatus}.
 * @returns The updated {@link Gift}, or `null` if the gift does not exist.
 */
export async function updateGiftStatusIdempotent(
  id: string,
  status: GiftStatus
): Promise<Gift | null> {
  const gift = gifts.get(id);
  if (!gift) return null;
  if (gift.status === status) return gift; // already in target state — no-op
  try {
    return await updateGiftStatus(id, status);
  } catch {
    // Transition not allowed from current state — log and skip
    console.warn(
      `[gift.service] idempotent update skipped: "${gift.status}" → "${status}" for gift ${id}`
    );
    return gift;
  }
}

export async function getGiftsByStatus(status: GiftStatus): Promise<Gift[]> {
  return [...gifts.values()].filter((g) => g.status === status);
}

/**
 * @jest-environment node
 *
 * Unit tests for src/server/services/gift.service.ts
 *
 * Mocks:
 *  - @/lib/paystack      → initializePayment, ngnToKobo
 *  - @/server/services/exchange-rate.service → getExchangeRate
 *
 * Covers: createGift, getGiftById, listGiftsBySender (getGiftsBySender),
 *         updateGiftStatus — including edge cases and invalid transitions.
 */

import type { Gift } from "@/types";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/paystack", () => ({
  initializePayment: jest.fn(),
  ngnToKobo: jest.fn((ngn: number) => ngn * 100),
}));

jest.mock("@/server/services/exchange-rate.service", () => ({
  getExchangeRate: jest.fn(),
  lockExchangeRate: jest.fn().mockResolvedValue({ lockedRate: 1600, expiresAt: 9999999999 }),
}));

jest.mock("@/server/config", () => ({
  serverConfig: {
    app: { url: "http://localhost:3000", name: "Lumigift" },
    giftLimits: { minAmountNgn: 500, maxAmountNgn: 500000, dailyLimitNgn: 1000000 },
    paystack: { secretKey: "sk_test_placeholder" },
    stellar: { network: "testnet", horizonUrl: "https://horizon-testnet.stellar.org" },
    usdc: { assetCode: "USDC", issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" },
  },
}));

jest.mock("@/lib/db", () => ({
  default: { query: jest.fn().mockResolvedValue({ rows: [{ display_name: "Test User" }] }) },
}));

jest.mock("@/server/services/audit.service", () => ({
  createAuditLog: jest.fn().mockResolvedValue("audit-id"),
}));

jest.mock("@/server/services/invitation.service", () => ({
  createGiftInvitation: jest.fn().mockResolvedValue("invite-token"),
}));

jest.mock("@/lib/sms", () => ({
  sendGiftInvitation: jest.fn().mockResolvedValue(undefined),
}));

import {
  createGift,
  getGiftById,
  getGiftsBySender,
  updateGiftStatus,
  getGiftsBySenderPaginated,
  getGiftsByRecipient,
  cancelGift,
  storeClaimTxHash,
  getGiftByContractId,
  updateGiftStatusIdempotent,
  ngnToUsdc,
  hashPhone,
  gifts,
} from "../gift.service";
import { initializePayment } from "@/lib/paystack";
import { getExchangeRate } from "@/server/services/exchange-rate.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SENDER_ID = "user-sender-1";
const PAYMENT_URL = "https://paystack.com/pay/test-ref";

const baseInput = {
  recipientPhone: "+2348012345678",
  recipientName: "Ada Obi",
  amountNgn: 5000,
  message: "Happy birthday!",
  unlockAt: new Date(Date.now() + 86_400_000).toISOString(), // tomorrow
  paymentProvider: "paystack" as const,
  recipientIsRegistered: true,
};

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  gifts.clear();

  (getExchangeRate as jest.Mock).mockResolvedValue({ ngnPerUsdc: 1600 });
  (initializePayment as jest.Mock).mockResolvedValue({
    authorizationUrl: PAYMENT_URL,
    reference: "lumigift_test-ref",
  });
});

// ─── createGift ───────────────────────────────────────────────────────────────

describe("createGift", () => {
  it("returns a gift and paymentUrl on success", async () => {
    const { gift, paymentUrl } = await createGift(SENDER_ID, baseInput);

    expect(gift).toMatchObject({
      senderId: SENDER_ID,
      recipientName: "Ada Obi",
      amountNgn: 5000,
      status: "pending_payment",
    });
    expect(paymentUrl).toBe(PAYMENT_URL);
  });

  it("stores the gift in the in-memory map", async () => {
    const { gift } = await createGift(SENDER_ID, baseInput);
    expect(gifts.has(gift.id)).toBe(true);
  });

  it("hashes the recipient phone — never stores plaintext", async () => {
    const { gift } = await createGift(SENDER_ID, baseInput);
    expect(gift).not.toHaveProperty("recipientPhone");
    expect(gift.recipientPhoneHash).toHaveLength(64); // SHA-256 hex
    expect(gift.recipientPhoneHash).not.toContain("+234");
  });

  it("converts NGN to USDC using the exchange rate", async () => {
    // 5000 NGN / 1600 NGN-per-USDC = 3.125 USDC
    const { gift } = await createGift(SENDER_ID, baseInput);
    expect(parseFloat(gift.amountUsdc)).toBeCloseTo(3.125, 4);
  });

  it("calls initializePayment with the correct amount in kobo", async () => {
    await createGift(SENDER_ID, baseInput);
    expect(initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amountKobo: 5000 * 100 })
    );
  });

  it("throws when the daily limit would be exceeded", async () => {
    // Seed gifts totalling ₦999,000 for today
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Add a gift from today that brings total to ₦999,000
    gifts.set("existing-1", {
      id: "existing-1",
      senderId: SENDER_ID,
      recipientPhoneHash: "hash",
      recipientName: "Test",
      amountNgn: 999_000,
      amountUsdc: "624.375",
      unlockAt: new Date(Date.now() + 86_400_000),
      status: "pending_payment",
      createdAt: new Date(), // today
      updatedAt: new Date(),
    } as Gift);

    // ₦999,000 + ₦5,000 = ₦1,004,000 > ₦1,000,000 daily limit
    await expect(createGift(SENDER_ID, baseInput)).rejects.toThrow(
      /daily sending limit/i
    );
  });

  it("does not count yesterday's gifts toward today's daily limit", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    gifts.set("old-gift", {
      id: "old-gift",
      senderId: SENDER_ID,
      recipientPhoneHash: "hash",
      recipientName: "Test",
      amountNgn: 999_000,
      amountUsdc: "624.375",
      unlockAt: new Date(Date.now() + 86_400_000),
      status: "pending_payment",
      createdAt: yesterday,
      updatedAt: yesterday,
    } as Gift);

    // Should succeed — yesterday's gifts don't count
    await expect(createGift(SENDER_ID, baseInput)).resolves.toMatchObject({
      gift: expect.objectContaining({ amountNgn: 5000 }),
    });
  });

  it("propagates exchange rate fetch failures", async () => {
    (getExchangeRate as jest.Mock).mockRejectedValue(new Error("rate unavailable"));
    await expect(createGift(SENDER_ID, baseInput)).rejects.toThrow("rate unavailable");
  });

  it("propagates Paystack initialization failures", async () => {
    (initializePayment as jest.Mock).mockRejectedValue(new Error("Paystack error"));
    await expect(createGift(SENDER_ID, baseInput)).rejects.toThrow("Paystack error");
  });
});

// ─── getGiftById ──────────────────────────────────────────────────────────────

describe("getGiftById", () => {
  it("returns the gift when it exists", async () => {
    const { gift } = await createGift(SENDER_ID, baseInput);
    const found = await getGiftById(gift.id);
    expect(found).toEqual(gift);
  });

  it("returns null for a non-existent id", async () => {
    const result = await getGiftById("00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });

  it("returns null for an empty string id", async () => {
    const result = await getGiftById("");
    expect(result).toBeNull();
  });
});

// ─── getGiftsBySender (listGiftsBySender) ─────────────────────────────────────

describe("getGiftsBySender", () => {
  it("returns all gifts for the given sender", async () => {
    await createGift(SENDER_ID, baseInput);
    await createGift(SENDER_ID, { ...baseInput, amountNgn: 10_000 });

    const result = await getGiftsBySender(SENDER_ID);
    expect(result).toHaveLength(2);
    expect(result.every((g) => g.senderId === SENDER_ID)).toBe(true);
  });

  it("returns an empty array when the sender has no gifts", async () => {
    const result = await getGiftsBySender("unknown-sender");
    expect(result).toEqual([]);
  });

  it("does not return gifts belonging to other senders", async () => {
    await createGift(SENDER_ID, baseInput);
    await createGift("other-sender", baseInput);

    const result = await getGiftsBySender(SENDER_ID);
    expect(result).toHaveLength(1);
    expect(result[0].senderId).toBe(SENDER_ID);
  });
});

// ─── updateGiftStatus ─────────────────────────────────────────────────────────

describe("updateGiftStatus", () => {
  it("updates the status for a valid transition", async () => {
    const { gift } = await createGift(SENDER_ID, baseInput);
    // pending_payment → funded is a valid transition
    const updated = await updateGiftStatus(gift.id, "funded");
    expect(updated?.status).toBe("funded");
  });

  it("updates updatedAt on status change", async () => {
    const { gift } = await createGift(SENDER_ID, baseInput);
    const before = gift.updatedAt;
    // Ensure at least 1 ms passes
    await new Promise((r) => setTimeout(r, 2));
    await updateGiftStatus(gift.id, "funded");
    const stored = await getGiftById(gift.id);
    expect(stored!.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("returns null for a non-existent gift id", async () => {
    const result = await updateGiftStatus(
      "00000000-0000-0000-0000-000000000000",
      "funded"
    );
    expect(result).toBeNull();
  });

  it("throws for an invalid status transition (pending_payment → claimed)", async () => {
    const { gift } = await createGift(SENDER_ID, baseInput);
    await expect(updateGiftStatus(gift.id, "claimed")).rejects.toThrow(
      /invalid gift status transition/i
    );
  });

  it("throws for an invalid transition from a terminal state (claimed → unlocked)", async () => {
    const { gift } = await createGift(SENDER_ID, baseInput);
    // Walk to claimed via valid transitions
    await updateGiftStatus(gift.id, "funded");
    await updateGiftStatus(gift.id, "locked");
    await updateGiftStatus(gift.id, "unlocked");
    await updateGiftStatus(gift.id, "claimed");

    await expect(updateGiftStatus(gift.id, "unlocked")).rejects.toThrow(
      /invalid gift status transition/i
    );
  });

  it("allows cancellation from pending_payment", async () => {
    const { gift } = await createGift(SENDER_ID, baseInput);
    const updated = await updateGiftStatus(gift.id, "cancelled");
    expect(updated?.status).toBe("cancelled");
  });

  it("persists the updated status in the store", async () => {
    const { gift } = await createGift(SENDER_ID, baseInput);
    await updateGiftStatus(gift.id, "funded");
    const stored = await getGiftById(gift.id);
    expect(stored?.status).toBe("funded");
  });
});

// ─── ngnToUsdc ────────────────────────────────────────────────────────────────

describe("ngnToUsdc", () => {
  it("converts NGN to USDC at the given rate", async () => {
    const result = await ngnToUsdc(1600);
    expect(parseFloat(result)).toBeCloseTo(1, 5);
  });
});

// ─── hashPhone ────────────────────────────────────────────────────────────────

describe("hashPhone", () => {
  it("returns a 64-character hex string", () => {
    expect(hashPhone("+2348012345678")).toHaveLength(64);
  });

  it("is deterministic for the same input", () => {
    expect(hashPhone("+2348012345678")).toBe(hashPhone("+2348012345678"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashPhone("+2348012345678")).not.toBe(hashPhone("+2348099999999"));
  });
});

// ─── getGiftsBySenderPaginated ────────────────────────────────────────────────

describe("getGiftsBySenderPaginated", () => {
  it("returns the first page of gifts", async () => {
    await createGift(SENDER_ID, baseInput);
    await createGift(SENDER_ID, { ...baseInput, amountNgn: 10_000 });

    const page = await getGiftsBySenderPaginated(SENDER_ID, null, 1);
    expect(page.gifts).toHaveLength(1);
    expect(page.total).toBe(2);
    expect(page.nextCursor).not.toBeNull();
  });

  it("returns null nextCursor on the last page", async () => {
    await createGift(SENDER_ID, baseInput);
    const page = await getGiftsBySenderPaginated(SENDER_ID, null, 10);
    expect(page.nextCursor).toBeNull();
  });

  it("returns empty result for unknown sender", async () => {
    const page = await getGiftsBySenderPaginated("nobody", null, 10);
    expect(page.gifts).toHaveLength(0);
    expect(page.total).toBe(0);
  });
});

// ─── getGiftsByRecipient ──────────────────────────────────────────────────────

describe("getGiftsByRecipient", () => {
  it("returns gifts matching the recipient phone", async () => {
    await createGift(SENDER_ID, baseInput);
    const result = await getGiftsByRecipient(baseInput.recipientPhone);
    expect(result).toHaveLength(1);
  });

  it("returns empty array for unknown phone", async () => {
    const result = await getGiftsByRecipient("+2340000000000");
    expect(result).toHaveLength(0);
  });
});

// ─── cancelGift ───────────────────────────────────────────────────────────────

describe("cancelGift", () => {
  it("sets status to cancelled", async () => {
    const { gift } = await createGift(SENDER_ID, baseInput);
    const result = await cancelGift(gift.id);
    expect(result?.status).toBe("cancelled");
  });

  it("returns null for unknown id", async () => {
    expect(await cancelGift("no-such-id")).toBeNull();
  });
});

// ─── storeClaimTxHash ─────────────────────────────────────────────────────────

describe("storeClaimTxHash", () => {
  it("stores the tx hash on the gift", async () => {
    const { gift } = await createGift(SENDER_ID, baseInput);
    const result = await storeClaimTxHash(gift.id, "abc123");
    expect(result?.claimTxHash).toBe("abc123");
  });

  it("returns null for unknown id", async () => {
    expect(await storeClaimTxHash("no-such-id", "hash")).toBeNull();
  });
});

// ─── getGiftByContractId ──────────────────────────────────────────────────────

describe("getGiftByContractId", () => {
  it("returns the gift with the matching contractId", async () => {
    const { gift } = await createGift(SENDER_ID, baseInput);
    // Manually set contractId on the stored gift
    const stored = gifts.get(gift.id)!;
    stored.contractId = "CONTRACT_ABC";
    gifts.set(gift.id, stored);

    const result = await getGiftByContractId("CONTRACT_ABC");
    expect(result?.id).toBe(gift.id);
  });

  it("returns null when no gift has the contractId", async () => {
    expect(await getGiftByContractId("UNKNOWN_CONTRACT")).toBeNull();
  });
});

// ─── updateGiftStatusIdempotent ───────────────────────────────────────────────

describe("updateGiftStatusIdempotent", () => {
  it("updates status for a valid transition", async () => {
    const { gift } = await createGift(SENDER_ID, baseInput);
    const result = await updateGiftStatusIdempotent(gift.id, "funded");
    expect(result?.status).toBe("funded");
  });

  it("is a no-op when already in the target status", async () => {
    const { gift } = await createGift(SENDER_ID, baseInput);
    await updateGiftStatus(gift.id, "funded");
    const result = await updateGiftStatusIdempotent(gift.id, "funded");
    expect(result?.status).toBe("funded");
  });

  it("returns the gift unchanged for an invalid transition (no throw)", async () => {
    const { gift } = await createGift(SENDER_ID, baseInput);
    // pending_payment → claimed is invalid — should not throw
    const result = await updateGiftStatusIdempotent(gift.id, "claimed");
    expect(result?.status).toBe("pending_payment");
  });

  it("returns null for unknown id", async () => {
    expect(await updateGiftStatusIdempotent("no-such-id", "funded")).toBeNull();
  });
});

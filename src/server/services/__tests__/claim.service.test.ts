/**
 * @jest-environment node
 *
 * Unit tests for src/server/services/claim.service.ts
 *
 * Mocks:
 *  - @/lib/stellar      → sendUsdcPayment
 *  - ./gift.service     → updateGiftStatus, storeClaimTxHash
 *
 * Covers: successful claim, claim before unlock, already claimed,
 *         contract (Stellar) call failure, DB update verified, SMS mock.
 */

import type { Gift } from "@/types";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/stellar", () => ({
  sendUsdcPayment: jest.fn(),
}));

jest.mock("../gift.service", () => ({
  updateGiftStatus: jest.fn(),
  storeClaimTxHash: jest.fn(),
}));

// SMS (Termii) — claim.service doesn't call it directly, but guard against
// accidental real network calls if the service is extended.
jest.mock("@/lib/sms", () => ({
  sendNewDeviceAlert: jest.fn(),
  sendOtp: jest.fn(),
}));

import { claimGift } from "../claim.service";
import { sendUsdcPayment } from "@/lib/stellar";
import { updateGiftStatus, storeClaimTxHash } from "../gift.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGift(overrides: Partial<Gift> = {}): Gift {
  return {
    id: "gift-abc-123",
    senderId: "sender-1",
    recipientPhoneHash: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
    recipientName: "Ada Obi",
    amountNgn: 5000,
    amountUsdc: "3.0000000",
    unlockAt: new Date(Date.now() - 1000), // already past
    status: "unlocked",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const RECIPIENT_KEY = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const TX_HASH = "abc123txhash";

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  (sendUsdcPayment as jest.Mock).mockResolvedValue(TX_HASH);
  (updateGiftStatus as jest.Mock).mockResolvedValue(undefined);
  (storeClaimTxHash as jest.Mock).mockResolvedValue(undefined);
});

describe("claimGift", () => {
  it("returns txHash on a successful claim", async () => {
    const gift = makeGift();
    const result = await claimGift(gift, RECIPIENT_KEY);
    expect(result).toEqual({ txHash: TX_HASH });
  });

  it("calls sendUsdcPayment with the correct destination and amount", async () => {
    const gift = makeGift();
    await claimGift(gift, RECIPIENT_KEY);
    expect(sendUsdcPayment).toHaveBeenCalledWith(RECIPIENT_KEY, gift.amountUsdc);
  });

  it("stores the claim tx hash in the database after payment", async () => {
    const gift = makeGift();
    await claimGift(gift, RECIPIENT_KEY);
    expect(storeClaimTxHash).toHaveBeenCalledWith(gift.id, TX_HASH);
  });

  it("marks the gift as claimed after storing the tx hash", async () => {
    const gift = makeGift();
    await claimGift(gift, RECIPIENT_KEY);
    // storeClaimTxHash must be called before updateGiftStatus
    const storeMockOrder = (storeClaimTxHash as jest.Mock).mock.invocationCallOrder[0];
    const updateMockOrder = (updateGiftStatus as jest.Mock).mock.invocationCallOrder[0];
    expect(storeMockOrder).toBeLessThan(updateMockOrder);
    expect(updateGiftStatus).toHaveBeenCalledWith(gift.id, "claimed");
  });

  it("throws when the gift is not yet unlocked (status: locked)", async () => {
    const gift = makeGift({ status: "locked" });
    await expect(claimGift(gift, RECIPIENT_KEY)).rejects.toThrow(
      "Gift is not yet unlocked."
    );
  });

  it("throws when the gift is already claimed", async () => {
    const gift = makeGift({ status: "claimed" });
    await expect(claimGift(gift, RECIPIENT_KEY)).rejects.toThrow(
      "Gift is not yet unlocked."
    );
  });

  it("throws when the gift is still pending payment", async () => {
    const gift = makeGift({ status: "pending_payment" });
    await expect(claimGift(gift, RECIPIENT_KEY)).rejects.toThrow(
      "Gift is not yet unlocked."
    );
  });

  it("does not call sendUsdcPayment when the gift is not unlocked", async () => {
    const gift = makeGift({ status: "locked" });
    await expect(claimGift(gift, RECIPIENT_KEY)).rejects.toThrow();
    expect(sendUsdcPayment).not.toHaveBeenCalled();
  });

  it("propagates Stellar contract call failures", async () => {
    (sendUsdcPayment as jest.Mock).mockRejectedValue(
      new Error("Stellar submission failed")
    );
    const gift = makeGift();
    await expect(claimGift(gift, RECIPIENT_KEY)).rejects.toThrow(
      "Stellar submission failed"
    );
  });

  it("does not update gift status when the Stellar call fails", async () => {
    (sendUsdcPayment as jest.Mock).mockRejectedValue(new Error("network error"));
    const gift = makeGift();
    await expect(claimGift(gift, RECIPIENT_KEY)).rejects.toThrow();
    expect(updateGiftStatus).not.toHaveBeenCalled();
    expect(storeClaimTxHash).not.toHaveBeenCalled();
  });
});

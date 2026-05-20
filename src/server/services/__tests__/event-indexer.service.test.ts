/**
 * @jest-environment node
 */
import { indexEscrowEvents } from "../event-indexer.service";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/redis", () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock("@/lib/contracts/escrow-events", () => ({
  fetchEscrowEvents: jest.fn(),
  CURSOR_GENESIS: "0000000000000000-0000000000",
}));

jest.mock("../gift.service", () => ({
  getGiftByContractId: jest.fn(),
  updateGiftStatusIdempotent: jest.fn(),
}));

jest.mock("@/server/config", () => ({
  serverConfig: {
    stellar: {
      network: "testnet",
      escrowContractId: "CONTRACT_ID_TEST",
    },
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { redis } from "@/lib/redis";
import { fetchEscrowEvents, CURSOR_GENESIS } from "@/lib/contracts/escrow-events";
import { getGiftByContractId, updateGiftStatusIdempotent } from "../gift.service";

const mockRedis = redis as jest.Mocked<typeof redis>;
const mockFetch = fetchEscrowEvents as jest.Mock;
const mockGetGift = getGiftByContractId as jest.Mock;
const mockUpdateStatus = updateGiftStatusIdempotent as jest.Mock;

const CONTRACT_ID = "CONTRACT_ID_TEST";

const baseGift = {
  id: "gift-1",
  contractId: CONTRACT_ID,
  status: "funded",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("indexEscrowEvents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
    mockUpdateStatus.mockResolvedValue({ ...baseGift });
  });

  it("starts from CURSOR_GENESIS when no cursor is stored", async () => {
    mockFetch.mockResolvedValue({ events: [], latestCursor: CURSOR_GENESIS });

    await indexEscrowEvents();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ startCursor: CURSOR_GENESIS })
    );
  });

  it("uses stored cursor from Redis", async () => {
    const storedCursor = "0000000000000010-0000000001";
    mockRedis.get.mockResolvedValue(storedCursor);
    mockFetch.mockResolvedValue({ events: [], latestCursor: storedCursor });

    await indexEscrowEvents();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ startCursor: storedCursor })
    );
  });

  it("applies initialized event → sets gift status to locked", async () => {
    mockGetGift.mockResolvedValue({ ...baseGift, status: "funded" });
    mockFetch.mockResolvedValue({
      events: [
        {
          type: "initialized",
          contractId: CONTRACT_ID,
          ledger: 100,
          ledgerClosedAt: "2024-01-01T00:00:00Z",
          txHash: "abc123",
          sender: "GSENDER",
          recipient: "GRECIPIENT",
          amount: BigInt(100_000_000),
          unlockTime: BigInt(9_999_999),
        },
      ],
      latestCursor: "0000000000000100-0000000001",
    });

    const result = await indexEscrowEvents();

    expect(mockUpdateStatus).toHaveBeenCalledWith("gift-1", "locked");
    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("applies claimed event → sets gift status to claimed", async () => {
    mockGetGift.mockResolvedValue({ ...baseGift, status: "unlocked" });
    mockFetch.mockResolvedValue({
      events: [
        {
          type: "claimed",
          contractId: CONTRACT_ID,
          ledger: 200,
          ledgerClosedAt: "2024-01-02T00:00:00Z",
          txHash: "def456",
          recipient: "GRECIPIENT",
          amount: BigInt(100_000_000),
        },
      ],
      latestCursor: "0000000000000200-0000000001",
    });

    const result = await indexEscrowEvents();

    expect(mockUpdateStatus).toHaveBeenCalledWith("gift-1", "claimed");
    expect(result.processed).toBe(1);
  });

  it("applies cancelled event → sets gift status to cancelled", async () => {
    mockGetGift.mockResolvedValue({ ...baseGift, status: "locked" });
    mockFetch.mockResolvedValue({
      events: [
        {
          type: "cancelled",
          contractId: CONTRACT_ID,
          ledger: 300,
          ledgerClosedAt: "2024-01-03T00:00:00Z",
          txHash: "ghi789",
          sender: "GSENDER",
          amount: BigInt(100_000_000),
        },
      ],
      latestCursor: "0000000000000300-0000000001",
    });

    const result = await indexEscrowEvents();

    expect(mockUpdateStatus).toHaveBeenCalledWith("gift-1", "cancelled");
    expect(result.processed).toBe(1);
  });

  it("is idempotent — skips event if gift already in target status", async () => {
    // Gift already locked — replaying initialized event should be a no-op
    mockGetGift.mockResolvedValue({ ...baseGift, status: "locked" });
    mockFetch.mockResolvedValue({
      events: [
        {
          type: "initialized",
          contractId: CONTRACT_ID,
          ledger: 100,
          ledgerClosedAt: "2024-01-01T00:00:00Z",
          txHash: "abc123",
          sender: "GSENDER",
          recipient: "GRECIPIENT",
          amount: BigInt(100_000_000),
          unlockTime: BigInt(9_999_999),
        },
      ],
      latestCursor: "0000000000000100-0000000001",
    });

    const result = await indexEscrowEvents();

    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("skips events for unknown contract IDs", async () => {
    mockGetGift.mockResolvedValue(null); // not in our DB
    mockFetch.mockResolvedValue({
      events: [
        {
          type: "claimed",
          contractId: "UNKNOWN_CONTRACT",
          ledger: 200,
          ledgerClosedAt: "2024-01-02T00:00:00Z",
          txHash: "xyz",
          recipient: "GRECIPIENT",
          amount: BigInt(100_000_000),
        },
      ],
      latestCursor: "0000000000000200-0000000001",
    });

    const result = await indexEscrowEvents();

    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it("persists the latest cursor to Redis after processing", async () => {
    const newCursor = "0000000000000500-0000000001";
    mockGetGift.mockResolvedValue(null);
    mockFetch.mockResolvedValue({ events: [], latestCursor: newCursor });
    // Simulate cursor changing
    mockRedis.get.mockResolvedValue("0000000000000400-0000000001");

    await indexEscrowEvents();

    expect(mockRedis.set).toHaveBeenCalledWith("escrow:event:cursor", newCursor);
  });

  it("does not write cursor to Redis when cursor is unchanged", async () => {
    const cursor = "0000000000000400-0000000001";
    mockRedis.get.mockResolvedValue(cursor);
    mockFetch.mockResolvedValue({ events: [], latestCursor: cursor });

    await indexEscrowEvents();

    expect(mockRedis.set).not.toHaveBeenCalled();
  });
});

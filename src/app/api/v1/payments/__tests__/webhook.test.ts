/**
 * @jest-environment node
 */
import crypto from "crypto";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGet = jest.fn();
const mockSet = jest.fn();
jest.mock("@/lib/redis", () => ({
  getRedisClient: jest.fn().mockResolvedValue({ get: mockGet, set: mockSet }),
}));

const mockUpdateGiftStatus = jest.fn();
jest.mock("@/server/services/gift.service", () => ({
  updateGiftStatus: mockUpdateGiftStatus,
}));

jest.mock("@/server/config", () => ({
  serverConfig: {
    paystack: { secretKey: "test-secret" },
    redis: { url: "redis://localhost:6379" },
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSignature(body: string) {
  return crypto.createHmac("sha512", "test-secret").update(body).digest("hex");
}

function makeRequest(body: object, signature?: string) {
  const raw = JSON.stringify(body);
  const sig = signature ?? makeSignature(raw);
  return new Request("http://localhost/api/payments", {
    method: "POST",
    headers: { "x-paystack-signature": sig, "content-type": "application/json" },
    body: raw,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/payments (Paystack webhook)", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    jest.resetModules();
    mockGet.mockReset();
    mockSet.mockReset();
    mockUpdateGiftStatus.mockReset();
    ({ POST } = await import("@/app/api/v1/payments/route"));
  });

  it("returns 401 for invalid signature", async () => {
    const req = makeRequest({ event: "charge.success", data: { reference: "ref1" } }, "badsig");
    const res = await POST(req as never);
    expect(res.status).toBe(401);
    expect(mockUpdateGiftStatus).not.toHaveBeenCalled();
  });

  it("processes a new charge.success event and stores idempotency key", async () => {
    mockGet.mockResolvedValue(null);
    const body = {
      event: "charge.success",
      data: { reference: "ref_new", status: "success", metadata: { giftId: "gift-123" } },
    };
    const req = makeRequest(body);
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    expect(mockUpdateGiftStatus).toHaveBeenCalledWith("gift-123", "locked");
    expect(mockSet).toHaveBeenCalledWith("paystack:ref:ref_new", "1", { EX: 86400 });
  });

  it("returns 200 without re-processing a duplicate reference", async () => {
    mockGet.mockResolvedValue("1"); // already processed
    const body = {
      event: "charge.success",
      data: { reference: "ref_dup", status: "success", metadata: { giftId: "gift-456" } },
    };
    const req = makeRequest(body);
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    expect(mockUpdateGiftStatus).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });
});

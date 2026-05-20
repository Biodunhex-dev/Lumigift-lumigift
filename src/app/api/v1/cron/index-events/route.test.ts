/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "./route";

jest.mock("@/server/services/event-indexer.service", () => ({
  indexEscrowEvents: jest.fn(),
}));

const makeRequest = (authHeader?: string) =>
  new NextRequest("http://localhost/api/v1/cron/index-events", {
    headers: authHeader ? { authorization: authHeader } : {},
  });

describe("GET /api/v1/cron/index-events", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, CRON_SECRET: "test-secret" };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("returns 401 with no auth header", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns 401 with wrong token", async () => {
    const res = await GET(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 200 and calls indexEscrowEvents with valid token", async () => {
    const { indexEscrowEvents } = await import(
      "@/server/services/event-indexer.service"
    );
    (indexEscrowEvents as jest.Mock).mockResolvedValue({
      processed: 3,
      skipped: 1,
      latestCursor: "0000000000000042-0000000001",
    });

    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.processed).toBe(3);
    expect(body.data.skipped).toBe(1);
    expect(indexEscrowEvents).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when indexEscrowEvents throws", async () => {
    const { indexEscrowEvents } = await import(
      "@/server/services/event-indexer.service"
    );
    (indexEscrowEvents as jest.Mock).mockRejectedValue(new Error("RPC down"));

    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

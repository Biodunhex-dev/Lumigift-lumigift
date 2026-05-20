/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "./route";

jest.mock("@/server/services/scheduler.service", () => ({
  processUnlocks: jest.fn().mockResolvedValue(undefined),
}));

const makeRequest = (authHeader?: string) =>
  new NextRequest("http://localhost/api/cron/unlock", {
    headers: authHeader ? { authorization: authHeader } : {},
  });

describe("GET /api/cron/unlock", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, CRON_SECRET: "test-secret" };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("returns 401 when no authorization header is provided", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns 401 when an incorrect token is provided", async () => {
    const res = await GET(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns 200 and runs processUnlocks with a valid token", async () => {
    const { processUnlocks } = await import(
      "@/server/services/scheduler.service"
    );
    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(processUnlocks).toHaveBeenCalledTimes(1);
  });
});

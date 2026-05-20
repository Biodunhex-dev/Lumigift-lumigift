/**
 * @jest-environment node
 */

// mockConstructEvent must be defined before jest.mock hoisting
const mockConstructEvent = jest.fn();

jest.mock("stripe", () =>
  jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  }))
);

jest.mock("@/server/services/gift.service", () => ({
  updateGiftStatus: jest.fn(),
}));

import { NextRequest } from "next/server";

// POST is loaded lazily inside beforeAll so env vars are set first
let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
  process.env.STRIPE_SECRET_KEY = "sk_test_key";

  // jest.isolateModules ensures the route is freshly required with env already set
  await new Promise<void>((resolve) => {
    jest.isolateModules(async () => {
      const mod = await import("../route");
      POST = mod.POST;
      resolve();
    });
  });
});

afterAll(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_SECRET_KEY;
});

function makeRequest(body: string, sig: string | null) {
  return new NextRequest("http://localhost/api/payments/stripe/webhook", {
    method: "POST",
    body,
    headers: sig ? { "stripe-signature": sig } : {},
  });
}

describe("POST /api/payments/stripe/webhook", () => {
  beforeEach(() => {
    mockConstructEvent.mockReset();
  });

  it("returns 400 when Stripe-Signature header is missing", async () => {
    const res = await POST(makeRequest("{}", null));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns 400 when signature is invalid", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });
    const res = await POST(makeRequest("{}", "t=123,v1=badsig"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/signature verification failed/i);
  });

  it("returns 200 when signature is valid", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { metadata: {} } },
    });
    const res = await POST(makeRequest("{}", "t=123,v1=validsig"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.received).toBe(true);
  });
});

/**
 * @jest-environment node
 *
 * Tests for CSRF token generation, verification, and the withCsrf middleware.
 * Covers the acceptance criteria:
 *   - Token generated per session and stored in HttpOnly cookie
 *   - POST/PUT/DELETE routes validate the token from request header
 *   - Token mismatch returns HTTP 403
 *   - Cross-origin request simulation (no cookie → 403)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  generateCsrfToken,
  verifyCsrfToken,
  setCsrfCookie,
  withCsrf,
} from "@/lib/csrf";

// ── Environment setup ─────────────────────────────────────────────────────────

beforeAll(() => {
  process.env.CSRF_SECRET = "test-csrf-secret-that-is-long-enough-32b";
});

afterAll(() => {
  delete process.env.CSRF_SECRET;
});

// ── generateCsrfToken ─────────────────────────────────────────────────────────

describe("generateCsrfToken", () => {
  it("returns a string with three dot-separated parts", () => {
    const token = generateCsrfToken();
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
  });

  it("generates unique tokens on each call", () => {
    const t1 = generateCsrfToken();
    const t2 = generateCsrfToken();
    expect(t1).not.toBe(t2);
  });
});

// ── verifyCsrfToken ───────────────────────────────────────────────────────────

describe("verifyCsrfToken", () => {
  it("returns true for a freshly generated token", () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(token)).toBe(true);
  });

  it("returns false for a tampered HMAC", () => {
    const token = generateCsrfToken();
    const parts = token.split(".");
    parts[2] = "0".repeat(parts[2].length); // corrupt the HMAC
    expect(verifyCsrfToken(parts.join("."))).toBe(false);
  });

  it("returns false for a tampered nonce", () => {
    const token = generateCsrfToken();
    const parts = token.split(".");
    parts[0] = "deadbeef".repeat(4); // corrupt the nonce
    expect(verifyCsrfToken(parts.join("."))).toBe(false);
  });

  it("returns false for a malformed token (wrong number of parts)", () => {
    expect(verifyCsrfToken("only.two")).toBe(false);
    expect(verifyCsrfToken("one")).toBe(false);
    expect(verifyCsrfToken("")).toBe(false);
  });

  it("returns false for an expired token", () => {
    // Backdate the timestamp by 25 hours
    const nonce = "aabbccdd".repeat(4);
    const expiredTimestamp = (Date.now() - 25 * 60 * 60 * 1000).toString();
    // Build a valid HMAC for the expired payload so only expiry triggers failure
    const { createHmac } = require("crypto");
    const hmac = createHmac("sha256", process.env.CSRF_SECRET!)
      .update(`${nonce}.${expiredTimestamp}`)
      .digest("hex");
    const token = `${nonce}.${expiredTimestamp}.${hmac}`;
    expect(verifyCsrfToken(token)).toBe(false);
  });

  it("returns false when CSRF_SECRET is wrong", () => {
    const token = generateCsrfToken();
    const original = process.env.CSRF_SECRET;
    process.env.CSRF_SECRET = "completely-different-secret-value";
    expect(verifyCsrfToken(token)).toBe(false);
    process.env.CSRF_SECRET = original;
  });
});

// ── setCsrfCookie ─────────────────────────────────────────────────────────────

describe("setCsrfCookie", () => {
  it("sets an HttpOnly cookie on the response", () => {
    const res = NextResponse.json({});
    const token = generateCsrfToken();
    setCsrfCookie(res, token);

    const cookie = res.cookies.get("csrf-token");
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe(token);
    // next/server cookies API sets httpOnly by default when you pass httpOnly: true
    // We verify the Set-Cookie header contains HttpOnly
    const setCookieHeader = res.headers.get("set-cookie") ?? "";
    expect(setCookieHeader.toLowerCase()).toContain("httponly");
  });
});

// ── withCsrf middleware ───────────────────────────────────────────────────────

function makeHandler(status = 200) {
  return jest.fn(async () => NextResponse.json({ ok: true }, { status }));
}

function makeRequest(
  method: string,
  opts: { headerToken?: string; cookieToken?: string } = {}
): NextRequest {
  const headers: Record<string, string> = {};

  if (opts.headerToken) {
    headers["x-csrf-token"] = opts.headerToken;
  }

  if (opts.cookieToken) {
    // Set cookie in the constructor so NextRequest can parse it
    headers["cookie"] = `csrf-token=${opts.cookieToken}`;
  }

  return new NextRequest("http://localhost/api/v1/gifts", { method, headers });
}

describe("withCsrf middleware", () => {
  it("passes GET requests through without checking the token", async () => {
    const handler = makeHandler();
    const wrapped = withCsrf(handler);
    const req = makeRequest("GET");
    const res = await wrapped(req);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when both header and cookie are missing (POST)", async () => {
    const handler = makeHandler();
    const wrapped = withCsrf(handler);
    const req = makeRequest("POST");
    const res = await wrapped(req);
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.code).toBe("CSRF_MISSING");
  });

  it("returns 403 when header is present but cookie is missing (cross-origin simulation)", async () => {
    const token = generateCsrfToken();
    const handler = makeHandler();
    const wrapped = withCsrf(handler);
    // Simulate a cross-origin request: attacker can set the header but cannot
    // set the HttpOnly cookie from a different origin.
    const req = makeRequest("POST", { headerToken: token });
    const res = await wrapped(req);
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when cookie is present but header is missing", async () => {
    const token = generateCsrfToken();
    const handler = makeHandler();
    const wrapped = withCsrf(handler);
    const req = makeRequest("POST", { cookieToken: token });
    const res = await wrapped(req);
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when header and cookie do not match", async () => {
    const token1 = generateCsrfToken();
    const token2 = generateCsrfToken();
    const handler = makeHandler();
    const wrapped = withCsrf(handler);
    const req = makeRequest("POST", { headerToken: token1, cookieToken: token2 });
    const res = await wrapped(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("CSRF_INVALID");
  });

  it("returns 403 when tokens match but are invalid (tampered HMAC)", async () => {
    const token = generateCsrfToken();
    const parts = token.split(".");
    parts[2] = "0".repeat(parts[2].length);
    const badToken = parts.join(".");

    const handler = makeHandler();
    const wrapped = withCsrf(handler);
    const req = makeRequest("POST", { headerToken: badToken, cookieToken: badToken });
    const res = await wrapped(req);
    expect(res.status).toBe(403);
  });

  it("passes through POST with valid matching tokens", async () => {
    const token = generateCsrfToken();
    const handler = makeHandler();
    const wrapped = withCsrf(handler);
    const req = makeRequest("POST", { headerToken: token, cookieToken: token });
    const res = await wrapped(req);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("passes through DELETE with valid matching tokens", async () => {
    const token = generateCsrfToken();
    const handler = makeHandler();
    const wrapped = withCsrf(handler);
    const req = makeRequest("DELETE", { headerToken: token, cookieToken: token });
    const res = await wrapped(req);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("passes through PUT with valid matching tokens", async () => {
    const token = generateCsrfToken();
    const handler = makeHandler();
    const wrapped = withCsrf(handler);
    const req = makeRequest("PUT", { headerToken: token, cookieToken: token });
    const res = await wrapped(req);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

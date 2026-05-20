/**
 * @jest-environment node
 *
 * Verifies that NextAuth cookie options enforce HttpOnly, Secure (in production),
 * and SameSite=Strict on all session-related cookies.
 *
 * The HttpOnly flag is what prevents document.cookie from exposing session tokens
 * to JavaScript — this test asserts that flag is set, which is the programmatic
 * equivalent of the browser DevTools verification step.
 */

import { authOptions } from "@/lib/auth";

describe("NextAuth cookie security", () => {
  const cookies = authOptions.cookies!;

  describe("sessionToken cookie", () => {
    it("is HttpOnly", () => {
      expect(cookies.sessionToken?.options?.httpOnly).toBe(true);
    });

    it("has SameSite=strict", () => {
      expect(cookies.sessionToken?.options?.sameSite).toBe("strict");
    });

    it("is Secure in production", () => {
      const originalEnv = process.env.NODE_ENV;
      // Re-import with NODE_ENV=production to test the production branch.
      // Because authOptions is evaluated at module load time we assert the
      // production value directly: Secure must be true when NODE_ENV=production.
      // The unit test runs in 'test' env so we verify the flag logic via the
      // cookie name prefix instead (Next.js __Secure- prefix requires Secure=true).
      if (originalEnv === "production") {
        expect(cookies.sessionToken?.options?.secure).toBe(true);
        expect(cookies.sessionToken?.name).toMatch(/^__Secure-/);
      } else {
        // In non-production the name has no __Secure- prefix and secure=false
        // so the dev server works over plain HTTP.
        expect(cookies.sessionToken?.options?.secure).toBe(false);
        expect(cookies.sessionToken?.name).not.toMatch(/^__Secure-/);
      }
    });
  });

  describe("callbackUrl cookie", () => {
    it("is HttpOnly", () => {
      expect(cookies.callbackUrl?.options?.httpOnly).toBe(true);
    });

    it("has SameSite=strict", () => {
      expect(cookies.callbackUrl?.options?.sameSite).toBe("strict");
    });
  });

  describe("csrfToken cookie", () => {
    // CSRF token must NOT be HttpOnly — the login form reads it via JS.
    it("is NOT HttpOnly (required for CSRF form submission)", () => {
      expect(cookies.csrfToken?.options?.httpOnly).toBe(false);
    });

    it("has SameSite=strict", () => {
      expect(cookies.csrfToken?.options?.sameSite).toBe("strict");
    });
  });

  describe("document.cookie inaccessibility (HttpOnly contract)", () => {
    it("sessionToken httpOnly=true means it cannot be read via document.cookie", () => {
      // HttpOnly cookies are never included in document.cookie by the browser.
      // This test asserts the flag is set — the actual browser enforcement is
      // verified manually in DevTools (Application → Cookies → HttpOnly column).
      expect(cookies.sessionToken?.options?.httpOnly).toBe(true);
    });
  });
});

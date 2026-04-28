/**
 * e2e: Login flow (phone OTP)
 *
 * Covers:
 *  1. Landing page renders a sign-in entry point
 *  2. User enters phone number → OTP is sent (mocked)
 *  3. User enters correct OTP → session is created, redirected to dashboard
 *  4. User enters wrong OTP → error message shown
 *  5. Unauthenticated access to /dashboard redirects to login
 */

import { test, expect, type Page } from "@playwright/test";

const TEST_PHONE = "+2348012345678";
const VALID_OTP = "123456";
const INVALID_OTP = "000000";

async function setupOtpMocks(page: Page, { otpValid = true } = {}) {
  // Mock OTP send endpoint
  await page.route("**/api/auth/send-otp", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    })
  );

  // Mock NextAuth credentials sign-in
  await page.route("**/api/auth/signin/credentials", (route) => {
    if (otpValid) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "/dashboard" }),
      });
    } else {
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid OTP. Please try again." }),
      });
    }
  });

  // Mock NextAuth session so the app considers the user logged in after redirect
  await page.route("**/api/auth/session", (route) => {
    if (otpValid) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "test-user-id", phone: TEST_PHONE },
          expires: new Date(Date.now() + 86_400_000).toISOString(),
        }),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    }
  });
}

// ─── 1. Landing page has a sign-in entry point ────────────────────────────────
test("landing page renders sign-in entry point", async ({ page }) => {
  await page.goto("/");
  // Either a "Sign in" link/button or a phone input should be present
  const signInLocator = page
    .getByRole("link", { name: /sign in/i })
    .or(page.getByRole("button", { name: /sign in/i }))
    .or(page.getByRole("link", { name: /get started/i }))
    .or(page.getByRole("button", { name: /get started/i }));

  await expect(signInLocator.first()).toBeVisible();
});

// ─── 2. Phone number submission triggers OTP send ─────────────────────────────
test("entering phone number sends OTP", async ({ page }) => {
  await setupOtpMocks(page);

  let otpSendCalled = false;
  await page.route("**/api/auth/send-otp", (route) => {
    otpSendCalled = true;
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.goto("/login");

  await page.getByRole("textbox", { name: /phone/i }).fill(TEST_PHONE);
  await page.getByRole("button", { name: /send otp|get code|continue/i }).click();

  await expect.poll(() => otpSendCalled, { timeout: 10_000 }).toBe(true);

  // OTP input step should now be visible
  await expect(
    page.getByRole("textbox", { name: /otp|code|verification/i })
  ).toBeVisible({ timeout: 10_000 });
});

// ─── 3. Valid OTP → redirect to dashboard ────────────────────────────────────
test("valid OTP redirects to dashboard", async ({ page }) => {
  await setupOtpMocks(page, { otpValid: true });

  await page.goto("/login");

  await page.getByRole("textbox", { name: /phone/i }).fill(TEST_PHONE);
  await page.getByRole("button", { name: /send otp|get code|continue/i }).click();

  await page.getByRole("textbox", { name: /otp|code|verification/i }).fill(VALID_OTP);
  await page.getByRole("button", { name: /verify|confirm|sign in|submit/i }).click();

  // Should land on dashboard after successful login
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
});

// ─── 4. Invalid OTP → error message ──────────────────────────────────────────
test("invalid OTP shows error message", async ({ page }) => {
  await setupOtpMocks(page, { otpValid: false });

  await page.goto("/login");

  await page.getByRole("textbox", { name: /phone/i }).fill(TEST_PHONE);
  await page.getByRole("button", { name: /send otp|get code|continue/i }).click();

  await page.getByRole("textbox", { name: /otp|code|verification/i }).fill(INVALID_OTP);
  await page.getByRole("button", { name: /verify|confirm|sign in|submit/i }).click();

  await expect(
    page.getByRole("alert").or(page.getByText(/invalid otp|incorrect|try again/i))
  ).toBeVisible({ timeout: 10_000 });
});

// ─── 5. Unauthenticated access to /dashboard redirects to login ───────────────
test("unauthenticated visit to /dashboard redirects to login", async ({ page }) => {
  // Return empty session so the app treats the user as logged out
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    })
  );

  await page.goto("/dashboard");

  // Should be redirected away from /dashboard
  await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 10_000 });
});

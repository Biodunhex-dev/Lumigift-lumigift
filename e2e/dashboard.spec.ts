/**
 * e2e: Dashboard view
 *
 * Covers:
 *  1. Authenticated user sees their sent gifts list
 *  2. Empty state renders when the user has no gifts
 *  3. Gift status badges render correctly (locked, unlocked, claimed)
 *  4. Clicking a gift card navigates to the gift detail page
 *  5. "Send a gift" CTA is visible and navigates to /send
 */

import { test, expect, type Page } from "@playwright/test";

const DASHBOARD_URL = "/dashboard";

const mockGifts = [
  {
    id: "gift-locked-001",
    recipientName: "Alice",
    amountNgn: 5000,
    amountUsdc: "3.00",
    message: "Happy birthday!",
    status: "locked",
    unlockAt: new Date(Date.now() + 86_400_000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: "gift-unlocked-002",
    recipientName: "Bob",
    amountNgn: 10000,
    amountUsdc: "6.00",
    message: "Congrats!",
    status: "unlocked",
    unlockAt: new Date(Date.now() - 3_600_000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: "gift-claimed-003",
    recipientName: "Carol",
    amountNgn: 2500,
    amountUsdc: "1.50",
    message: "Well done!",
    status: "claimed",
    unlockAt: new Date(Date.now() - 86_400_000).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

/** Mock an authenticated session so the dashboard doesn't redirect to login. */
async function mockAuthSession(page: Page) {
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "test-user-id", phone: "+2348012345678" },
        expires: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    })
  );
}

/** Mock the gifts list API. */
async function mockGiftsList(page: Page, gifts: typeof mockGifts) {
  await page.route("**/api/v1/gifts*", (route) => {
    const url = route.request().url();
    // Only intercept the list endpoint, not individual gift fetches
    if (!url.match(/\/gifts\/[a-z0-9-]{10,}/)) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: gifts }),
      });
    } else {
      route.continue();
    }
  });
}

// ─── 1. Authenticated user sees their sent gifts ──────────────────────────────
test("dashboard shows sent gifts for authenticated user", async ({ page }) => {
  await mockAuthSession(page);
  await mockGiftsList(page, mockGifts);

  await page.goto(DASHBOARD_URL);

  // All three recipient names should appear
  await expect(page.getByText("Alice")).toBeVisible();
  await expect(page.getByText("Bob")).toBeVisible();
  await expect(page.getByText("Carol")).toBeVisible();
});

// ─── 2. Empty state ───────────────────────────────────────────────────────────
test("dashboard shows empty state when user has no gifts", async ({ page }) => {
  await mockAuthSession(page);
  await mockGiftsList(page, []);

  await page.goto(DASHBOARD_URL);

  // Some form of empty-state copy should be visible
  await expect(
    page
      .getByText(/no gifts yet/i)
      .or(page.getByText(/you haven't sent/i))
      .or(page.getByText(/send your first gift/i))
  ).toBeVisible();
});

// ─── 3. Gift status badges render correctly ───────────────────────────────────
test("dashboard renders correct status badges", async ({ page }) => {
  await mockAuthSession(page);
  await mockGiftsList(page, mockGifts);

  await page.goto(DASHBOARD_URL);

  // Each status should appear at least once
  await expect(page.getByText(/locked/i).first()).toBeVisible();
  await expect(page.getByText(/unlocked/i).first()).toBeVisible();
  await expect(page.getByText(/claimed/i).first()).toBeVisible();
});

// ─── 4. Clicking a gift card navigates to the detail page ────────────────────
test("clicking a gift card navigates to gift detail", async ({ page }) => {
  await mockAuthSession(page);
  await mockGiftsList(page, mockGifts);

  // Mock the individual gift fetch for the detail page
  await page.route(`**/api/v1/gifts/${mockGifts[0].id}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: mockGifts[0] }),
    })
  );

  await page.goto(DASHBOARD_URL);

  // Click the first gift (Alice)
  await page.getByText("Alice").click();

  await expect(page).toHaveURL(new RegExp(mockGifts[0].id), { timeout: 10_000 });
});

// ─── 5. "Send a gift" CTA navigates to /send ─────────────────────────────────
test('dashboard "Send a gift" CTA navigates to /send', async ({ page }) => {
  await mockAuthSession(page);
  await mockGiftsList(page, mockGifts);

  await page.goto(DASHBOARD_URL);

  await page
    .getByRole("link", { name: /send a gift/i })
    .or(page.getByRole("button", { name: /send a gift/i }))
    .first()
    .click();

  await expect(page).toHaveURL(/\/send/, { timeout: 10_000 });
});

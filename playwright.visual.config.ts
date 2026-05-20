import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for visual regression (snapshot) tests.
 * Run:  npm run test:visual
 * Update snapshots: npm run test:visual:update
 *
 * Closes #107
 */
export default defineConfig({
  testDir: "./e2e/visual",
  snapshotDir: "./e2e/visual/__snapshots__",
  timeout: 30_000,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001 },
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});

const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Exclude e2e (Playwright) and DB integration tests from Jest runs
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/.next/",
    "<rootDir>/e2e/",
    "<rootDir>/src/app/api/v1/payments/__tests__/webhook.integration.test.ts",
  ],
  // Route handler tests and node-specific tests need the node environment
  testEnvironmentOptions: {},
  // Per-file environment overrides via docblock: @jest-environment node
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts"],
};

module.exports = createJestConfig(customConfig);

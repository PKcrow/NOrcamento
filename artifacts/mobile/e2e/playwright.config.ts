import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 4173);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
const apiDomain =
  process.env.EXPO_PUBLIC_DOMAIN ?? process.env.REPLIT_DEV_DOMAIN;
const clerkPublishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  process.env.CLERK_PUBLISHABLE_KEY;

if (!apiDomain || !clerkPublishableKey) {
  throw new Error(
    "E2E requires EXPO_PUBLIC_DOMAIN (or REPLIT_DEV_DOMAIN) and CLERK_PUBLISHABLE_KEY.",
  );
}

export default defineConfig({
  testDir: ".",
  outputDir: "test-results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["dot"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: [
            `EXPO_PUBLIC_DOMAIN=${apiDomain}`,
            `EXPO_PUBLIC_WEB_DOMAIN=${
              process.env.EXPO_PUBLIC_WEB_DOMAIN ?? apiDomain
            }`,
            `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=${clerkPublishableKey}`,
            `pnpm exec expo start --web --host localhost --port ${port}`,
          ].join(" "),
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});

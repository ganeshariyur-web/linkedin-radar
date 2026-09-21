import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.PW_PORT ?? 3100);
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PW_BASE_URL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    viewport: { width: 1400, height: 900 },
  },
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: `npx next dev -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: true,
        timeout: 120_000,
        env: { ...process.env } as Record<string, string>,
      },
});

import { defineConfig, devices } from '@playwright/test';

/**
 * E2E configuration (issue #32). Runs against the local stack:
 *   docker compose up -d && pnpm --filter @agora/api dev
 *   pnpm --filter @agora/web dev
 * CI (e2e job) starts the compose stack and both apps before this suite.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    extraHTTPHeaders: {
      'x-e2e-run': 'agora-playwright',
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.E2E_SKIP_WEB_SERVER
    ? undefined
    : {
        command: 'pnpm --filter @agora/web dev',
        url: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

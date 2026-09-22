import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 300_000,
  expect: {
    timeout: 20_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  },
  projects: [
    {
      name: 'chromium',
    },
  ],
  webServer: {
    // Always serve the production build: `next dev` cannot start twice in one checkout
    // (.next/dev lock), and the mock gate is a runtime env check, so `next start` works.
    // Run `npm run build` first (CI does).
    command: 'npm run start -- -H 127.0.0.1 -p 3100',
    url: 'http://127.0.0.1:3100',
    env: {
      MOCK_AI: '1',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    // Dedicated port so a developer's own `next dev` on 3000 (without MOCK_AI) is never reused.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});

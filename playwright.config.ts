import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],
  use: {
    browserName: 'chromium',
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: process.env.CI
      ? 'pnpm db:migrate:local && pnpm test:preview'
      : 'pnpm build && pnpm db:migrate:local && pnpm test:preview',
    url: 'http://localhost:4173',
    timeout: 120_000,
    reuseExistingServer: false,
  },
  testMatch: '**/*.e2e.{ts,js}',
});

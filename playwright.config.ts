import { defineConfig } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: isCI ? 1 : 0,
  reporter: isCI
    ? [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]]
    : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: [
      'pnpm run build',
      'pnpm exec wrangler d1 migrations apply DB --env preview --local --persist-to .wrangler/e2e',
      'pnpm exec wrangler d1 execute DB --env preview --local --persist-to .wrangler/e2e --file tests/support/public-posts.sql',
      'pnpm run preview --persist-to .wrangler/e2e',
    ].join(' && '),
    url: 'http://localhost:4173',
    reuseExistingServer: false,
  },
  testMatch: '**/*.e2e.{ts,js}',
});

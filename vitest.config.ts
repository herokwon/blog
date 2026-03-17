import { playwright } from '@vitest/browser-playwright';
import { mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

type VitestConfig = Pick<typeof viteConfig, 'test'>;

export default mergeConfig(viteConfig, {
  test: {
    globals: true,
    expect: { requireAssertions: true },
    reporters:
      process.env.GITHUB_ACTIONS === 'true'
        ? ['default', 'hanging-process', 'github-actions']
        : ['default', 'hanging-process'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,svelte}'],
      exclude: [
        'src/**/*.{test,spec}.{js,ts}',
        'src/**/index.{js,ts}',
        'src/lib/types/**',
        'src/**/*.d.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    projects: [
      {
        extends: './vite.config.ts',
        test: {
          name: 'client',
          browser: {
            enabled: true,
            // If PW_WS_ENDPOINT is provided by the setup file, connect to it so
            // the worker can reuse a single Chromium server instance.
            provider: playwright({
              connectOptions: process.env.PW_WS_ENDPOINT
                ? {
                    wsEndpoint: process.env.PW_WS_ENDPOINT,
                  }
                : undefined,
            }),
            instances: [{ browser: 'chromium', headless: true }],
          },
          // The global Playwright WebSocket endpoint can be provided via
          // `process.env.PW_WS_ENDPOINT` when running tests. We no longer use
          // a worker-level setup file to avoid bundling issues.
          include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
          exclude: ['src/lib/server/**'],
        },
      },
      {
        extends: './vite.config.ts',
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{js,ts}'],
          exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
        },
      },
    ],
  },
} satisfies VitestConfig);

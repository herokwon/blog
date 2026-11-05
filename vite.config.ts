import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    sveltekit({
      compilerOptions: {
        runes: ({ filename }) =>
          filename.split(/[/\\\\]/).includes('node_modules') ? undefined : true,
      },
      adapter: adapter(),
    }),
  ],
  test: {
    expect: { requireAssertions: true },
    reporters:
      process.env.GITHUB_ACTIONS === 'true'
        ? ['default', 'github-actions']
        : ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: process.env.CI ? ['text'] : ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,svelte}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.{test,spec}.{js,ts}',
        'src/**/*.e2e.{js,ts}',
      ],
    },
    projects: [
      {
        extends: './vite.config.ts',
        test: {
          name: 'client',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium', headless: true }],
          },
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
});

import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
      },
      adapter: adapter(),
      typescript: {
        config: config => {
          config.include.push(
            '../*.config.ts',
            '../scripts/**/*.ts',
            '../vitest.setup.ts',
            '../vitest-env.d.ts',
            '../worker-configuration.d.ts',
          );
        },
      },
    }),
  ],
  test: {
    globals: true,
    expect: { requireAssertions: true },
    reporters: [
      'default',
      'hanging-process',
      ...(process.env.GITHUB_ACTIONS === 'true' ? ['github-actions'] : []),
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,svelte}'],
      exclude: [
        'src/**/*.{test,spec}.{js,ts}',
        'src/**/index.{js,ts}',
        'src/**/*.d.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
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
            provider: playwright(),
            instances: [{ browser: 'chromium', headless: true }],
          },
          include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
          exclude: ['src/lib/server/**'],
        },
      },
      {
        extends: './vite.config.ts',
        plugins: [
          cloudflareTest(async () => {
            const migrationsPath = path.join(import.meta.dirname, 'drizzle');
            const migrations = await readD1Migrations(migrationsPath);

            return {
              miniflare: {
                compatibilityDate: '2026-08-24',
                compatibilityFlags: ['nodejs_als'],
                d1Databases: ['DB'],
                bindings: {
                  TEST_MIGRATIONS: migrations,
                },
              },
            };
          }),
        ],
        test: {
          setupFiles: ['./vitest.setup.ts'],
          name: 'server',
          include: ['src/**/*.{test,spec}.{js,ts}'],
          exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
        },
      },
      {
        extends: './vite.config.ts',
        test: {
          name: 'scripts',
          environment: 'node',
          include: ['scripts/**/*.{test,spec}.{js,ts}'],
          exclude: [
            'src/**/*.svelte.{test,spec}.{js,ts}',
            'src/**/*.{test,spec}.{js,ts}',
          ],
        },
      },
    ],
  },
});

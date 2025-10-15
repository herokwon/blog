import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: 'istanbul',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/app/**/*.{ts,tsx}',
        'src/**/*.worker.ts',
        'src/**/supabase/**',
        'src/middleware.ts',
        '**/*.d.ts',
      ],
    },
    projects: [
      // Unit 테스트
      {
        resolve: {
          alias: {
            '@': path.resolve(__dirname, 'src'),
          },
        },
        test: {
          globals: true,
          name: 'Unit Tests',
          environment: 'jsdom',
          pool: 'threads',
          setupFiles: './vitest.setup.ts',
          include: ['src/**/!(*.worker).{test,spec}.{ts,tsx}'],
        },
        esbuild: {
          jsx: 'automatic',
        },
      },
      // Cloudflare Workers 테스트
      defineWorkersProject({
        test: {
          globals: true,
          name: 'Workers Tests',
          include: ['src/**/*.worker.{test,spec}.ts'],
          poolOptions: {
            workers: {
              wrangler: {
                configPath: './wrangler.jsonc',
              },
            },
          },
        },
      }),
    ],
  },
});

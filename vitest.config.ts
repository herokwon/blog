import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    pool: 'threads',
    environment: 'jsdom',
    setupFiles: 'vitest.setup.ts',
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/app/**/*.{ts,tsx}'],
    },
  },
});

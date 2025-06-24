///<reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    globals: true,
    pool: 'threads',
    environment: 'jsdom',
    setupFiles: 'vitest.setup.ts',
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
    },
  },
});

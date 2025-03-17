import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    setupFiles: './vitest.setup.ts',
    include: ['src/**/*.(spec|test).ts?(x)'],
    coverage: {
      provider: 'v8',
      enabled: true,
      include: ['src/**/*'],
      exclude: ['**/!(*.spec|*.test).ts?(x)'],
    },
    pool: 'threads',
    environment: 'jsdom',
    globals: true,
  },
});

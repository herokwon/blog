import { sveltekit } from '@sveltejs/kit/vite';

import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  optimizeDeps: {
    include: [
      '@milkdown/core',
      '@milkdown/plugin-listener',
      '@milkdown/preset-commonmark',
      '@milkdown/prose/commands',
      '@milkdown/prose/inputrules',
      '@milkdown/utils',
    ],
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Milkdown is client-only; SSR build correctly omits it via $effect tree-shaking
        const isMilkdownUnusedExternalImport =
          warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
          /@milkdown\//.test(warning.message ?? '');

        if (isMilkdownUnusedExternalImport) return;
        warn(warning);
      },
    },
  },
  test: {
    expect: { requireAssertions: true },
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

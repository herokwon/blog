import { sveltekit } from '@sveltejs/kit/vite';

import tailwindcss from '@tailwindcss/vite';
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
      '@milkdown/prose/state',
      '@milkdown/utils',
      '@prosemirror-adapter/svelte',
      'remark-directive',
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
});

import type { PrettierConfig } from '@ianvs/prettier-plugin-sort-imports';

const config: PrettierConfig = {
  useTabs: false,
  tabWidth: 2,
  singleQuote: true,
  arrowParens: 'avoid',
  trailingComma: 'all',
  importOrderCaseSensitive: false,
  importOrder: [
    '^svelte(.*)$',
    '^@sveltejs(.*)$',
    '^#lib(?:/|$)',
    '<BUILTIN_MODULES>',
    '<THIRD_PARTY_MODULES>',
    '\\.css$',
    '^[./]',
  ],
  plugins: ['prettier-plugin-svelte', '@ianvs/prettier-plugin-sort-imports'],
  overrides: [
    { files: '*.svelte', options: { parser: 'svelte' } },
    { files: '*.jsonc', options: { trailingComma: 'none' } },
  ],
};

export default config;

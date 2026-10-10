import type { Config } from 'prettier';

const config: Config = {
  tabWidth: 2,
  endOfLine: 'auto',
  singleQuote: true,
  arrowParens: 'avoid',
  trailingComma: 'all',
  importOrderCaseSensitive: false,
  importOrder: [
    '^svelte(.*)$',
    '^@sveltejs(.*)$',
    '^\\$lib/',
    '<BUILTIN_MODULES>',
    '<THIRD_PARTY_MODULES>',
    '\\.css$',
    '^[./]',
  ],
  plugins: [
    'prettier-plugin-svelte',
    '@ianvs/prettier-plugin-sort-imports',
    'prettier-plugin-tailwindcss',
  ],
  overrides: [
    {
      files: '*.svelte',
      options: { parser: 'svelte' },
    },
    {
      files: '*.jsonc',
      options: { trailingComma: 'none' },
    },
    {
      files: 'worker-configuration.d.ts',
      options: {
        endOfLine: 'lf',
        useTabs: true,
        printWidth: 100,
        arrowParens: 'always',
        trailingComma: 'none',
      },
    },
  ],
  tailwindStylesheet: './src/routes/layout.css',
};

export default config;

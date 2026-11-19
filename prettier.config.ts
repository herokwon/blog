import type { PrettierConfig } from '@ianvs/prettier-plugin-sort-imports';
import { version as typescriptVersion } from 'typescript';

const config: PrettierConfig = {
  useTabs: false,
  tabWidth: 2,
  singleQuote: true,
  arrowParens: 'avoid',
  trailingComma: 'all',
  printWidth: 80,
  semi: true,
  endOfLine: 'lf',
  importOrderCaseSensitive: false,
  importOrderTypeScriptVersion: typescriptVersion,
  importOrder: [
    '^svelte(?:/.*)?$',
    '',
    '^@sveltejs/',
    '^\\$app/',
    '',
    '^#lib(?:/.*)?$',
    '',
    '<BUILTIN_MODULES>',
    '<THIRD_PARTY_MODULES>',
    '',
    '\\.css$',
    '',
    '^[./]',
  ],
  plugins: ['prettier-plugin-svelte', '@ianvs/prettier-plugin-sort-imports'],
  overrides: [
    { files: '*.svelte', options: { parser: 'svelte' } },
    { files: '*.jsonc', options: { trailingComma: 'none' } },
  ],
};

export default config;

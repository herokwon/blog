import { FlatCompat } from '@eslint/eslintrc';

import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.config({
    extends: ['next/core-web-vitals', 'next/typescript', 'prettier'],
  }),
];

export default eslintConfig;

// next.js v16 uses format
// import nextVitals from 'eslint-config-next/core-web-vitals';
// import nextTs from 'eslint-config-next/typescript';
// import prettier from 'eslint-config-prettier/flat';
// import { defineConfig, globalIgnores } from 'eslint/config';

// const eslintConfig = defineConfig([
//   ...nextVitals,
//   ...nextTs,
//   prettier,
//   {
//     rules: {
//       'no-restricted-imports': [
//         'error',
//         {
//           patterns: ['@/features/*/*'],
//         },
//       ],
//     },
//   },
//   globalIgnores([
//     '.next/**',
//     'out/**',
//     'build/**',
//     'dist/**',
//     'next-env.d.ts',
//     'node_modules/**',
//     '.wrangler/**',
//     '.open-next/**',
//     'coverage/**',
//     'public/**',
//   ]),
// ]);

// export default eslintConfig;

import eslintConfigPrettier from 'eslint-config-prettier/flat';
import astro from 'eslint-plugin-astro';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

import eslint from '@eslint/js';

import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  { ignores: ['dist', 'node_modules', 'coverage', '.astro'] },
  {
    files: ['**/*.config.{js,cjs,mjs,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs['recommended-latest'],
  reactRefresh.configs.vite,
  jsxA11y.flatConfigs.recommended,
  eslintConfigPrettier,
);

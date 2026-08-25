import type { Config } from 'prettier';

const config: Config = {
	tabWidth: 2,
	singleQuote: true,
	arrowParens: 'avoid',
	trailingComma: 'all',
	importOrderSeparation: true,
	importOrderSortSpecifiers: true,
	importOrderCaseInsensitive: true,
	importOrder: [
		'^svelte(.*)$',
		'^@sveltejs(.*)$',
		'^\\$lib/',
		'<THIRD_PARTY_MODULES>',
		'\\.css$',
		'^[./]'
	],
	plugins: [
		'prettier-plugin-svelte',
		'@trivago/prettier-plugin-sort-imports',
		'prettier-plugin-tailwindcss'
	],
	overrides: [
		{
			files: '*.svelte',
			options: { parser: 'svelte' }
		},
		{
			files: '*.jsonc',
			options: {
				trailingComma: 'none'
			}
		}
	],
	tailwindStylesheet: './src/routes/layout.css'
};

export default config;

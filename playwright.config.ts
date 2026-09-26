import { defineConfig } from '@playwright/test';

const baseURL = 'http://localhost:4173';

export default defineConfig({
	testMatch: '**/*.e2e.{ts,js}',
	use: {
		baseURL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	webServer: {
		command: 'pnpm run build && pnpm run preview',
		url: baseURL,
		reuseExistingServer: false
	}
});

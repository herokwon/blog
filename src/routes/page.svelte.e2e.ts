import { expect, test } from '@playwright/test';

test('serves the built homepage without browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('/');
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Personal Blog',
  );
  expect(errors).toEqual([]);
});

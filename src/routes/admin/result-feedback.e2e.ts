import { expect } from '@playwright/test';
import { test } from '../../../tests/admin/local-d1';

for (const [tone, status, code] of [
  ['error', 400, 'VALIDATION_ERROR'],
  ['conflict', 409, 'POST_VERSION_CONFLICT'],
  ['uncertain', 503, 'INTERNAL_ERROR'],
] as const) {
  test(`lifecycle ${tone} feedback reflects the response without changing the post`, async ({
    page,
    api,
    localD1,
  }) => {
    await page.setExtraHTTPHeaders({
      'Cf-Access-Jwt-Assertion': await localD1.token(),
    });
    const post = await (
      await api.post('/api/admin/posts', {
        data: { title: 'Feedback', body: 'Body' },
      })
    ).json();
    await page.route(`**/api/admin/posts/${post.id}/publish`, route =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code, message: 'Test response' } }),
      }),
    );
    await page.goto(`${localD1.origin}/admin/posts/${post.id}`);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '발행', exact: true }).click();
    await expect(
      page.locator(`.admin-feedback[data-tone="${tone}"]`),
    ).toBeVisible();
    expect(
      (await (await api.get(`/api/admin/posts/${post.id}`)).json()).revision,
    ).toBe(1);
    await expect(
      page.getByRole('button', { name: '발행', exact: true }),
    ).toBeEnabled();
  });
}

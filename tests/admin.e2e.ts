import { expect, test } from '@playwright/test';

test('public pages stay anonymous and the real Worker rejects unauthenticated administrator access', async ({
  request,
}) => {
  expect((await request.get('/')).status()).toBe(200);
  for (const path of [
    '/admin',
    '/admin/posts',
    '/%61dmin/posts',
    '/admin/media',
  ]) {
    const response = await request.get(path, {
      headers: { 'cf-access-authenticated-user-email': 'author@example.test' },
    });
    expect(response.status()).toBe(401);
    expect(response.headers()['cache-control']).toContain('no-store');
  }
});

test('fixture-signed author reaches administrator shell and cross-origin writes are blocked', async ({
  page,
  request,
}) => {
  const tokenResponse = await request.get('http://127.0.0.1:4174/token');
  const token = await tokenResponse.text();
  await page.setExtraHTTPHeaders({ 'cf-access-jwt-assertion': token });
  const response = await page.goto('/admin');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['cache-control']).toContain('no-store');
  await expect(page).toHaveURL(/\/admin\/posts$/);
  await expect(
    page.getByRole('heading', { name: 'Posts', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Administrator navigation' }),
  ).toBeVisible();
  const denied = await request.post('/admin/posts', {
    headers: {
      'cf-access-jwt-assertion': token,
      origin: 'https://evil.example.test',
    },
    data: {},
  });
  expect(denied.status()).toBe(403);
});

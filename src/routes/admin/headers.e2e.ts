import { expect, test } from '@playwright/test';

test('initial HTML transports a fresh style nonce matching its CSP', async ({
  request,
}) => {
  const first = await request.get('/');
  const html = await first.text();
  const nonce = html.match(
    /name="admin-style-nonce" content="([A-Za-z0-9+/=]+)"/,
  )?.[1];
  expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  expect(first.headers()['content-security-policy']).toContain(
    `'nonce-${nonce}'`,
  );
  expect(first.headers()['content-security-policy']).not.toMatch(
    /unsafe-inline|unsafe-eval/,
  );
  const secondHtml = await (await request.get('/')).text();
  const secondNonce = secondHtml.match(
    /name="admin-style-nonce" content="([A-Za-z0-9+/=]+)"/,
  )?.[1];
  expect(secondNonce).not.toBe(nonce);
});

test('Admin authentication failures receive complete security headers', async ({
  request,
}) => {
  const response = await request.get('/api/admin/posts');
  expect(response.status()).toBe(401);
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-frame-options']).toBe('DENY');
  expect(response.headers()['referrer-policy']).toBe(
    'strict-origin-when-cross-origin',
  );
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(response.headers()['content-security-policy']).toContain(
    "frame-ancestors 'none'",
  );
  expect(response.headers()['content-security-policy']).toContain(
    "style-src-attr 'none'",
  );
  expect(response.headers()['content-security-policy']).not.toMatch(
    /unsafe-inline|unsafe-eval/,
  );
});

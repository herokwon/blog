import { expect, test } from '@playwright/test';

test('administrator routes reject anonymous and forged identity headers', async ({
  request,
}) => {
  for (const path of ['/admin', '/admin/example']) {
    const response = await request.get(path, {
      headers: {
        'Cf-Access-Authenticated-User-Email': 'wooyng825@gmail.com',
        'Cf-Access-Jwt-Assertion': 'forged.token.value',
      },
    });
    expect(response.status()).toBe(403);
    expect(response.headers()['cache-control']).toBe('no-store');
  }
});

test('encoded administrator routes cannot bypass authentication', async ({
  request,
}) => {
  for (const path of ['/adm%69n', '/%61dmin/']) {
    const response = await request.get(path);
    expect(response.status()).toBe(403);
  }
});

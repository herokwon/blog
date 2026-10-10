import { expect, test } from '@playwright/test';

test('production runtime authenticates Admin form writes before origin rejection', async ({
  request,
}) => {
  for (const contentType of [
    'text/plain',
    'application/x-www-form-urlencoded',
    'multipart/form-data; boundary=test',
  ]) {
    for (const origin of [undefined, 'https://untrusted.example']) {
      const response = await request.post('/api/admin/posts', {
        headers: {
          'Content-Type': contentType,
          ...(origin ? { Origin: origin } : {}),
          'Cf-Access-Authenticated-User-Email': 'forged@example.test',
        },
        data: 'title=forged',
      });
      expect(response.status()).toBe(401);
      expect(response.headers()['cache-control']).toBe('no-store');
      expect(response.headers()['content-type']).toContain('application/json');
      expect(await response.json()).toMatchObject({
        error: { code: 'UNAUTHORIZED' },
      });
    }
  }
});

test('production runtime protects exact Admin paths including encoded routes', async ({
  request,
}) => {
  for (const path of [
    '/admin',
    '/admin/posts',
    '/api/admin',
    '/api/admin/posts',
    '/api/admin/posts/',
    '/api/admin/posts/trash/',
    '/%61dmin/posts',
    '/api/%61dmin/posts',
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()['cache-control']).toBe('no-store');
    expect(await response.json()).toMatchObject({
      error: { code: 'UNAUTHORIZED' },
    });
  }
  for (const path of ['/administrator', '/api/admin-tools']) {
    expect((await request.get(path)).status()).toBe(404);
  }
});

test('production runtime retains Public form origin protection', async ({
  request,
  baseURL,
}) => {
  for (const contentType of [
    'text/plain',
    'application/x-www-form-urlencoded',
    'multipart/form-data; boundary=test',
    'application/x-sveltekit-formdata',
    'Text/Plain; charset=utf-8',
  ]) {
    for (const origin of [undefined, 'https://untrusted.example']) {
      const response = await request.post('/administrator', {
        headers: {
          'Content-Type': contentType,
          ...(origin ? { Origin: origin } : {}),
        },
        data: 'test',
      });
      expect(response.status()).toBe(403);
      expect(await response.text()).toContain(
        'Cross-site POST form submissions are forbidden',
      );
    }
  }
  const sameOrigin = await request.post('/administrator', {
    headers: { 'Content-Type': 'text/plain', Origin: baseURL! },
    data: 'test',
  });
  expect(sameOrigin.status()).toBe(404);
});

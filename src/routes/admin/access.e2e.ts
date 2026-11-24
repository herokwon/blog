import { expect, test } from '@playwright/test';

test('administrator routes reject anonymous and forged identity headers', async ({
  request,
}) => {
  for (const path of [
    '/admin',
    '/admin/posts/example',
    '/admin/posts/example/__data.json',
    '/admin/trash',
    '/admin/trash/__data.json',
  ]) {
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

test('post and category forms reject unauthenticated mutations', async ({
  request,
  baseURL,
}) => {
  for (const path of [
    '/admin/categories?/create',
    '/admin/categories?/rename',
    '/admin/categories?/remove',
    '/admin/posts/new?/saveDraft',
    '/admin/posts/example/edit?/save',
    '/admin/posts/example?/publish',
    '/admin/posts/example?/archive',
    '/admin/posts/example?/delete',
    '/admin/trash?/restore',
  ]) {
    const response = await request.post(path, {
      form: { title: 'Test' },
      headers: { Origin: baseURL! },
    });
    expect(response.status()).toBe(403);
    expect(await response.text()).toBe('Access denied');
    expect(response.headers()['cache-control']).toBe('no-store');
  }
});

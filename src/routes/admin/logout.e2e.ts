import { expect } from '@playwright/test';
import { test } from '../../../tests/admin/local-d1';

test('verified logout returns home after both checks', async ({
  page,
  localD1,
}) => {
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
  await page.addInitScript(() => {
    const original = window.fetch;
    let logout = false;
    window.fetch = async (input, options) => {
      if (String(input) === '/cdn-cgi/access/logout') {
        logout = true;
        return { type: 'opaqueredirect', status: 0 } as Response;
      }
      if (String(input) === '/api/admin/posts' && logout)
        return { type: 'opaqueredirect', status: 0 } as Response;
      return original(input, options);
    };
  });
  await page.goto(`${localD1.origin}/admin/logout`);
  await expect(page).toHaveURL(`${localD1.origin}/`);
});

test('unknown logout stays on the error screen and retry completes', async ({
  page,
  localD1,
}) => {
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
  await page.addInitScript(() => {
    const original = window.fetch;
    let calls = 0;
    window.fetch = async (input, options) => {
      if (String(input) === '/cdn-cgi/access/logout') {
        if (++calls === 1) throw new TypeError('transport failure');
        return { type: 'opaqueredirect', status: 0 } as Response;
      }
      if (String(input) === '/api/admin/posts')
        return { type: 'opaqueredirect', status: 0 } as Response;
      return original(input, options);
    };
  });
  await page.goto(`${localD1.origin}/admin/logout`);
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
  await expect(page).toHaveURL(`${localD1.origin}/admin/logout`);
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page).toHaveURL(`${localD1.origin}/`);
});

test('recovery cleanup failure blocks logout transport', async ({
  page,
  localD1,
}) => {
  const logoutRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/cdn-cgi/access/logout'))
      logoutRequests.push(request.url());
  });
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
  await page.addInitScript(() => {
    Storage.prototype.removeItem = () => {
      throw new Error('storage denied');
    };
  });
  await page.goto(`${localD1.origin}/admin/logout`);
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
  await expect(page).toHaveURL(`${localD1.origin}/admin/logout`);
  expect(logoutRequests).toEqual([]);
});

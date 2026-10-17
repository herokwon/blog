import { expect } from '@playwright/test';
import { test } from '../../../tests/admin/local-d1';

test('pending logout locks Admin controls while its status remains accessible, then failure unlocks retry', async ({
  page,
  localD1,
}, testInfo) => {
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
  await page.addInitScript(() => {
    const original = window.fetch;
    window.fetch = async (input, options) => {
      if (String(input) === '/cdn-cgi/access/logout') {
        await new Promise<void>(resolve => {
          Object.assign(window, { finishLogoutProbe: resolve });
        });
        throw new TypeError('Controlled logout failure');
      }
      return original(input, options);
    };
  });
  await page.goto(`${localD1.origin}/admin/logout`);
  await expect(page.locator('.admin-workspace')).toHaveAttribute('inert', '');
  await expect(
    page.getByRole('banner', { includeHidden: true }),
  ).toHaveAttribute('inert', '');
  await expect(page.getByRole('status')).toContainText('로그아웃');
  const overlay = page.locator('[data-processing="global"]');
  await expect(overlay).toBeVisible();
  const bounds = await overlay.boundingBox();
  expect(bounds).toEqual({ x: 0, y: 0, ...page.viewportSize() });
  await page.screenshot({ path: testInfo.outputPath('global-loading.png') });
  expect(
    await page.locator('.admin-session a').evaluate(link => {
      (link as HTMLElement).focus();
      return document.activeElement === link;
    }),
  ).toBe(false);
  await page.evaluate(() =>
    (
      window as unknown as { finishLogoutProbe: () => void }
    ).finishLogoutProbe(),
  );
  await expect(page.locator('.admin-workspace')).not.toHaveAttribute(
    'inert',
    '',
  );
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeFocused();
  await expect(overlay).toHaveCount(0);
});

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
  const dialogs: string[] = [];
  page.on('dialog', async dialog => {
    dialogs.push(dialog.type());
    await dialog.dismiss();
  });
  await page.goto(`${localD1.origin}/admin/posts`);
  await page.getByRole('link', { name: '로그아웃', exact: true }).click();
  await expect(page).toHaveURL(`${localD1.origin}/`);
  expect(dialogs).toEqual([]);
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
  const notice = page.getByRole('group', { name: '작업 결과' });
  await expect(notice.getByRole('status')).toContainText(
    '로그아웃에 실패했습니다.',
  );
  const retry = notice.getByRole('button', { name: '다시 시도' });
  await expect(retry).toBeFocused();
  await expect(notice.getByRole('button', { name: '안내 닫기' })).toHaveCount(
    0,
  );
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const noticeBox = await notice.boundingBox();
    const retryBox = await retry.boundingBox();
    expect(retryBox!.width).toBeLessThan(noticeBox!.width / 2);
    const messageBox = await notice.getByRole('status').boundingBox();
    if (width === 390) {
      expect(retryBox!.y).toBeGreaterThanOrEqual(
        messageBox!.y + messageBox!.height,
      );
      expect(retryBox!.x).toBeCloseTo(messageBox!.x, 0);
    } else {
      expect(retryBox!.y).toBeLessThan(messageBox!.y + messageBox!.height);
      expect(
        noticeBox!.x + noticeBox!.width - retryBox!.x - retryBox!.width,
      ).toBeCloseTo(16, 0);
    }
  }
  await expect(page).toHaveURL(`${localD1.origin}/admin/logout`);
  await retry.click();
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

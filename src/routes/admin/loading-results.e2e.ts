import { expect } from '@playwright/test';
import { test } from '../../../tests/admin/local-d1';

test('observed publication carries one persistent accurate result across authoring navigation', async ({
  page,
  api,
  localD1,
}) => {
  await localD1.db.prepare('DELETE FROM posts').run();
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
  page.on('dialog', dialog => dialog.accept());
  await page.goto(`${localD1.origin}/admin/posts/new`);
  await expect(page.locator('.ProseMirror')).toHaveAttribute(
    'contenteditable',
    'true',
  );
  await page
    .getByLabel('제목', { exact: true })
    .fill('Observed publication loading');
  await page.locator('.ProseMirror').fill('Body');
  let publishedId = '';
  await page.route(/\/api\/admin\/posts\/[^/]+\/publish$/, async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (!publishedId) {
      publishedId = pathname.split('/').at(-2)!;
      const result = await api.post(pathname, {
        data: route.request().postDataJSON(),
      });
      expect(result.status()).toBe(200);
      await route.fulfill({ status: 503 });
    } else {
      await route.fulfill({
        status: 409,
        json: {
          error: {
            code: 'POST_VERSION_CONFLICT',
            message: 'Controlled lost response',
          },
        },
      });
    }
  });
  await page.getByRole('button', { name: '발행', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[^/]+\/edit$/);
  const notice = page.locator('.admin-feedback[data-tone="uncertain"]');
  await expect(notice).toHaveCount(1);
  await expect(notice).toContainText('최신 상태를 확인했습니다.');
  await expect(notice).toContainText('요청의 처리 여부는 확인할 수 없습니다.');
  await expect(
    page.locator('.admin-feedback[data-tone="success"]'),
  ).toHaveCount(0);
  await expect(page.locator('[data-processing]')).toHaveCount(0);
  await expect(page.locator('header')).not.toHaveAttribute('inert', '');
  expect(
    (await (await api.get(`/api/admin/posts/${publishedId}`)).json()).status,
  ).toBe('published');
  await page.clock.install();
  await page.clock.fastForward(6000);
  await expect(notice).toBeVisible();
  await page.clock.resume();
  await page.getByRole('link', { name: '취소', exact: true }).click();
  await expect(page.locator('.post-detail')).toBeVisible();
  await expect(notice).toHaveCount(0);
});

test('dismissing an observed result during destination loading prevents replay after navigation', async ({
  page,
  api,
  localD1,
}) => {
  await localD1.db.prepare('DELETE FROM posts').run();
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
  page.on('dialog', dialog => dialog.accept());
  await page.goto(`${localD1.origin}/admin/posts/new`);
  await expect(page.locator('.ProseMirror')).toHaveAttribute(
    'contenteditable',
    'true',
  );
  await page
    .getByLabel('제목', { exact: true })
    .fill('Dismissed observed publication');
  await page.locator('.ProseMirror').fill('Body');
  let committed = false;
  await page.route(/\/api\/admin\/posts\/[^/]+\/publish$/, async route => {
    if (!committed) {
      committed = true;
      await api.post(new URL(route.request().url()).pathname, {
        data: route.request().postDataJSON(),
      });
    }
    await route.fulfill({ status: 503 });
  });
  let release!: () => void;
  const destination = new Promise<void>(resolve => (release = resolve));
  let requested = false;
  await page.route(/\/admin\/posts\/[^/]+\/edit\/__data\.json/, async route => {
    requested = true;
    await destination;
    await route.continue();
  });
  try {
    await page.getByRole('button', { name: '발행', exact: true }).click();
    await expect.poll(() => requested).toBe(true);
    const notice = page.locator('.admin-feedback[data-tone="uncertain"]');
    await expect(notice).toContainText('최신 상태를 확인했습니다.');
    await notice.getByRole('button', { name: '안내 닫기' }).click();
    await expect(notice).toHaveCount(0);
    release();
    await expect(page).toHaveURL(/\/admin\/posts\/[^/]+\/edit$/);
    await expect(page.getByLabel('제목', { exact: true })).toBeEnabled();
    await expect(notice).toHaveCount(0);
    await page.clock.install();
    await page.clock.fastForward(6000);
    await expect(notice).toHaveCount(0);
    await expect(
      page.locator('.admin-feedback[data-tone="success"]'),
    ).toHaveCount(0);
  } finally {
    release();
  }
});

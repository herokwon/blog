import { expect } from '@playwright/test';
import { test } from '../../../tests/admin/local-d1';

test('confirmed results use the summary, cross navigation once and expire or dismiss', async ({
  page,
  api,
  localD1,
}) => {
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
  const post = await (
    await api.post('/api/admin/posts', {
      data: { title: 'Private title', body: 'Body' },
    })
  ).json();
  await page.goto(`${localD1.origin}/admin/posts`);
  page.on('dialog', dialog => dialog.accept());
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.getByRole('button', { name: 'Private title 작업 메뉴' }).click();
  await page.getByRole('button', { name: '발행', exact: true }).click();
  await expect(page).toHaveURL(`${localD1.origin}/admin/posts/${post.id}`);
  const notice = page.locator('.admin-feedback[data-tone="success"]');
  await expect(notice.locator('.feedback-summary')).toHaveText(
    '발행되었습니다.',
  );
  await expect(notice.locator('.feedback-details')).toHaveCount(0);
  await expect(notice).not.toContainText('Private title');
  await page.clock.fastForward(2000);
  await notice.hover();
  await page.clock.fastForward(6000);
  await expect(notice).toBeVisible();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(2999);
  await expect(notice).toBeVisible();
  await page.clock.fastForward(1);
  await expect(notice).toHaveCount(0);
  await page.getByRole('button', { name: '보관', exact: true }).click();
  await expect(notice.locator('.feedback-summary')).toHaveText(
    '보관되었습니다.',
  );
  const close = notice.getByRole('button', { name: '안내 닫기' });
  await close.focus();
  await page.clock.fastForward(6000);
  await expect(notice).toBeVisible();
  await close.click();
  await expect(notice).toHaveCount(0);
  await page.getByRole('button', { name: '재발행', exact: true }).click();
  await expect(notice.locator('.feedback-summary')).toHaveText(
    '재발행되었습니다.',
  );
  // SvelteKit link navigation waits for a frame and a timer before routing.
  await page.clock.resume();
  await page.getByRole('link', { name: '목록', exact: true }).click();
  await expect(page).toHaveURL(`${localD1.origin}/admin/posts`);
  await expect(notice).toHaveCount(0);
});

test('repeated delete and restore results replace their timers and retain operation-specific summaries', async ({
  page,
  api,
  localD1,
}) => {
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
  await localD1.db.prepare('DELETE FROM posts').run();
  for (const title of ['Delete A', 'Delete B'])
    await api.post('/api/admin/posts', { data: { title, body: 'Body' } });
  await page.goto(`${localD1.origin}/admin/posts`);
  page.on('dialog', dialog => dialog.accept());
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const notice = page.locator('.admin-feedback[data-tone="success"]');
  for (const title of ['Delete A', 'Delete B']) {
    await page.getByRole('button', { name: `${title} 작업 메뉴` }).click();
    await page.getByRole('button', { name: '삭제', exact: true }).click();
    await expect(notice.locator('.feedback-summary')).toHaveText(
      '휴지통으로 이동했습니다.',
    );
    await page.clock.fastForward(4000);
    await expect(notice).toBeVisible();
  }
  await page.clock.fastForward(1000);
  await expect(notice).toHaveCount(0);
  await page.clock.resume();
  await page.getByRole('link', { name: '휴지통', exact: true }).click();
  await expect(page).toHaveURL(`${localD1.origin}/admin/posts/trash`);
  await page.getByRole('button', { name: 'Delete A 작업 메뉴' }).click();
  await page.getByRole('button', { name: '복구', exact: true }).click();
  await expect(notice.locator('.feedback-summary')).toHaveText(
    '복구되었습니다.',
  );
  await page.screenshot({
    path: '.wrangler/admin-ui-task2/restore.png',
    fullPage: true,
  });
});

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
    await page.clock.install();
    await page.clock.fastForward(6000);
    const notice = page.locator(`.admin-feedback[data-tone="${tone}"]`);
    await expect(notice).toBeVisible();
    await notice.getByRole('button', { name: '안내 닫기' }).click();
    await expect(notice).toHaveCount(0);
  });
}

import { expect } from '@playwright/test';
import { test } from '../../../tests/admin/local-d1';

test.beforeEach(async ({ page, localD1 }) => {
  await localD1.db.prepare('DELETE FROM posts').run();
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
});

test('saving cancellation retains input and recovery, then confirmation submits once', async ({
  page,
  localD1,
}) => {
  await page.goto(`${localD1.origin}/admin/posts/new`);
  await expect(page.locator('.ProseMirror')).toBeVisible();
  await expect(
    page.getByRole('button', { name: '저장', exact: true }),
  ).toBeEnabled();
  await page.getByLabel('제목', { exact: true }).fill('Confirmation draft');
  await page.locator('.ProseMirror').fill('Body');
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem('blog:admin:new-post-recovery:v1'),
      ),
    )
    .not.toBeNull();
  let writes = 0;
  page.on('request', request => {
    if (
      request.method() === 'POST' &&
      request.url().endsWith('/api/admin/posts')
    )
      writes++;
  });
  const before = await page.evaluate(() =>
    localStorage.getItem('blog:admin:new-post-recovery:v1'),
  );
  page.once('dialog', async dialog => {
    expect(dialog.message()).toBe('현재 내용을 저장할까요?');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
    'Confirmation draft',
  );
  expect(writes).toBe(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem('blog:admin:new-post-recovery:v1'),
    ),
  ).toBe(before);
  let dialogs = 0;
  page.on('dialog', async dialog => {
    dialogs++;
    await dialog.accept();
  });
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[^/]+\/edit$/);
  expect(writes).toBe(1);
  expect(dialogs).toBe(1);
});

test('each lifecycle action asks once and cancellation leaves the revision unchanged', async ({
  page,
  localD1,
  api,
}) => {
  const post = await (
    await api.post('/api/admin/posts', {
      data: { title: 'Lifecycle confirmation', body: 'Body' },
    })
  ).json();
  await page.goto(`${localD1.origin}/admin/posts/${post.id}`);
  for (const [label, expectedState] of [
    ['발행', 'published'],
    ['공개 취소', 'archived'],
    ['재발행', 'published'],
    ['삭제', 'published'],
    ['복구', 'published'],
  ] as const) {
    const before = await (await api.get(`/api/admin/posts/${post.id}`)).json();
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: label, exact: true }).click();
    expect(
      (await (await api.get(`/api/admin/posts/${post.id}`)).json()).revision,
    ).toBe(before.revision);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect
      .poll(
        async () =>
          (await (await api.get(`/api/admin/posts/${post.id}`)).json())
            .revision,
      )
      .toBe(before.revision + 1);
    expect(
      (await (await api.get(`/api/admin/posts/${post.id}`)).json()).status,
    ).toBe(expectedState);
  }
});

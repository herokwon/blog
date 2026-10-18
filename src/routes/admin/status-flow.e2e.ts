import { expect } from '@playwright/test';
import { test } from '../../../tests/admin/local-d1';

test.beforeEach(async ({ page, localD1 }) => {
  await localD1.db.prepare('DELETE FROM posts').run();
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
});

test('lifecycle confirmations, pending copy and results use the approved state-specific wording', async ({
  page,
  api,
  localD1,
}) => {
  const post = await (
    await api.post('/api/admin/posts', {
      data: { title: 'Copy', body: 'Body' },
    })
  ).json();
  await page.goto(`${localD1.origin}/admin/posts/${post.id}`);
  const steps = [
    [
      '발행',
      'publish',
      '게시글을 발행할까요?\n공개 목록과 상세 페이지에 표시됩니다.',
      '발행 중…',
      '발행되었습니다.',
    ],
    [
      '보관',
      'archive',
      '게시글을 보관할까요?\n더 이상 공개되지 않습니다.',
      '보관 중…',
      '보관되었습니다.',
    ],
    [
      '재발행',
      'publish',
      '게시글을 다시 발행할까요?\n다시 공개되며 최초 발행일은 유지됩니다.',
      '재발행 중…',
      '재발행되었습니다.',
    ],
    [
      '삭제',
      '',
      '게시글을 휴지통으로 이동할까요?\n더 이상 공개되지 않으며, 복구하면 다시 공개됩니다.',
      '휴지통으로 이동 중…',
      '휴지통으로 이동했습니다.',
    ],
  ];
  for (const [label, endpoint, confirmation, progress, success] of steps) {
    const before = await (await api.get(`/api/admin/posts/${post.id}`)).json();
    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe(confirmation);
      await dialog.dismiss();
    });
    await page.getByRole('button', { name: label, exact: true }).click();
    expect(
      (await (await api.get(`/api/admin/posts/${post.id}`)).json()).revision,
    ).toBe(before.revision);
    let release!: () => void;
    const pending = new Promise<void>(resolve => {
      release = resolve;
    });
    const url = `**/api/admin/posts/${post.id}${endpoint ? `/${endpoint}` : ''}`;
    await page.route(url, async route => {
      await pending;
      await route.continue();
    });
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(progress);
    release();
    await expect(page.locator('.feedback-summary')).toHaveText(success);
    await expect(page).toHaveURL(`${localD1.origin}/admin/posts/${post.id}`);
    await page.unroute(url);
    const after = await (await api.get(`/api/admin/posts/${post.id}`)).json();
    if (before.published_at) {
      expect(after.published_at).toBe(before.published_at);
      expect(after.slug).toBe(before.slug);
    }
  }
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '복구', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '보관', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: '목록', exact: true }),
  ).toHaveAttribute('href', '/admin/posts');
  await expect(page.locator('.post-metadata')).not.toContainText('삭제됨');
});

test('deleting drafts and archived posts uses trash wording without a public-restoration warning', async ({
  page,
  api,
  localD1,
}) => {
  for (const status of ['draft', 'archived']) {
    const post = await (
      await api.post('/api/admin/posts', {
        data: { title: status, body: 'Body' },
      })
    ).json();
    if (status === 'archived') {
      await api.post(`/api/admin/posts/${post.id}/publish`, {
        data: { expected_revision: 1 },
      });
      await api.post(`/api/admin/posts/${post.id}/archive`, {
        data: { expected_revision: 2 },
      });
    }
    await page.goto(`${localD1.origin}/admin/posts/${post.id}`);
    page.once('dialog', async dialog => {
      expect(dialog.message()).toBe('게시글을 휴지통으로 이동할까요?');
      await dialog.accept();
    });
    await page.getByRole('button', { name: '삭제', exact: true }).click();
    await expect(page.locator('.feedback-summary')).toHaveText(
      '휴지통으로 이동했습니다.',
    );
  }
});

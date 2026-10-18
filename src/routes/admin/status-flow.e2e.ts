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

for (const width of [1280, 390]) {
  test.describe(`${width}px originating list`, () => {
    test.use({ viewport: { width, height: 900 } });
    test('publishing, archiving and republishing refresh the same filtered page and preserve success', async ({
      page,
      api,
      localD1,
    }) => {
      const post = await (
        await api.post('/api/admin/posts', {
          data: { title: 'List operation', body: 'Body' },
        })
      ).json();
      page.on('dialog', dialog => dialog.accept());
      const notice = page.locator('.feedback-summary');
      const path = '/admin/posts?page=1&limit=2';
      await page.goto(`${localD1.origin}${path}`);
      for (const [label, result] of [
        ['발행', '발행되었습니다.'],
        ['보관', '보관되었습니다.'],
        ['재발행', '재발행되었습니다.'],
      ]) {
        await page
          .getByRole('button', { name: `${post.title} 작업 메뉴`, exact: true })
          .click();
        const button = page.getByRole('button', { name: label, exact: true });
        // Compare the actual presentation with the neutral menu action.
        expect(await button.evaluate(el => getComputedStyle(el).color)).toBe(
          await page
            .getByRole('link', { name: '수정', exact: true })
            .evaluate(el => getComputedStyle(el).color),
        );
        await button.click();
        await expect(notice).toHaveText(result);
        await expect(page).toHaveURL(`${localD1.origin}${path}`);
      }
      await page.goto(
        `${localD1.origin}/admin/posts?status=published&page=1&limit=2`,
      );
      await page.getByRole('button', { name: /작업 메뉴/ }).click();
      await page.getByRole('button', { name: '보관', exact: true }).click();
      await expect(
        page.getByText('게시글이 없습니다.', { exact: true }),
      ).toBeVisible();
      await expect(notice).toHaveText('보관되었습니다.');
      await expect(page).toHaveURL(
        `${localD1.origin}/admin/posts?status=published&page=1&limit=2`,
      );
      await page.getByRole('link', { name: '보관', exact: true }).click();
      await expect(
        page.getByRole('link', { name: post.title, exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `.wrangler/issue-70-list-${width}.png`,
        fullPage: true,
      });
    });

    test('publishing the last filtered item corrects the page and retains completion', async ({
      page,
      api,
      localD1,
    }) => {
      for (const title of ['Older draft', 'Newer draft'])
        await api.post('/api/admin/posts', { data: { title, body: 'Body' } });
      await page.goto(
        `${localD1.origin}/admin/posts?status=draft&page=2&limit=1`,
      );
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: /작업 메뉴/ }).click();
      await page.getByRole('button', { name: '발행', exact: true }).click();
      await expect(page).toHaveURL(
        `${localD1.origin}/admin/posts?status=draft&page=1&limit=1`,
      );
      await expect(page.locator('.feedback-summary')).toHaveText(
        '발행되었습니다.',
      );
      await expect(
        page.getByRole('link', { name: 'Newer draft', exact: true }),
      ).toBeVisible();
    });
  });
}

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

for (const scope of ['list', 'detail']) {
  test(`confirmed publication with failed ${scope} revalidation reports refresh failure and never retries the mutation`, async ({
    page,
    api,
    localD1,
  }) => {
    const post = await (
      await api.post('/api/admin/posts', {
        data: { title: 'Refresh failure', body: 'Body' },
      })
    ).json();
    const path = scope === 'list' ? '/admin/posts' : `/admin/posts/${post.id}`;
    await page.goto(`${localD1.origin}${path}`);
    let writes = 0;
    await page.route(`**/api/admin/posts/${post.id}/publish`, async route => {
      writes++;
      const response = await route.fetch();
      await page.route(`**${path}/__data.json*`, route =>
        route.abort('failed'),
      );
      await page.route(
        scope === 'list'
          ? '**/api/admin/posts?*'
          : `**/api/admin/posts/${post.id}`,
        route => route.abort('failed'),
      );
      await route.fulfill({ response });
    });
    page.once('dialog', dialog => dialog.accept());
    if (scope === 'list')
      await page.getByRole('button', { name: /작업 메뉴/ }).click();
    await page.getByRole('button', { name: '발행', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(
      '최신 상태를 불러오지 못했습니다.',
    );
    await expect(page.locator('.feedback-details')).toHaveText(
      '작업은 완료되었습니다. 페이지를 새로고침해 최신 상태를 확인하세요.',
    );
    await expect(
      page.locator('.admin-feedback[data-tone="success"]'),
    ).toHaveCount(0);
    expect(writes).toBe(1);
    await expect(page).toHaveURL(`${localD1.origin}${path}`);
    if (scope === 'list')
      await page.getByRole('button', { name: /작업 메뉴/ }).click();
    await expect(
      page.getByRole('button', { name: '발행', exact: true }),
    ).toBeEnabled();
    expect(
      (await (await api.get(`/api/admin/posts/${post.id}`)).json()).status,
    ).toBe('published');
  });
}

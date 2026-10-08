import { expect, type APIRequestContext } from '@playwright/test';
import type { AdminPost } from '#lib/admin/contracts.ts';
import { test } from '../../../tests/admin/local-d1';

test('Admin page redirects authenticate first and remain uncached', async ({
  api,
}) => {
  for (const path of [
    '/admin/posts/?page=1&limit=2',
    '/admin/posts/trash/',
    '/admin/posts/00000000-0000-4000-8000-000000000001/',
  ]) {
    const denied = await api.get(path, {
      headers: { 'Cf-Access-Jwt-Assertion': '' },
      maxRedirects: 0,
    });
    expect(denied.status()).toBe(401);
    expect(denied.headers()['cache-control']).toBe('no-store');
    const redirect = await api.get(path, { maxRedirects: 0 });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers()['cache-control']).toBe('no-store');
    expect(redirect.headers().location).toBe(
      path.replace('/?', '?').replace(/\/$/, ''),
    );
  }
});

async function create(
  api: APIRequestContext,
  title: string,
  body = '# Reading\n\nSaved body',
) {
  const response = await api.post('/api/admin/posts', {
    data: { title, body },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as AdminPost;
}

test.beforeEach(async ({ localD1, page }) => {
  await localD1.db.prepare('DELETE FROM posts').run();
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
});

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`${viewport.width}px management`, () => {
    test.use({ viewport });

    test('protected lists reset filters, preserve limit and show accessible heading controls', async ({
      api,
      localD1,
      page,
    }) => {
      for (let index = 0; index < 3; index++)
        await create(api, `Draft ${index}`);
      await page.goto(`${localD1.origin}/admin/posts?page=2&limit=2`);
      await expect(
        page.getByRole('heading', { name: '게시글', exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: '글쓰기' })).toBeVisible();
      await expect(
        page.getByRole('link', { name: '휴지통', exact: true }),
      ).toBeVisible();
      await page.getByRole('link', { name: '초안', exact: true }).click();
      await expect(page).toHaveURL(
        `${localD1.origin}/admin/posts?status=draft&page=1&limit=2`,
      );
      await expect(
        page.getByRole('link', { name: '초안', exact: true }),
      ).toHaveAttribute('aria-current', 'true');
      await expect(
        page.getByRole('navigation', { name: '페이지' }),
      ).toBeVisible();
      const shell = await page.locator('.admin-shell').boundingBox();
      expect(shell!.width).toBeLessThanOrEqual(1024);
      await page.screenshot({
        path: `.superpowers/sdd/v0.2.0-implementation/task9-list-${viewport.width}.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByRole('table')).toBeHidden();
      await expect(page.locator('.post-cards')).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });

    test('detail hydrates safely under Worker CSP and remounts when navigating between sources', async ({
      api,
      localD1,
      page,
    }) => {
      const first = await create(
        api,
        'First article',
        '## First body\n\n```typescript\nconst value = 1;\n```',
      );
      const second = await create(
        api,
        'Second article',
        '## Second body\n\n[unsafe](javascript:alert(1))\n\n<script>window.unsafe = true</script>',
      );
      const errors: string[] = [];
      page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
      });
      const response = await page.goto(
        `${localD1.origin}/admin/posts/${first.id}`,
      );
      expect(response?.headers()['content-security-policy']).toContain(
        "default-src 'self'",
      );
      expect(response?.headers()['cache-control']).toBe('no-store');
      expect(response?.headers()['content-security-policy']).toContain(
        "style-src-attr 'none'",
      );
      await expect(page.locator('.admin-reading .ProseMirror')).toContainText(
        'First body',
      );
      await expect(page.locator('.admin-reading .cm-editor')).toBeVisible();
      await expect(
        page.locator('.admin-reading [contenteditable=true]'),
      ).toHaveCount(0);
      await page.getByRole('link', { name: '목록', exact: true }).click();
      await page
        .getByRole('link', { name: 'Second article', exact: true })
        .click();
      await expect(page.locator('.admin-reading .ProseMirror')).toContainText(
        'Second body',
      );
      await expect(page.locator('.admin-reading')).not.toContainText(
        'First body',
      );
      await expect(
        page.locator('.admin-reading a[href^="javascript:"]'),
      ).toHaveCount(0);
      await expect(page.locator('.admin-reading script')).toHaveCount(0);
      const title = await page
        .getByRole('heading', { name: 'Second article', exact: true })
        .boundingBox();
      const metadata = await page.locator('.post-metadata').boundingBox();
      expect(metadata!.y).toBeGreaterThan(title!.y);
      // Kit's generated live region still attempts its fixed inline hiding style.
      // It must remain blocked; our stylesheet supplies the equivalent presentation.
      const announcerViolation =
        'sha256-S8qMpvofolR8Mpjy4kQvEm7m1q8clzU4dfDH0AmvZjo=';
      expect(
        errors.filter(message => !message.includes(announcerViolation)),
      ).toEqual([]);
      expect(
        await page
          .locator('#svelte-announcer')
          .evaluate(element => getComputedStyle(element).clipPath),
      ).toBe('inset(50%)');
      await page.goBack();
      await page
        .getByRole('link', { name: 'First article', exact: true })
        .click();
      await expect(page.locator('.admin-reading .ProseMirror')).toContainText(
        'First body',
      );
      expect(second.id).not.toBe(first.id);
    });

    test('lifecycle controls respect status and published deletion/restoration confirmations', async ({
      api,
      localD1,
      page,
    }) => {
      const post = await create(api, 'Lifecycle');
      await page.goto(`${localD1.origin}/admin/posts/${post.id}`);
      await page.getByRole('button', { name: '발행', exact: true }).click();
      await expect(
        page.getByRole('button', { name: '발행', exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: '공개 취소', exact: true }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: '공개 취소', exact: true })
        .click();
      await page.getByRole('button', { name: '재발행', exact: true }).click();
      page.once('dialog', dialog => dialog.dismiss());
      await page.getByRole('button', { name: '삭제', exact: true }).click();
      await expect(
        page.getByRole('button', { name: '공개 취소', exact: true }),
      ).toBeVisible();
      page.once('dialog', async dialog => {
        expect(dialog.message()).toContain('공개');
        await dialog.accept();
      });
      await page.getByRole('button', { name: '삭제', exact: true }).click();
      await expect(
        page.getByRole('button', { name: '복구', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: '수정', exact: true }),
      ).toHaveCount(0);
      await expect(page.locator('.admin-reading .ProseMirror')).toContainText(
        'Saved body',
      );
      page.once('dialog', async dialog => {
        expect(dialog.message()).toContain('공개');
        await dialog.dismiss();
      });
      await page.getByRole('button', { name: '복구', exact: true }).click();
      await expect(
        page.getByRole('button', { name: '복구', exact: true }),
      ).toBeVisible();
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: '복구', exact: true }).click();
      await expect(
        page.getByRole('button', { name: '공개 취소', exact: true }),
      ).toBeVisible();
    });

    test('last-item deletion and restoration correct shrinking pages without losing scope or limit', async ({
      api,
      localD1,
      page,
    }) => {
      for (let index = 0; index < 3; index++)
        await create(api, `Shrink ${index}`);
      await page.goto(
        `${localD1.origin}/admin/posts?status=draft&page=2&limit=2`,
      );
      await page.getByRole('button', { name: /작업 메뉴/ }).press('Enter');
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: '삭제', exact: true }).click();
      await expect(page).toHaveURL(
        `${localD1.origin}/admin/posts?status=draft&page=1&limit=2`,
      );
      const remaining = await (await api.get('/api/admin/posts')).json();
      for (const post of remaining.items)
        await api.delete(`/api/admin/posts/${post.id}`, {
          data: { expected_revision: post.revision },
        });
      await page.goto(`${localD1.origin}/admin/posts/trash?page=2&limit=2`);
      await page.getByRole('button', { name: /작업 메뉴/ }).click();
      await page.getByRole('button', { name: '복구', exact: true }).click();
      await expect(page).toHaveURL(
        `${localD1.origin}/admin/posts/trash?page=1&limit=2`,
      );
      await page
        .getByRole('button', { name: /작업 메뉴/ })
        .first()
        .click();
      await page.getByRole('button', { name: '복구', exact: true }).click();
      await expect(page.getByRole('button', { name: /작업 메뉴/ })).toHaveCount(
        1,
      );
      await page.getByRole('button', { name: /작업 메뉴/ }).click();
      await page.getByRole('button', { name: '복구', exact: true }).click();
      await expect(page.getByText('휴지통이 비어 있습니다.')).toBeVisible();
      await expect(
        page.getByRole('navigation', { name: '페이지' }),
      ).toHaveCount(0);
    });

    test('lifecycle conflict refreshes current state without replaying the action', async ({
      api,
      localD1,
      page,
    }) => {
      const post = await create(api, 'Concurrent');
      await page.goto(`${localD1.origin}/admin/posts/${post.id}`);
      await expect(
        page.getByRole('button', { name: '발행', exact: true }),
      ).toBeVisible();
      await api.patch(`/api/admin/posts/${post.id}`, {
        data: { title: 'Changed elsewhere', expected_revision: 1 },
      });
      await page.getByRole('button', { name: '발행', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: 'Changed elsewhere', exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('status')).toContainText('다른 화면');
      expect(
        await (await api.get(`/api/admin/posts/${post.id}`)).json(),
      ).toMatchObject({ status: 'draft', revision: 2 });
    });

    test('pending lifecycle controls stay locked and unknown outcomes require a new explicit choice', async ({
      api,
      localD1,
      page,
    }) => {
      const post = await create(api, 'Unknown outcome');
      await page.goto(`${localD1.origin}/admin/posts/${post.id}`);
      let attempts = 0;
      let release!: () => void;
      const pending = new Promise<void>(resolve => {
        release = resolve;
      });
      await page.route('**/api/admin/posts/*/publish', async route => {
        attempts++;
        await pending;
        await route.fulfill({ status: 503, body: 'Unavailable' });
      });
      await page.getByRole('button', { name: '발행', exact: true }).click();
      await expect(
        page.getByRole('button', { name: '발행', exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole('button', { name: '삭제', exact: true }),
      ).toBeDisabled();
      release();
      await expect(page.getByRole('status')).toContainText(
        '확인할 수 없습니다',
      );
      await expect(
        page.getByRole('button', { name: '발행', exact: true }),
      ).toBeEnabled();
      expect(attempts).toBe(2);
      expect(
        await (await api.get(`/api/admin/posts/${post.id}`)).json(),
      ).toMatchObject({ status: 'draft', revision: 1 });
    });

    test('responsive mutation locks survive presentation changes and block navigation until settlement', async ({
      api,
      localD1,
      page,
    }) => {
      const post = await create(api, 'Responsive request');
      await page.goto(`${localD1.origin}/admin/posts`);
      let release!: () => void;
      const pending = new Promise<void>(resolve => {
        release = resolve;
      });
      await page.route('**/api/admin/posts/*/publish', async route => {
        await pending;
        await route.continue();
      });
      await page.getByRole('button', { name: /작업 메뉴/ }).click();
      await page.getByRole('button', { name: '발행', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('처리 중');
      await page.setViewportSize({
        width: viewport.width === 390 ? 1280 : 390,
        height: 900,
      });
      await page.getByRole('button', { name: /작업 메뉴/ }).click();
      await expect(
        page.getByRole('button', { name: '발행', exact: true }),
      ).toBeDisabled();
      await page.getByRole('link', { name: '휴지통', exact: true }).click();
      await expect(page).toHaveURL(`${localD1.origin}/admin/posts`);
      release();
      await expect(page).toHaveURL(`${localD1.origin}/admin/posts/${post.id}`);
      expect(
        await (await api.get(`/api/admin/posts/${post.id}`)).json(),
      ).toMatchObject({ status: 'published', revision: 2 });
      await page.getByRole('link', { name: '목록', exact: true }).click();
      await page.getByRole('link', { name: '휴지통', exact: true }).click();
      await expect(page).toHaveURL(`${localD1.origin}/admin/posts/trash`);
    });

    test('removed row retains rejection feedback and post identity in the list', async ({
      api,
      localD1,
      page,
    }) => {
      const post = await create(api, 'Removed elsewhere');
      await page.goto(`${localD1.origin}/admin/posts?status=draft`);
      await api.delete(`/api/admin/posts/${post.id}`, {
        data: { expected_revision: 1 },
      });
      await page.getByRole('button', { name: /작업 메뉴/ }).click();
      await page.getByRole('button', { name: '발행', exact: true }).click();
      await expect(page.getByText('게시글이 없습니다.')).toBeVisible();
      await expect(page.getByRole('status')).toContainText('Removed elsewhere');
      await expect(page.getByRole('status')).toContainText(
        '변경하지 못했습니다',
      );
    });

    test('a reordered row retains version conflict feedback outside the refreshed page', async ({
      api,
      localD1,
      page,
    }) => {
      const post = await create(api, 'Moved elsewhere');
      await create(api, 'Other row');
      await page.goto(
        `${localD1.origin}/admin/posts?status=draft&page=2&limit=1`,
      );
      await api.patch(`/api/admin/posts/${post.id}`, {
        data: { title: 'Moved to first page', expected_revision: 1 },
      });
      await page.getByRole('button', { name: /작업 메뉴/ }).click();
      await page.getByRole('button', { name: '발행', exact: true }).click();
      await expect(
        page.getByRole('link', { name: 'Other row', exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('status')).toContainText('Moved elsewhere');
      await expect(page.getByRole('status')).toContainText('다른 화면');
      expect(
        await (await api.get(`/api/admin/posts/${post.id}`)).json(),
      ).toMatchObject({ status: 'draft', revision: 2 });
    });

    test('observed recovery reflects persisted state without a separate notification', async ({
      api,
      localD1,
      page,
    }) => {
      const post = await create(api, 'Observed request');
      await page.goto(`${localD1.origin}/admin/posts/${post.id}`);
      let attempts = 0;
      await page.route('**/api/admin/posts/*/publish', async route => {
        if (++attempts === 1) await route.fetch();
        await route.abort('failed');
      });
      await page.getByRole('button', { name: '발행', exact: true }).click();
      await expect(
        page.getByRole('button', { name: '공개 취소', exact: true }),
      ).toBeEnabled();
      await expect(page.getByRole('status')).toHaveCount(0);
      expect(attempts).toBe(2);
      expect(
        await (await api.get(`/api/admin/posts/${post.id}`)).json(),
      ).toMatchObject({ status: 'published', revision: 2 });
    });
  });
}

test('page loaders reject invalid scopes and IDs and missing posts without exposing database errors', async ({
  api,
}) => {
  for (const path of [
    '/admin/posts?status=unknown',
    '/admin/posts?page=0',
    '/admin/posts?limit=2&limit=3',
    '/admin/posts/trash?status=draft',
    '/admin/posts/not-an-id',
  ]) {
    const response = await api.get(path);
    expect(response.status()).toBe(400);
    expect(response.headers()['cache-control']).toBe('no-store');
  }
  expect(
    (
      await api.get('/admin/posts/01900000-0000-7000-8000-000000000001')
    ).status(),
  ).toBe(404);
});

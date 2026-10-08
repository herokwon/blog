import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { test } from '../../../tests/admin/local-d1';

test.beforeEach(async ({ localD1 }) => {
  await localD1.db.prepare('DELETE FROM posts').run();
});

for (const scope of ['normal', 'trash'] as const) {
  test(`${scope} numbered navigation crosses five-page groups and retains filter and limit`, async ({
    page,
    localD1,
    api,
  }) => {
    await page.setExtraHTTPHeaders({
      'Cf-Access-Jwt-Assertion': await localD1.token(),
    });
    for (let index = 0; index < 12; index++) {
      const response = await api.post('/api/admin/posts', {
        data: { title: `Page ${index}`, body: 'Body' },
      });
      expect(response.status()).toBe(201);
    }
    if (scope === 'trash')
      await localD1.db
        .prepare("UPDATE posts SET deleted_at = '2026-10-08T00:00:00.000Z'")
        .run();
    const path = scope === 'trash' ? '/admin/posts/trash' : '/admin/posts';
    const filter = scope === 'normal' ? 'status=draft&' : '';
    await page.setViewportSize({
      width: scope === 'normal' ? 1280 : 390,
      height: 900,
    });
    await page.goto(`${localD1.origin}${path}?${filter}page=1&limit=1`);
    const nav = page.getByRole('navigation', { name: '페이지' });
    await expect(
      nav.getByRole('button', { name: '이전 페이지' }),
    ).toBeDisabled();
    await expect(nav.locator('.page-numbers a')).toHaveText([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
    await nav.getByRole('link', { name: '5 페이지', exact: true }).click();
    await expect(page).toHaveURL(
      `${localD1.origin}${path}?${filter}page=5&limit=1`,
    );
    await nav.getByRole('link', { name: '다음 페이지' }).click();
    await expect(nav.locator('.page-numbers a')).toHaveText([
      '6',
      '7',
      '8',
      '9',
      '10',
    ]);
    await expect(page).toHaveURL(
      `${localD1.origin}${path}?${filter}page=6&limit=1`,
    );
    await nav.getByRole('link', { name: '이전 페이지' }).click();
    await expect(nav.locator('.page-numbers a')).toHaveText([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
    await nav.getByRole('link', { name: '다음 페이지' }).click();
    await nav.getByRole('link', { name: '10 페이지', exact: true }).click();
    await nav.getByRole('link', { name: '다음 페이지' }).click();
    await expect(nav.locator('.page-numbers a')).toHaveText(['11', '12']);
    const group = await nav.locator('.page-numbers').boundingBox();
    const first = await nav
      .getByRole('link', { name: '11 페이지', exact: true })
      .boundingBox();
    expect(first!.x).toBeCloseTo(group!.x, 0);
    expect(group!.width).toBeGreaterThan(first!.width * 2);
    await expect(page).toHaveURL(
      `${localD1.origin}${path}?${filter}page=11&limit=1`,
    );
    await nav.getByRole('link', { name: '이전 페이지' }).click();
    await expect(nav.locator('.page-numbers a')).toHaveText([
      '6',
      '7',
      '8',
      '9',
      '10',
    ]);
    await nav.getByRole('link', { name: '다음 페이지' }).click();
    await nav.getByRole('link', { name: '12 페이지', exact: true }).click();
    await expect(
      nav.getByRole('button', { name: '다음 페이지' }),
    ).toBeDisabled();
    await expect(nav.locator('.page-numbers a')).toHaveText(['11', '12']);
    await expect(nav.getByRole('link')).toHaveCount(3);
  });
}

test('new-post recovery survives a real browser restart without applying or submitting input', async ({
  localD1,
  api,
}) => {
  const directory = await mkdtemp(join(tmpdir(), 'blog-recovery-acceptance-'));
  const headers = { 'Cf-Access-Jwt-Assertion': await localD1.token() };
  const launch = () =>
    chromium.launchPersistentContext(directory, {
      headless: true,
      extraHTTPHeaders: headers,
    });
  let context = await launch();
  try {
    let page = await context.newPage();
    await page.goto(`${localD1.origin}/admin/posts/new`);
    await page.getByLabel('제목', { exact: true }).fill('Restarted input');
    await page.locator('.ProseMirror').fill('Unsubmitted Markdown');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(
              localStorage.getItem('blog:admin:new-post-recovery:v1') ?? 'null',
            )?.body,
        ),
      )
      .toBe('Unsubmitted Markdown\n');
    const before = await page.evaluate(() =>
      localStorage.getItem('blog:admin:new-post-recovery:v1'),
    );
    const count = (await (await api.get('/api/admin/posts')).json()).totalItems;
    expect(count).toBe(0);
    await context.close();
    context = await launch();
    page = await context.newPage();
    await page.goto(`${localD1.origin}/admin/posts/new`);
    await expect(page.getByText('미저장 작성 내용이 있습니다')).toBeVisible();
    await expect(page.getByLabel('제목', { exact: true })).toHaveValue('');
    await expect(page.locator('.ProseMirror')).toHaveText('');
    await page.getByRole('button', { name: '복구', exact: true }).click();
    await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
      'Restarted input',
    );
    await expect(page.locator('.ProseMirror')).toContainText(
      'Unsubmitted Markdown',
    );
    expect(
      await page.evaluate(() =>
        localStorage.getItem('blog:admin:new-post-recovery:v1'),
      ),
    ).toBe(before);
    expect((await (await api.get('/api/admin/posts')).json()).totalItems).toBe(
      count,
    );
  } finally {
    await context.close();
    // Only the uniquely created test profile is disposable.
    await rm(directory, { recursive: true, force: true });
  }
});

test.describe('390px touch acceptance', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('touch opens formatting and language controls and cancels unsaved navigation', async ({
    page,
    localD1,
    api,
  }) => {
    await page.setExtraHTTPHeaders({
      'Cf-Access-Jwt-Assertion': await localD1.token(),
    });
    const post = await (
      await api.post('/api/admin/posts', {
        data: {
          title: 'Touch acceptance',
          body: 'Paragraph\n\n```unknown-code\nconst value = 42;\n```',
        },
      })
    ).json();
    await page.goto(`${localD1.origin}/admin/posts/${post.id}/edit`);
    await expect(page.locator('.cm-content')).toHaveAttribute(
      'contenteditable',
      'true',
    );
    await page.locator('.ProseMirror > p').first().tap();
    await page.getByRole('button', { name: 'Paragraph', exact: true }).tap();
    await page.getByRole('button', { name: 'Heading 2', exact: true }).tap();
    await expect(page.locator('.ProseMirror h2')).toHaveText('Paragraph');
    await page.getByRole('button', { name: 'unknown-code', exact: true }).tap();
    await page.getByPlaceholder('Search language').fill('TypeScript');
    await page.getByText('TypeScript', { exact: true }).tap();
    await expect(page.locator('.cm-line span[class]').first()).toBeVisible();
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('link', { name: '목록', exact: true }).tap();
    await expect(page).toHaveURL(
      `${localD1.origin}/admin/posts/${post.id}/edit`,
    );
    await expect(page.locator('.ProseMirror h2')).toHaveText('Paragraph');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
});

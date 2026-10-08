import type { AdminPost } from '$lib/admin/contracts';
import { writeFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from '../../../tests/admin/local-d1';

test.beforeEach(async ({ localD1, page }) => {
  await localD1.db.prepare('DELETE FROM posts').run();
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
});
for (const width of [1280, 390]) {
  test.describe(`${width}px editor security`, () => {
    test.use({ viewport: { width, height: 900 } });
    test('enforced CSP supports heading, language, table and safe-link menus on initial load and client remount', async ({
      page,
      api,
      localD1,
    }) => {
      const body =
        'Paragraph\n\n[Safe link](https://example.com)\n\n| A | B |\n| --- | --- |\n| a | b |\n\n```unknown-code\nconst value = 42;\n```';
      const post = (await (
        await api.post('/api/admin/posts', {
          data: { title: 'Security', body },
        })
      ).json()) as AdminPost;
      const errors: string[] = [];
      page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(
        `${localD1.origin}/admin/posts/${post.id}/edit`,
      );
      const csp = response!.headers()['content-security-policy'];
      expect(csp).toContain("style-src-attr 'none'");
      expect(csp).toContain("img-src 'none'");
      await expect(page.locator('.cm-content')).toHaveAttribute(
        'contenteditable',
        'true',
      );
      const nonce = await page
        .locator('meta[name="admin-style-nonce"]')
        .getAttribute('content');
      expect(
        await page
          .locator('style')
          .evaluateAll(elements =>
            elements
              .filter(e =>
                [...((e as HTMLStyleElement).sheet?.cssRules ?? [])].some(
                  rule => rule.cssText.includes('.cm-content'),
                ),
              )
              .map(e => (e as HTMLStyleElement).nonce),
          ),
      ).toContain(nonce);
      await page
        .getByRole('button', { name: 'unknown-code', exact: true })
        .click();
      await page.getByPlaceholder('Search language').fill('TypeScript');
      await page.getByText('TypeScript', { exact: true }).click();
      await expect(page.locator('.cm-line span[class]').first()).toBeVisible();
      await expect(page.locator('.cm-content')).toContainText(
        'const value = 42;',
      );
      await page.locator('.ProseMirror > p').first().click();
      await page
        .getByRole('button', { name: 'Paragraph', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Heading 2', exact: true })
        .click();
      await expect(page.locator('.ProseMirror h2')).toHaveText('Paragraph');
      await page.locator('.ProseMirror table.children td p').first().click();
      await page.keyboard.type('edited');
      await expect(page.locator('.ProseMirror table.children')).toContainText(
        'edited',
      );
      await page.locator('.ProseMirror a[href="https://example.com"]').click();
      await expect(page.locator('.milkdown-link-preview')).toBeVisible();
      await page.keyboard.press('Escape');
      await page.locator('.ProseMirror').evaluate(element => {
        const transfer = new DataTransfer();
        transfer.setData(
          'text/html',
          '<p><a href="javascript:alert(1)">Unsafe</a><img src=x></p>',
        );
        element.dispatchEvent(
          new ClipboardEvent('paste', {
            clipboardData: transfer,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      await expect(page.locator('.admin-editor [role="alert"]')).toContainText(
        '지원하지 않는',
      );
      await expect(
        page.locator('.admin-editor img, .admin-editor a[href^="javascript:"]'),
      ).toHaveCount(0);
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page).toHaveURL(`${localD1.origin}/admin/posts/${post.id}`);
      await page.getByRole('link', { name: '수정', exact: true }).click();
      await expect(page.locator('.cm-content')).toHaveAttribute(
        'contenteditable',
        'true',
      );
      expect(
        await page
          .locator('style')
          .evaluateAll(elements =>
            elements
              .filter(e =>
                [...((e as HTMLStyleElement).sheet?.cssRules ?? [])].some(
                  rule => rule.cssText.includes('.cm-content'),
                ),
              )
              .map(e => (e as HTMLStyleElement).nonce),
          ),
      ).toContain(nonce);
      expect(
        errors.filter(
          value =>
            !value.includes(
              'sha256-S8qMpvofolR8Mpjy4kQvEm7m1q8clzU4dfDH0AmvZjo=',
            ),
        ),
      ).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 390) {
        const heading = await page.locator('.ProseMirror h2').boundingBox();
        expect(heading!.width).toBeGreaterThan(250);
      }
      await page.screenshot({
        path: `.superpowers/sdd/v0.2.0-implementation/task10-editor-${width}.png`,
        fullPage: true,
      });
    });
    test('locks title, formatting, nested code and navigation through automatic retry and recovery read, observes silently', async ({
      page,
      api,
      localD1,
    }) => {
      const post = (await (
        await api.post('/api/admin/posts', {
          data: {
            title: 'Pending',
            body: 'Paragraph\n\n```typescript\nconst value = 1;\n```',
          },
        })
      ).json()) as AdminPost;
      await page.goto(`${localD1.origin}/admin/posts/${post.id}/edit`);
      await expect(page.locator('.cm-content')).toHaveAttribute(
        'contenteditable',
        'true',
      );
      await page.getByLabel('제목', { exact: true }).fill('Changed');
      let writes = 0;
      let release!: () => void;
      const hold = new Promise<void>(resolve => {
        release = resolve;
      });
      await page.route(`**/api/admin/posts/${post.id}`, async route => {
        if (route.request().method() === 'PATCH') {
          writes++;
          if (writes === 1) {
            await route.fetch();
            await route.fulfill({ status: 503 });
          } else await route.fulfill({ status: 503 });
        } else {
          await hold;
          await route.continue();
        }
      });
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect.poll(() => writes).toBe(2);
      await expect(page.getByLabel('제목', { exact: true })).toBeDisabled();
      await expect(
        page.getByRole('button', { name: '저장', exact: true }),
      ).toBeDisabled();
      await expect(page.locator('.ProseMirror')).toHaveAttribute(
        'contenteditable',
        'false',
      );
      await expect(page.locator('.cm-content')).toHaveAttribute(
        'contenteditable',
        'false',
      );
      await page.getByRole('link', { name: '목록', exact: true }).click();
      await expect(page).toHaveURL(
        `${localD1.origin}/admin/posts/${post.id}/edit`,
      );
      release();
      await expect(page.getByLabel('제목', { exact: true })).toBeEnabled();
      await expect(page.locator('.cm-content')).toHaveAttribute(
        'contenteditable',
        'true',
      );
      await expect(page.locator('.post-form [role="status"]')).toHaveCount(0);
      await expect(page).toHaveURL(
        `${localD1.origin}/admin/posts/${post.id}/edit`,
      );
      expect(writes).toBe(2);
    });
    test('long-post input records debounced Markdown within bounded wait without server autosave', async ({
      page,
      api,
      localD1,
    }, testInfo) => {
      await page.goto(`${localD1.origin}/admin/posts/new`);
      await page.getByLabel('제목', { exact: true }).fill('Long post');
      const editor = page.locator('.admin-editor .ProseMirror');
      await expect(editor).toHaveAttribute('contenteditable', 'true');
      const longBody =
        'Representative paragraph with Unicode 한글 and long-post input. '.repeat(
          1500,
        );
      const started = Date.now();
      await editor.fill(longBody);
      await expect
        .poll(
          () =>
            page.evaluate(() =>
              localStorage.getItem('blog:admin:new-post-recovery:v1'),
            ),
          { timeout: 6000 },
        )
        .toContain('Representative paragraph');
      const recordingMs = Date.now() - started;
      const timings = await page.evaluate(() => {
        const raw = localStorage.getItem('blog:admin:new-post-recovery:v1')!;
        const begin = performance.now();
        for (let i = 0; i < 10; i++) JSON.stringify(JSON.parse(raw));
        const serializedMs = (performance.now() - begin) / 10;
        const writing = performance.now();
        for (let i = 0; i < 10; i++) localStorage.setItem('measurement', raw);
        localStorage.removeItem('measurement');
        return {
          bytes: raw.length,
          serializedMs,
          storageMs: (performance.now() - writing) / 10,
        };
      });
      await testInfo.attach('recording-measurement', {
        body: JSON.stringify({ width, recordingMs, ...timings }),
        contentType: 'application/json',
      });
      await writeFile(
        `.superpowers/sdd/v0.2.0-implementation/task10-measure-${width}.json`,
        JSON.stringify({ width, recordingMs, ...timings }, null, 2) + '\n',
      );
      expect(timings.bytes).toBeGreaterThan(90000);
      expect(
        (await (await api.get('/api/admin/posts')).json()).items,
      ).toHaveLength(0);
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('link', { name: '로그아웃', exact: true }).click();
      await expect(page).toHaveURL(`${localD1.origin}/cdn-cgi/access/logout`);
      await expect
        .poll(() =>
          page.evaluate(() =>
            localStorage.getItem('blog:admin:new-post-recovery:v1'),
          ),
        )
        .toBeNull();
    });
  });
}

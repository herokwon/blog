import { expect } from '@playwright/test';
import type { AdminPost } from '#lib/admin/contracts.ts';
import { test } from '../../../tests/admin/local-d1';

test.beforeEach(async ({ localD1, page }) => {
  await localD1.db.prepare('DELETE FROM posts').run();
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
});

for (const width of [1280, 390]) {
  test.describe(`${width}px authoring layout`, () => {
    test.use({ viewport: { width, height: 900 } });
    for (const route of ['new', 'edit']) {
      test(`${route} uses a unified frame, title-to-toolbar keyboard flow and body-only scrolling`, async ({
        page,
        api,
        localD1,
      }) => {
        const body = Array.from(
          { length: 60 },
          (_, i) => `Paragraph ${i} with text.`,
        ).join('\n\n');
        const post = (await (
          await api.post('/api/admin/posts', {
            data: { title: 'Layout', body },
          })
        ).json()) as AdminPost;
        await page.goto(
          `${localD1.origin}/admin/posts/${route === 'new' ? 'new' : `${post.id}/edit`}`,
        );
        const title = page.getByRole('textbox', { name: '제목', exact: true });
        const editor = page.locator('.admin-editor .ProseMirror');
        await expect(editor).toHaveAttribute('contenteditable', 'true');
        await expect(title).toHaveAttribute('placeholder', '제목');
        expect(
          await title.evaluate(el => ({
            size: getComputedStyle(el).fontSize,
            padding: getComputedStyle(el).padding,
          })),
        ).toEqual({ size: '16px', padding: '12px' });
        const toolbar = page.locator('.milkdown-top-bar');
        expect(
          await page.locator('.admin-editor .milkdown').evaluate(el => ({
            border: getComputedStyle(el).borderTopWidth,
            radius: getComputedStyle(el).borderTopLeftRadius,
          })),
        ).toEqual({ border: '1px', radius: '6px' });
        expect(
          await toolbar.evaluate(el => getComputedStyle(el).borderBottomWidth),
        ).toBe('1px');
        const buttons = toolbar.locator('button');
        await title.focus();
        for (const button of await buttons.all()) {
          await page.keyboard.press('Tab');
          await expect(button).toBeFocused();
        }
        await page.keyboard.press('Tab');
        await expect(editor).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(buttons.last()).toBeFocused();
        for (let i = (await buttons.count()) - 1; i > 0; i--)
          await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Shift+Tab');
        await expect(title).toBeFocused();
        if (route === 'new') await editor.fill(body);
        for (const height of [900, 520, 360]) {
          await page.setViewportSize({ width, height });
          const before = await toolbar.boundingBox();
          await editor.evaluate(el => {
            el.scrollTop = el.scrollHeight;
          });
          await expect
            .poll(() => editor.evaluate(el => el.scrollTop))
            .toBeGreaterThan(0);
          const after = await toolbar.boundingBox();
          expect(after!.y).toBeCloseTo(before!.y, 0);
          expect(
            await editor.evaluate(el => ({
              padding: getComputedStyle(el).padding,
              overflow: getComputedStyle(el).overflowY,
            })),
          ).toEqual({ padding: '12px', overflow: 'auto' });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await expect(title).toBeVisible();
          await expect(
            page.getByRole('button', { name: '저장', exact: true }),
          ).toBeVisible();
          const save = page.getByRole('button', { name: '저장', exact: true });
          await save.scrollIntoViewIfNeeded();
          const saveBox = await save.boundingBox();
          expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(height);
        }
      });
    }
    test('built Worker records CSP operations and retains the editor across locks and remounts', async ({
      page,
      api,
      localD1,
    }, testInfo) => {
      const errors: string[] = [];
      page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        const events: unknown[] = [];
        Object.assign(window, { task54Csp: events });
        document.addEventListener('securitypolicyviolation', event => {
          events.push({
            directive: event.effectiveDirective,
            blocked: event.blockedURI,
            sample: event.sample,
            source: event.sourceFile,
            line: event.lineNumber,
          });
        });
      });
      const post = (await (
        await api.post('/api/admin/posts', {
          data: {
            title: 'CSP',
            body: 'Paragraph\n\n```typescript\nconst answer = 42;\n```',
          },
        })
      ).json()) as AdminPost;
      const response = await page.goto(
        `${localD1.origin}/admin/posts/${post.id}/edit`,
      );
      expect(response!.headers()['content-security-policy']).toContain(
        "style-src-attr 'none'",
      );
      await expect(page.locator('.cm-content')).toHaveAttribute(
        'contenteditable',
        'true',
      );
      const samples = [];
      samples.push({
        action: 'load',
        toolbarStyle: await page
          .locator('.milkdown-top-bar')
          .getAttribute('style'),
      });
      await page.getByLabel('제목', { exact: true }).fill('Changed');
      let release!: () => void;
      const hold = new Promise<void>(resolve => {
        release = resolve;
      });
      await page.route(`**/api/admin/posts/${post.id}`, async route => {
        await hold;
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'VALIDATION_ERROR', message: 'test hold' },
          }),
        });
      });
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page.locator('.ProseMirror')).toHaveAttribute(
        'contenteditable',
        'false',
      );
      samples.push({
        action: 'pending',
        toolbarStyle: await page
          .locator('.milkdown-top-bar')
          .getAttribute('style'),
      });
      await expect(page.locator('.ProseMirror')).toBeVisible();
      release();
      await expect(page.locator('.ProseMirror')).toHaveAttribute(
        'contenteditable',
        'true',
      );
      samples.push({
        action: 'unlocked',
        toolbarStyle: await page
          .locator('.milkdown-top-bar')
          .getAttribute('style'),
      });
      await expect(
        page.getByRole('button', { name: 'Paragraph', exact: true }),
      ).toBeVisible();
      await page.unroute(`**/api/admin/posts/${post.id}`);
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page).toHaveURL(`${localD1.origin}/admin/posts/${post.id}`);
      await page.getByRole('link', { name: '수정', exact: true }).click();
      await expect(page.locator('.cm-content')).toHaveAttribute(
        'contenteditable',
        'true',
      );
      const heading = page.getByRole('button', {
        name: 'Paragraph',
        exact: true,
      });
      await heading.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.top-bar-heading-dropdown')).toBeVisible();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Escape');
      await expect(page.locator('.top-bar-heading-dropdown')).toHaveCount(0);
      await expect(heading).toBeFocused();
      const violations = await page.evaluate(
        () => (window as unknown as { task54Csp: unknown[] }).task54Csp,
      );
      const toolbar = await page.locator('.milkdown-top-bar').evaluate(el => ({
        buttons: el.querySelectorAll('button').length,
        display: getComputedStyle(el).display,
      }));
      await testInfo.attach('csp-operations', {
        body: JSON.stringify({ samples, violations, errors, toolbar }, null, 2),
        contentType: 'application/json',
      });
      expect(violations).toEqual([]);
      await expect(
        page.getByRole('button', { name: 'Paragraph', exact: true }),
      ).toBeVisible();
      // The deliberately rejected request has its own expected transport error.
      expect(
        errors.filter(
          error =>
            error !==
            'Failed to load resource: the server responded with a status of 400 (Bad Request)',
        ),
      ).toEqual([]);
    });
    test('recovery keeps the body mounted and restores toolbar focus without CSP errors', async ({
      page,
      localD1,
    }) => {
      const errors: string[] = [];
      page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        Object.assign(window, { task54Csp: [] });
        document.addEventListener('securitypolicyviolation', event => {
          (window as unknown as { task54Csp: string[] }).task54Csp.push(
            event.effectiveDirective,
          );
        });
      });
      await page.goto(`${localD1.origin}/admin/posts/new`);
      await expect(page.getByLabel('제목', { exact: true })).toBeEnabled();
      await page.evaluate(() =>
        localStorage.setItem(
          'blog:admin:new-post-recovery:v1',
          JSON.stringify({
            title: 'Recovered',
            body: 'Recovered body',
            editedAt: Date.now(),
          }),
        ),
      );
      await page.reload();
      const dialog = page.getByRole('dialog', {
        name: '미저장 작성 내용이 있습니다',
      });
      await expect(dialog).toBeVisible();
      const editor = page.locator('.admin-editor .ProseMirror');
      await expect(editor).toBeVisible();
      await expect(editor).toHaveAttribute('contenteditable', 'false');
      await editor.evaluate(el =>
        el.setAttribute('data-mounted-probe', 'true'),
      );
      await dialog.getByText('Recovered', { exact: true }).click();
      await expect(editor).toHaveAttribute('data-mounted-probe', 'true');
      await dialog.getByRole('button', { name: '확인', exact: true }).click();
      await expect(editor).toHaveAttribute('contenteditable', 'true');
      await expect(editor).toContainText('Recovered body');
      await expect(page.getByLabel('제목', { exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('button', { name: 'Paragraph', exact: true }),
      ).toBeFocused();
      expect(
        await page.evaluate(
          () => (window as unknown as { task54Csp: string[] }).task54Csp,
        ),
      ).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

import { expect } from '@playwright/test';
import type { AdminPost } from '#lib/admin/contracts.ts';
import { test } from '../../../tests/admin/local-d1';

test.beforeEach(async ({ page, localD1 }) => {
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
});

for (const width of [1280, 390]) {
  for (const mode of ['new', 'edit']) {
    test(`${mode} ${width}px field errors guide correction without losing input`, async ({
      page,
      api,
      localD1,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const post =
        mode === 'edit'
          ? ((await (
              await api.post('/api/admin/posts', {
                data: { title: `Validation ${width}`, body: 'Original body' },
              })
            ).json()) as AdminPost)
          : null;
      await page.goto(
        `${localD1.origin}/admin/posts/${post ? `${post.id}/edit` : 'new'}`,
      );
      const title = page.getByRole('textbox', { name: '제목', exact: true });
      const editor = page.locator('.admin-editor .ProseMirror');
      await expect(editor).toHaveAttribute('contenteditable', 'true');
      await title.fill(' ');
      await editor.fill('');
      await title.focus();
      await page.keyboard.press('Tab');
      await expect(
        page.getByText('제목을 입력하세요.', { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText('본문을 입력하세요.', { exact: true }),
      ).toHaveCount(0);
      let dialogs = 0;
      let mutations = 0;
      page.on('dialog', async dialog => {
        dialogs++;
        await dialog.dismiss();
      });
      page.on('request', request => {
        if (
          request.url().includes('/api/admin/posts') &&
          request.method() !== 'GET'
        )
          mutations++;
      });
      const save = page.getByRole('button', {
        name: post ? '저장' : '초안 생성',
        exact: true,
      });
      await save.click();
      await expect(title).toBeFocused();
      await expect(title).toHaveAttribute('aria-invalid', 'true');
      await expect(editor).toHaveAttribute('aria-invalid', 'true');
      await expect(title).toHaveAccessibleDescription('제목을 입력하세요.');
      await expect(editor).toHaveAccessibleDescription('본문을 입력하세요.');
      await expect(title).toHaveCSS('outline-color', 'rgb(185, 28, 28)');
      await expect(title).toHaveCSS('border-top-color', 'rgb(185, 28, 28)');
      await expect(page.locator('.admin-editor .milkdown')).toHaveCSS(
        'border-top-color',
        'rgb(185, 28, 28)',
      );
      await page.keyboard.press('Tab');
      await expect(
        page.locator('.milkdown-top-bar button').first(),
      ).toBeFocused();
      await expect(page.locator('.milkdown-top-bar button').first()).toHaveCSS(
        'outline-color',
        'rgb(37, 99, 235)',
      );
      await expect(title).toHaveCSS('border-top-color', 'rgb(185, 28, 28)');
      await save.click();
      await expect(title).toBeFocused();
      await page.screenshot({
        path: `.wrangler/issue-81/${mode}-${width}-errors.png`,
        fullPage: true,
      });
      await title.fill('Corrected title');
      await expect(title).not.toHaveAttribute('aria-invalid', 'true');
      await expect(title).toBeFocused();
      await expect(title).toHaveCSS('outline-color', 'rgb(37, 99, 235)');
      await expect(
        page.getByText('제목을 입력하세요.', { exact: true }),
      ).toHaveCount(0);
      await save.click();
      await expect(editor).toBeFocused();
      await expect(editor).toHaveCSS('outline-color', 'rgb(185, 28, 28)');
      await expect(title).toHaveValue('Corrected title');
      await page.screenshot({
        path: `.wrangler/issue-81/${mode}-${width}-body-focus.png`,
        fullPage: true,
      });
      await page.keyboard.type('Corrected body');
      await expect(editor).not.toHaveAttribute('aria-invalid', 'true');
      await expect(editor).toBeFocused();
      await expect(
        page.getByText('본문을 입력하세요.', { exact: true }),
      ).toHaveCount(0);
      await expect(editor).toHaveCSS('outline-color', 'rgb(37, 99, 235)');
      expect(
        await editor.evaluate(el => {
          const selection = window.getSelection()!;
          return (
            el.contains(selection.anchorNode) &&
            selection.anchorOffset === 'Corrected body'.length
          );
        }),
      ).toBe(true);
      await title.fill('');
      await save.click();
      await expect(title).toBeFocused();
      await expect(editor).not.toHaveAttribute('aria-invalid', 'true');
      await expect(editor).toContainText('Corrected body');
      expect(dialogs).toBe(0);
      expect(mutations).toBe(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await title.fill('Ready');
      await save.click();
      expect(dialogs).toBe(1);
      expect(mutations).toBe(0);
    });
  }
}

test('immediate publish validates before confirmation', async ({
  page,
  localD1,
}) => {
  await page.goto(`${localD1.origin}/admin/posts/new`);
  const title = page.getByRole('textbox', { name: '제목', exact: true });
  const editor = page.locator('.admin-editor .ProseMirror');
  await expect(editor).toHaveAttribute('contenteditable', 'true');
  let dialogs = 0;
  page.on('dialog', async dialog => {
    dialogs++;
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: '발행', exact: true }).click();
  await expect(title).toBeFocused();
  await expect(editor).toHaveAttribute('aria-invalid', 'true');
  expect(dialogs).toBe(0);
  await title.fill('Rule retained');
  await editor.fill('Publish body');
  await page.getByRole('button', { name: '발행', exact: true }).click();
  expect(dialogs).toBe(1);
});

test('a persisted horizontal rule remains valid without requiring prose', async ({
  page,
  api,
  localD1,
}) => {
  const post = (await (
    await api.post('/api/admin/posts', {
      data: { title: 'Markdown rule', body: '---\n' },
    })
  ).json()) as AdminPost;
  await page.goto(`${localD1.origin}/admin/posts/${post.id}/edit`);
  const title = page.getByRole('textbox', { name: '제목', exact: true });
  const editor = page.locator('.admin-editor .ProseMirror');
  await expect(editor.locator('hr')).toHaveCount(1);
  await title.fill('');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(title).toHaveAttribute('aria-invalid', 'true');
  await expect(editor).not.toHaveAttribute('aria-invalid', 'true');
  await title.fill('Rule retained');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(
    page.getByText('저장되었습니다.', { exact: true }),
  ).toBeVisible();
  const saved = (await (
    await api.get(`/api/admin/posts/${post.id}`)
  ).json()) as AdminPost;
  expect(saved.title).toBe('Rule retained');
  expect(saved.body).toBe('---\n');
});

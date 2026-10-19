import { expect } from '@playwright/test';
import { acceptMutationConfirmations } from '../../../tests/admin/confirmation';
import { test } from '../../../tests/admin/local-d1';

test.beforeEach(async ({ page, localD1 }) => {
  acceptMutationConfirmations(page);
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
});

for (const width of [390, 1280]) {
  for (const editing of [false, true]) {
    test(`${width}px ${editing ? 'save' : 'create'} overlays only inputs and unlocks after rejection`, async ({
      page,
      api,
      localD1,
    }, testInfo) => {
      const post = editing
        ? await (
            await api.post('/api/admin/posts', {
              data: { title: 'Original', body: 'Original body' },
            })
          ).json()
        : undefined;
      await page.setViewportSize({ width, height: 800 });
      await page.goto(
        `${localD1.origin}/admin/posts/${post ? `${post.id}/edit` : 'new'}`,
      );
      const editor = page.locator('.ProseMirror');
      await expect(editor).toHaveAttribute('contenteditable', 'true');
      await page.getByLabel('제목', { exact: true }).fill('Local input');
      await editor.fill('Preserved body');
      const titleBox = await page
        .getByLabel('제목', { exact: true })
        .boundingBox();
      let finish!: () => void;
      const held = new Promise<void>(resolve => {
        finish = resolve;
      });
      await page.route(
        `**/api/admin/posts${post ? `/${post.id}` : ''}`,
        async route => {
          await held;
          await route.fulfill({
            status: 403,
            json: {
              error: { code: 'FORBIDDEN', message: 'Controlled rejection' },
            },
          });
        },
      );
      await page
        .getByRole('button', {
          name: editing ? '저장' : '초안 생성',
          exact: true,
        })
        .click();
      const overlay = page.locator('[data-processing="region"]');
      await expect(overlay).toBeVisible();
      await expect(overlay).toHaveCSS('cursor', 'progress');
      await expect(page.locator('.post-form')).toHaveCSS('cursor', 'progress');
      const sessionCursor = await page
        .locator('.admin-session a')
        .evaluate(link => {
          const box = link.getBoundingClientRect();
          const hit = document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2,
          );
          return hit && getComputedStyle(hit).cursor;
        });
      expect(sessionCursor).toBe('progress');
      await expect(overlay.getByRole('status')).toContainText(
        editing ? '저장 중' : '초안 생성 중',
      );
      await expect(page.locator('header')).toHaveAttribute('inert', '');
      await expect(page.locator('.post-form .admin-heading')).toHaveAttribute(
        'inert',
        '',
      );
      const box = await overlay.boundingBox();
      expect(box!.y).toBeLessThanOrEqual(titleBox!.y);
      expect(box!.x).toBeLessThanOrEqual(titleBox!.x);
      expect(box!.y + box!.height).toBeLessThanOrEqual(800);
      const titleDuring = await page
        .getByLabel('제목', { exact: true })
        .boundingBox();
      expect(titleDuring!.y).toBe(titleBox!.y);
      expect(
        await page.locator('.admin-session a').evaluate(link => {
          (link as HTMLElement).focus();
          return document.activeElement === link;
        }),
      ).toBe(false);
      await page.screenshot({
        path: testInfo.outputPath('partial-loading.png'),
      });
      finish();
      await expect(overlay).toHaveCount(0);
      await expect(page.locator('header')).not.toHaveAttribute('inert', '');
      await expect(page.locator('.admin-session a')).toHaveCSS(
        'cursor',
        'pointer',
      );
      await expect(page.getByLabel('제목', { exact: true })).toBeEnabled();
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
        'Local input',
      );
      await expect(editor).toHaveAttribute('contenteditable', 'true');
      await expect(editor).toContainText('Preserved body');
    });
  }
}

test('detail mutations retain a local status without an overlay', async ({
  page,
  api,
  localD1,
}, testInfo) => {
  const post = await (
    await api.post('/api/admin/posts', {
      data: { title: 'Local loading', body: 'Body' },
    })
  ).json();
  await page.goto(`${localD1.origin}/admin/posts/${post.id}`);
  let finish!: () => void;
  const held = new Promise<void>(resolve => {
    finish = resolve;
  });
  await page.route(`**/api/admin/posts/${post.id}/publish`, async route => {
    await held;
    await route.fulfill({
      status: 403,
      json: { error: { code: 'FORBIDDEN', message: 'Controlled rejection' } },
    });
  });
  await page.getByRole('button', { name: '발행', exact: true }).click();
  await expect(page.locator('[data-processing="local"]')).toBeVisible();
  const edit = page.getByRole('link', { name: '수정', exact: true });
  await expect(edit).toHaveAttribute('aria-disabled', 'true');
  await expect(edit).toHaveCSS('cursor', 'progress');
  await edit.hover();
  await expect(edit).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('[data-processing="local"] svg')).toBeVisible();
  await expect(
    page.locator('[data-processing="region"], [data-processing="global"]'),
  ).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-processing="local"] svg')).toHaveCSS(
    'animation-name',
    'none',
  );
  await page.screenshot({ path: testInfo.outputPath('local-loading.png') });
  finish();
  await expect(page.locator('[data-processing="local"]')).toHaveCount(0);
  await expect(edit).toHaveCSS('cursor', 'pointer');
});

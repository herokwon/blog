import { expect, type Locator } from '@playwright/test';
import { acceptMutationConfirmations } from '../../../tests/admin/confirmation';
import { test } from '../../../tests/admin/local-d1';

// Inert descendants are skipped by hit testing; their own computed cursor
// cannot prove what a user sees at the same location.
async function hitCursor(control: Locator) {
  return control.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(
      box.x + box.width / 2,
      box.y + box.height / 2,
    );
    return hit && getComputedStyle(hit).cursor;
  });
}

test.beforeEach(async ({ page, localD1 }) => {
  acceptMutationConfirmations(page);
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
});

for (const width of [390, 1280]) {
  test(`${width}px shared geometry and creation/edit emphasis`, async ({
    page,
    api,
    localD1,
  }) => {
    const post = await (
      await api.post('/api/admin/posts', {
        data: { title: `Button geometry ${width}`, body: 'Body' },
      })
    ).json();
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${localD1.origin}/admin/posts`);
    const write = page.getByRole('link', { name: '글쓰기', exact: true });
    const trash = page.getByRole('link', { name: '휴지통', exact: true });
    const writeBox = await write.boundingBox();
    const trashBox = await trash.boundingBox();
    expect(writeBox!.height).toBe(42);
    expect(Math.abs(writeBox!.height - trashBox!.height)).toBeLessThanOrEqual(
      1,
    );
    expect(trashBox!.width).toBe(trashBox!.height);
    const icon = await trash.locator('svg').boundingBox();
    expect(icon!.width).toBe(20);
    expect(
      Math.abs(icon!.x + icon!.width / 2 - trashBox!.x - trashBox!.width / 2),
    ).toBeLessThanOrEqual(1);
    const previous = page.getByRole('button', { name: '이전 페이지' });
    await expect(previous).toHaveCSS('height', '36px');
    await expect(previous).toHaveCSS('cursor', 'not-allowed');
    const item = page
      .locator(width === 390 ? '.post-cards article' : '.post-table tbody tr')
      .filter({ hasText: post.title });
    await item.getByRole('button', { name: /작업 메뉴/ }).click();
    const menu = item.locator('.post-menu');
    await expect(
      menu.getByRole('button', { name: '발행', exact: true }),
    ).toHaveCSS('border-top-width', '0px');
    await expect(
      menu.getByRole('button', { name: '발행', exact: true }),
    ).toHaveCSS('color', 'rgb(32, 36, 44)');
    await expect(
      menu.getByRole('button', { name: '삭제', exact: true }),
    ).toHaveCSS('color', 'rgb(185, 28, 28)');
    await page.goto(`${localD1.origin}/admin/posts/new`);
    await expect(page.locator('.ProseMirror')).toHaveAttribute(
      'contenteditable',
      'true',
    );
    const create = page.getByRole('button', { name: '초안 생성', exact: true });
    await expect(create).toHaveCSS('color', 'rgb(32, 36, 44)');
    await expect(
      page.getByRole('button', { name: '발행', exact: true }),
    ).toHaveCSS('color', 'rgb(30, 64, 175)');
    await page.goto(`${localD1.origin}/admin/posts/${post.id}/edit`);
    const save = page.getByRole('button', { name: '저장', exact: true });
    await expect(save).toBeDisabled();
    await expect(save).toHaveCSS('color', 'rgb(30, 64, 175)');
    await expect(save).toHaveCSS('cursor', 'not-allowed');
    await save.hover();
    await expect(save).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await page.getByLabel('제목', { exact: true }).fill('Edited title');
    await expect(save).toBeEnabled();
    await expect(save).toHaveCSS('cursor', 'pointer');
    await page.getByRole('link', { name: '목록', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(save).toBeFocused();
    await expect(save).toHaveCSS('outline-style', 'solid');
  });

  for (const outcome of [
    'success',
    'rejected',
    'conflict',
    'uncertain',
  ] as const) {
    test(`${width}px list ${outcome} clears only temporary cursors`, async ({
      page,
      api,
      localD1,
    }) => {
      const post = await (
        await api.post('/api/admin/posts', {
          data: { title: `Cursor ${width} ${outcome}`, body: 'Body' },
        })
      ).json();
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${localD1.origin}/admin/posts`);
      const item = page
        .locator(width === 390 ? '.post-cards article' : '.post-table tbody tr')
        .filter({ hasText: post.title });
      await item.getByRole('button', { name: /작업 메뉴/ }).click();
      let release!: () => void;
      const held = new Promise<void>(resolve => {
        release = resolve;
      });
      let requests = 0;
      await page.route(`**/api/admin/posts/${post.id}/publish`, async route => {
        requests++;
        await held;
        if (outcome === 'success') await route.continue();
        else if (outcome === 'uncertain') await route.abort();
        else
          await route.fulfill({
            status: outcome === 'conflict' ? 409 : 403,
            json: {
              error: {
                code: outcome === 'conflict' ? 'CONFLICT' : 'FORBIDDEN',
                message: 'Controlled outcome',
              },
            },
          });
      });
      await item.getByRole('button', { name: '발행', exact: true }).click();
      const write = page.getByRole('link', {
        name: '글쓰기',
        exact: true,
        includeHidden: true,
      });
      const logout = page.locator('.admin-session a');
      try {
        await expect.poll(() => hitCursor(write)).toBe('progress');
        await expect.poll(() => hitCursor(logout)).toBe('progress');
        await expect(item).toHaveCSS('cursor', 'progress');
        // The list region is now intentionally inert under an overlay. Move
        // the real pointer instead of waiting to hover an excluded child.
        const itemBounds = await item.boundingBox();
        await page.mouse.move(
          itemBounds!.x + itemBounds!.width / 2,
          itemBounds!.y + itemBounds!.height / 2,
        );
        await expect.poll(() => hitCursor(item)).toBe('progress');
        await expect(item.locator('a').first()).toHaveCSS(
          'text-decoration-line',
          'none',
        );
        await write.click({ force: true });
        await page.keyboard.press('Enter');
        expect(requests).toBe(1);
        await expect(page).toHaveURL(`${localD1.origin}/admin/posts`);
      } finally {
        release();
      }
      await expect(page.locator('.admin-content')).not.toHaveClass(
        /admin-busy/,
      );
      await expect(write).toHaveCSS('cursor', 'pointer');
      await expect(logout).toHaveCSS('cursor', 'pointer');
      await expect(page.getByRole('button', { name: '이전 페이지' })).toHaveCSS(
        'cursor',
        'not-allowed',
      );
      await expect(item).toHaveCSS('cursor', 'pointer');
    });
  }
}

for (const width of [390, 1280]) {
  for (const command of ['publish', 'archive', 'delete', 'restore'] as const) {
    for (const outcome of ['success', 'rejected'] as const) {
      test(`${width}px detail ${command} ${outcome} restores list navigation cursor`, async ({
        page,
        api,
        localD1,
      }) => {
        const post = await (
          await api.post('/api/admin/posts', {
            data: {
              title: `Detail cursor ${width} ${command} ${outcome}`,
              body: 'Body',
            },
          })
        ).json();
        if (command === 'archive') {
          await api.post(`/api/admin/posts/${post.id}/publish`, {
            data: { expected_revision: post.revision },
          });
        } else if (command === 'restore') {
          await api.delete(`/api/admin/posts/${post.id}`, {
            data: { expected_revision: post.revision },
          });
        }
        await page.setViewportSize({ width, height: 900 });
        const detailURL = `${localD1.origin}/admin/posts/${post.id}`;
        await page.goto(detailURL);
        const list = page.getByRole('link', { name: '목록', exact: true });
        await expect(list).toHaveCSS('cursor', 'pointer');
        let release!: () => void;
        const held = new Promise<void>(resolve => {
          release = resolve;
        });
        await page.route(
          `**/api/admin/posts/${post.id}${command === 'delete' ? '' : `/${command}`}`,
          async route => {
            if (route.request().method() === 'GET') return route.continue();
            await held;
            if (outcome === 'success') await route.continue();
            else
              await route.fulfill({
                status: 403,
                json: {
                  error: { code: 'FORBIDDEN', message: 'Controlled rejection' },
                },
              });
          },
        );
        page.on('dialog', dialog => dialog.accept());
        await page
          .getByRole('button', {
            name: {
              publish: '발행',
              archive: '보관',
              delete: '삭제',
              restore: '복구',
            }[command],
            exact: true,
          })
          .click();
        try {
          await expect(list).toHaveAttribute('aria-disabled', 'true');
          await expect.poll(() => hitCursor(list)).toBe('progress');
          await list.hover();
          await expect(list).toHaveCSS(
            'background-color',
            'rgb(255, 255, 255)',
          );
          await list.click({ force: true });
          await expect(page).toHaveURL(detailURL);
          await list.focus();
          await page.keyboard.press('Enter');
          await expect(page).toHaveURL(detailURL);
        } finally {
          release();
        }
        await expect(list).not.toHaveAttribute('aria-disabled', 'true');
        await expect(list).toHaveCSS('cursor', 'pointer');
        await list.click();
        await expect(page).toHaveURL(
          `${localD1.origin}/admin/posts${(command === 'delete' && outcome === 'success') || (command === 'restore' && outcome === 'rejected') ? '/trash' : ''}`,
        );
      });
    }
  }
}

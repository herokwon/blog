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
}

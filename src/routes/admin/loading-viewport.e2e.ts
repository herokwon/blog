import { expect } from '@playwright/test';
import { test } from '../../../tests/admin/local-d1';

for (const width of [1280, 390]) {
  test(`${width}px a long list keeps its loading status inside the visible viewport`, async ({
    page,
    api,
    localD1,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 800 });
    await localD1.db.prepare('DELETE FROM posts').run();
    await page.setExtraHTTPHeaders({
      'Cf-Access-Jwt-Assertion': await localD1.token(),
    });
    page.on('dialog', dialog => dialog.accept());
    for (let number = 0; number < 20; number++)
      await api.post('/api/admin/posts', {
        data: { title: `Long loading ${width} ${number}`, body: 'Body' },
      });
    await page.goto(`${localD1.origin}/admin/posts`);
    const first = page
      .locator(width === 1280 ? '.post-table tbody tr' : '.post-cards article')
      .first();
    const link = first.locator('a').first();
    const title = await link.innerText();
    let release!: () => void;
    const pending = new Promise<void>(resolve => (release = resolve));
    await page.route(/\/api\/admin\/posts\/[^/]+\/publish$/, async route => {
      await pending;
      await route.fulfill({
        status: 403,
        json: { error: { code: 'FORBIDDEN', message: 'Controlled rejection' } },
      });
    });
    try {
      await page.getByRole('button', { name: `${title} 작업 메뉴` }).click();
      await page.getByRole('button', { name: '발행', exact: true }).click();
      const status = page.locator(
        'section.admin-content [data-processing="region"] [role="status"]',
      );
      await expect(status).toBeVisible();
      const assertVisible = async () => {
        const bounds = await status.boundingBox();
        expect(bounds!.y).toBeGreaterThanOrEqual(0);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(800);
      };
      await assertVisible();
      await page.screenshot({ path: testInfo.outputPath('long-list-top.png') });
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight / 2),
      );
      await assertVisible();
      await page.screenshot({
        path: testInfo.outputPath('long-list-scrolled.png'),
      });
    } finally {
      release();
    }
  });
}

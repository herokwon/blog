import { expect } from '@playwright/test';
import { test } from '../../../tests/admin/local-d1';

for (const width of [1280, 390]) {
  for (const trash of [false, true]) {
    test.describe(`${width}px ${trash ? 'trash' : 'normal'} layout`, () => {
      test.use({ viewport: { width, height: 900 } });
      test.beforeEach(async ({ page, localD1 }) => {
        await localD1.db.prepare('DELETE FROM posts').run();
        await page.setExtraHTTPHeaders({
          'Cf-Access-Jwt-Assertion': await localD1.token(),
        });
      });

      test('empty message centers in remaining space', async ({
        page,
        localD1,
      }) => {
        await page.goto(
          `${localD1.origin}/admin/posts${trash ? '/trash' : ''}`,
        );
        const empty = page.locator('.admin-empty');
        await expect(empty).toBeVisible();
        const geometry = await empty.evaluate(element => {
          const rect = element.getBoundingClientRect();
          const section = element.closest('section')!.getBoundingClientRect();
          const filters = document
            .querySelector('.post-filters')
            ?.getBoundingClientRect();
          const top = filters ? filters.bottom + 20 : section.top + 24;
          return {
            center: (rect.top + rect.bottom) / 2,
            expected: (top + section.bottom) / 2,
          };
        });
        expect(Math.abs(geometry.center - geometry.expected)).toBeLessThan(2);
      });

      test('short list keeps pagination at bottom without stretching items', async ({
        page,
        api,
        localD1,
      }) => {
        const response = await api.post('/api/admin/posts', {
          data: { title: `Layout ${width} ${trash}`, body: 'Body' },
        });
        expect(response.status()).toBe(201);
        const post = await response.json();
        if (trash)
          expect(
            (
              await api.delete(`/api/admin/posts/${post.id}`, {
                data: { expected_revision: post.revision },
              })
            ).status(),
          ).toBe(204);
        await page.goto(
          `${localD1.origin}/admin/posts${trash ? '/trash' : ''}`,
        );
        const pagination = page.getByRole('navigation', {
          name: '페이지',
          exact: true,
        });
        await expect(pagination).toBeVisible();
        const box = await pagination.boundingBox();
        expect(box!.y + box!.height).toBeCloseTo(
          900 - (width >= 768 ? 48 : 32),
          0,
        );
        const item = page.locator(
          width >= 768 ? '.post-table tbody tr' : '.post-cards article',
        );
        expect((await item.boundingBox())!.height).toBeLessThan(300);
      });
      test('long titles and lists expand a short page without nested scrolling', async ({
        page,
        api,
        localD1,
      }) => {
        await page.setViewportSize({ width, height: 480 });
        for (let index = 0; index < 8; index++) {
          const response = await api.post('/api/admin/posts', {
            data: { title: `${index} ${'LongTitle'.repeat(20)}`, body: 'Body' },
          });
          expect(response.status()).toBe(201);
          const post = await response.json();
          if (trash)
            expect(
              (
                await api.delete(`/api/admin/posts/${post.id}`, {
                  data: { expected_revision: post.revision },
                })
              ).status(),
            ).toBe(204);
        }
        await page.goto(
          `${localD1.origin}/admin/posts${trash ? '/trash' : ''}`,
        );
        const pagination = page.getByRole('navigation', {
          name: '페이지',
          exact: true,
        });
        await expect(pagination).toBeVisible();
        const last = page
          .locator(
            width >= 768 ? '.post-table tbody tr' : '.post-cards article',
          )
          .last();
        const lastBox = await last.boundingBox();
        const paginationBox = await pagination.boundingBox();
        expect(paginationBox!.y).toBeGreaterThan(lastBox!.y + lastBox!.height);
        expect(paginationBox!.y).toBeGreaterThan(480);
        const overflow = await page.evaluate(() => ({
          horizontal: document.documentElement.scrollWidth > innerWidth,
          nested: [
            ...document.querySelectorAll(
              '.admin-shell, .admin-content, .post-list-region',
            ),
          ].some(element =>
            ['auto', 'scroll', 'hidden', 'clip'].includes(
              getComputedStyle(element).overflowY,
            ),
          ),
        }));
        expect(overflow).toEqual({ horizontal: false, nested: false });
        await pagination.scrollIntoViewIfNeeded();
        await expect(pagination).toBeInViewport();
      });
    });
  }
}

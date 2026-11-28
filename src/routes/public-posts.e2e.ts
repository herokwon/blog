import { expect, test } from '@playwright/test';

test('reads published posts from a shareable paginated list without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: 'http://localhost:4173',
    javaScriptEnabled: false,
    viewport: { width: 320, height: 720 },
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    const posts = page
      .getByRole('main')
      .getByRole('link', { name: /^발행 글 / });
    await expect(posts).toHaveCount(20);
    await expect(posts.first()).toHaveText('발행 글 21');
    await expect(page.getByRole('link', { name: '이전' })).toHaveCount(0);
    await page.getByRole('link', { name: '다음' }).click();
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(posts).toHaveCount(1);
    await page.getByRole('link', { name: '발행 글 01' }).click();
    await expect(
      page.getByRole('heading', { name: '발행 글 01' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: '본문 예제' }),
    ).toBeVisible();
    const article = page.locator('article');
    for (const region of [
      article.getByRole('region', { name: '코드 블록' }),
      article.getByRole('region', { name: '표' }),
    ]) {
      expect(
        await region.evaluate(node => node.scrollWidth > node.clientWidth),
      ).toBe(true);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(320);
    await page.goBack();
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(page.getByRole('link', { name: '다음' })).toHaveCount(0);
    await page.getByRole('link', { name: '이전' }).click();
    await expect(page).toHaveURL('http://localhost:4173/');
  } finally {
    await context.close();
  }
});

test('returns a public 404 without exposing unavailable posts', async ({
  page,
  request,
}) => {
  for (const id of [22, 23, 24]) {
    const response = await request.get(
      `/posts/01900000-0000-7000-8000-${String(id).padStart(12, '0')}`,
    );
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toMatch(
      /초안 제목|보관 제목|휴지통 제목/,
    );
  }
  for (const path of ['/?page=0', '/?page=3', '/?page=invalid']) {
    expect((await request.get(path)).status()).toBe(404);
  }
  for (const path of ['/posts/missing', '/posts']) {
    expect((await page.goto(path))?.status()).toBe(404);
    await page.getByRole('link', { name: '글 목록으로 돌아가기' }).click();
    await expect(page).toHaveURL('http://localhost:4173/');
  }
});

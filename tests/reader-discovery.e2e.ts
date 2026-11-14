import { expect, test } from '@playwright/test';

test('anonymous discovery combines title/category/tag filters and retains URL state without JavaScript', async ({
  browser,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  const headers = {
    'cf-access-jwt-assertion': token,
    origin: 'http://localhost:4173',
  };
  const suffix = crypto.randomUUID().slice(0, 6);
  const categoryName = 'Discover ' + suffix;
  const privateCategory = 'Private ' + suffix;
  for (const name of [categoryName, privateCategory])
    await request.post('/admin/categories?/create', {
      headers,
      form: { name },
    });
  const html = await (
    await request.get('/admin/posts/new', { headers })
  ).text();
  const categoryId = html.match(
    new RegExp('<option value="([^"]+)"[^>]*>' + categoryName + '</option>'),
  )?.[1];
  const privateId = html.match(
    new RegExp('<option value="([^"]+)"[^>]*>' + privateCategory + '</option>'),
  )?.[1];
  expect(categoryId).toBeTruthy();
  const prefix = 'Find-' + suffix;
  for (let i = 0; i < 21; i++) {
    const response = await request.post('/admin/posts/new?/publish', {
      headers,
      form: {
        title: prefix + ' 한글 ' + i,
        body: 'Public body',
        categoryId: categoryId!,
        slug: 'find-' + suffix + '-' + i,
        tags: 'Legacy Tag',
      },
    });
    expect(response.status()).toBe(200);
  }
  await request.post('/admin/posts/new?/create', {
    headers,
    form: {
      title: prefix + ' private',
      body: 'Private body',
      categoryId: privateId!,
      tags: 'PrivateOnly',
    },
  });
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 800 },
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(
      page.getByRole('option', { name: privateCategory, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('option', { name: 'PrivateOnly', exact: true }),
    ).toHaveCount(0);
    await page
      .getByLabel('Search titles', { exact: true })
      .fill(prefix.toUpperCase());
    await page
      .getByLabel('Category filter', { exact: true })
      .selectOption(categoryId!);
    await page
      .getByLabel('Tag filter', { exact: true })
      .selectOption('Legacy Tag');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('.posts > li')).toHaveCount(20);
    await page.getByRole('link', { name: 'Next', exact: true }).click();
    await expect(page.locator('.posts > li')).toHaveCount(1);
    const url = new URL(page.url());
    expect(url.searchParams.get('q')).toBe(prefix.toUpperCase());
    expect(url.searchParams.get('category')).toBe(categoryId);
    expect(url.searchParams.get('tag')).toBe('Legacy Tag');
    await expect(page.getByLabel('Search titles', { exact: true })).toHaveValue(
      prefix.toUpperCase(),
    );
    await page.goBack();
    await expect(page.locator('.posts > li')).toHaveCount(20);
    await page
      .getByLabel('Search titles', { exact: true })
      .fill('No-such-' + suffix);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(
      page.getByText('No posts match these filters.', { exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get('page')).toBeNull();
    await page
      .getByRole('link', { name: 'Reset filters', exact: true })
      .click();
    await expect(page.getByLabel('Search titles', { exact: true })).toHaveValue(
      '',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

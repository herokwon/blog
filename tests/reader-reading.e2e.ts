import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });

test('long posts provide native heading navigation and keyboard-scrollable content at narrow widths', async ({
  page,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  const headers = {
    'cf-access-jwt-assertion': token,
    origin: 'http://localhost:4173',
  };
  const suffix = crypto.randomUUID().slice(0, 6);
  const name = 'Read ' + suffix;
  await request.post('/admin/categories?/create', { headers, form: { name } });
  const editorHtml = await (
    await request.get('/admin/posts/new', { headers })
  ).text();
  const categoryId = editorHtml.match(
    new RegExp('<option value="([^"]+)"[^>]*>' + name + '</option>'),
  )?.[1];
  expect(categoryId).toBeTruthy();
  const tick = String.fromCharCode(96).repeat(3);
  const table =
    '| ' +
    Array.from({ length: 12 }, (_, i) => 'Header ' + i).join(' | ') +
    ' |\n| ' +
    Array(12).fill('---').join(' | ') +
    ' |\n| ' +
    Array(12).fill('Cell').join(' | ') +
    ' |';
  const body =
    '## 동일 제목\n\nParagraph.\n\n### 동일 제목\n\n' +
    tick +
    'js\n' +
    'const long = "' +
    'x'.repeat(500) +
    '";\n' +
    tick +
    '\n\n' +
    table +
    '\n\nText[^one]\n\n[^one]: Footnote';
  const response = await request.post('/admin/posts/new?/publish', {
    headers,
    form: {
      title: 'Long reading',
      body,
      slug: 'long-' + suffix,
      categoryId: categoryId!,
    },
  });
  expect(response.status()).toBe(200);

  await page.goto('/posts/long-' + suffix);
  const toc = page.getByRole('navigation', { name: 'Table of contents' });
  await expect(toc.getByRole('link')).toHaveCount(2);
  await toc.getByRole('link').nth(1).click();
  expect(new URL(page.url()).hash).toBe('#post-heading-2');
  const code = page.getByRole('region', { name: 'Code block', exact: true });
  await expect(code).toHaveAttribute('tabindex', '0');
  await code.focus();
  await page.keyboard.press('End');
  expect(await code.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await expect(
    page.getByRole('region', { name: 'Table', exact: true }),
  ).toHaveAttribute('tabindex', '0');
  await expect(page.getByRole('table')).toBeVisible();
  const headerBox = await page
    .getByRole('columnheader', { name: 'Header 0', exact: true })
    .boundingBox();
  expect(headerBox!.height).toBeLessThan(100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.superpowers/reader-0.3.0/reader-320.png',
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.superpowers/reader-0.3.0/reader-320-large-text.png',
    fullPage: true,
  });
});

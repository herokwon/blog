import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });
test('public metadata and sitemap reflect publication and Preview never permits indexing', async ({
  page,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  const headers = {
    'cf-access-jwt-assertion': token,
    origin: 'http://localhost:4173',
  };
  const suffix = crypto.randomUUID().slice(0, 6),
    name = 'Meta ' + suffix;
  await request.post('/admin/categories?/create', { headers, form: { name } });
  const editorHtml = await (
    await request.get('/admin/posts/new', { headers })
  ).text();
  const categoryId = editorHtml.match(
    new RegExp('<option value="([^"]+)"[^>]*>' + name + '</option>'),
  )?.[1];
  expect(categoryId).toBeTruthy();
  const slug = 'meta-' + suffix;
  const response = await request.post('/admin/posts/new?/publish', {
    headers,
    form: {
      title: 'Meta & 한글',
      body: 'A public **paragraph** & more.',
      slug,
      categoryId: categoryId!,
    },
  });
  const result = (await response.json()) as { type: string; location: string };
  expect(result.type).toBe('redirect');
  await request.post('/admin/posts/new?/create', {
    headers,
    form: {
      title: 'Private metadata',
      body: 'Secret body',
      slug: 'secret-' + suffix,
    },
  });
  const publicResponse = await page.goto('/posts/' + slug);
  expect(publicResponse?.headers()['x-robots-tag']).toContain('noindex');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    'https://blog.herokwon.dev/posts/' + slug,
  );
  await expect(page.locator('meta[name=description]')).toHaveAttribute(
    'content',
    'A public paragraph & more.',
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'Meta & 한글',
  );
  await expect(page.locator('meta[name=robots]')).toHaveAttribute(
    'content',
    /noindex/,
  );
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.headers()['cache-control']).toContain('no-store');
  expect(sitemap.headers()['content-type']).toContain('xml');
  const xml = await sitemap.text();
  expect(xml).toContain('https://blog.herokwon.dev/posts/' + slug);
  expect(xml).not.toContain('secret-' + suffix);
  expect(await (await request.get('/robots.txt')).text()).toContain(
    'Disallow: /',
  );
  const edit = await (await request.get(result.location, { headers })).text();
  const revision = edit.match(/name="revision" value="([^"]+)"/)?.[1];
  expect(revision).toBeTruthy();
  await request.post(result.location + '?/archive', {
    headers,
    form: { revision: revision! },
  });
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain(
    '/posts/' + slug,
  );
  const hidden = await request.get('/posts/' + slug);
  expect(hidden.status()).toBe(404);
  expect(hidden.headers()['x-robots-tag']).toContain('noindex');
});

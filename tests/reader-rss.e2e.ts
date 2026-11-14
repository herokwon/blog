import { expect, test } from '@playwright/test';

test('RSS exposes twenty current public summaries with stable canonical identities and safe XML', async ({
  page,
  request,
}) => {
  const initial = await request.get('/rss.xml');
  expect(initial.status()).toBe(200);
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  const headers = {
    'cf-access-jwt-assertion': token,
    origin: 'http://localhost:4173',
  };
  const suffix = crypto.randomUUID().slice(0, 6),
    name = 'RSS ' + suffix;
  await request.post('/admin/categories?/create', { headers, form: { name } });
  const editorHtml = await (
    await request.get('/admin/posts/new', { headers })
  ).text();
  const categoryId = editorHtml.match(
    new RegExp('<option value="([^"]+)"[^>]*>' + name + '</option>'),
  )?.[1];
  expect(categoryId).toBeTruthy();
  let location = '';
  for (let i = 0; i < 21; i++) {
    const response = await request.post('/admin/posts/new?/publish', {
      headers,
      form: {
        title: 'Feed & 한글 ' + suffix + ' ' + i,
        body:
          'Summary **only** & safe.\n\n' +
          String.fromCharCode(96).repeat(3) +
          '\ncode-only-secret-' +
          suffix +
          '\n' +
          String.fromCharCode(96).repeat(3),
        slug: 'rss-' + suffix + '-' + i,
        categoryId: categoryId!,
      },
    });
    const result = (await response.json()) as {
      type: string;
      location: string;
    };
    expect(result.type).toBe('redirect');
    location = result.location;
  }
  await request.post('/admin/posts/new?/create', {
    headers,
    form: { title: 'Private RSS ' + suffix, body: 'Private RSS body' },
  });
  const response = await request.get('/rss.xml');
  expect(response.headers()['content-type']).toContain('application/rss+xml');
  expect(response.headers()['cache-control']).toContain('no-store');
  const xml = await response.text();
  expect(xml).toContain('Feed &amp; 한글');
  expect(xml).not.toContain('code-only-secret-' + suffix);
  expect(xml).not.toContain('Private RSS ' + suffix);
  const parsed = await page.evaluate(xml => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return {
      errors: doc.querySelectorAll('parsererror').length,
      items: [...doc.querySelectorAll('item')].map(item => ({
        link: item.querySelector('link')?.textContent,
        guid: item.querySelector('guid')?.textContent,
        description: item.querySelector('description')?.textContent,
        date: item.querySelector('pubDate')?.textContent,
      })),
    };
  }, xml);
  expect(parsed.errors).toBe(0);
  expect(parsed.items).toHaveLength(20);
  const newest = parsed.items.find(
    item =>
      item.link === 'https://blog.herokwon.dev/posts/rss-' + suffix + '-20',
  );
  expect(newest?.guid).toBe(newest?.link);
  expect(newest?.description).toBe('Summary only & safe.');
  expect(Number.isNaN(Date.parse(newest!.date!))).toBe(false);
  expect(
    parsed.items.some(
      item =>
        item.link === 'https://blog.herokwon.dev/posts/rss-' + suffix + '-0',
    ),
  ).toBe(false);
  await page.goto('/posts/rss-' + suffix + '-20');
  await expect(
    page.getByRole('link', { name: 'RSS', exact: true }),
  ).toBeVisible();
  const feedHref = await page
    .locator('link[rel=alternate][type="application/rss+xml"]')
    .getAttribute('href');
  expect(new URL(feedHref!, page.url()).pathname).toBe('/rss.xml');
  const edit = await (await request.get(location, { headers })).text();
  const revision = edit.match(/name="revision" value="([^"]+)"/)?.[1];
  expect(revision).toBeTruthy();
  await request.post(location + '?/archive', {
    headers,
    form: { revision: revision! },
  });
  expect(await (await request.get('/rss.xml')).text()).not.toContain(
    '/posts/rss-' + suffix + '-20',
  );
});

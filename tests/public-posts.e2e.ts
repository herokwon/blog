import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('anonymous readers receive sanitized SSR and publication changes immediately remove public access', async ({
  browser,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  const headers = {
    'cf-access-jwt-assertion': token,
    origin: 'http://localhost:4173',
  };
  const suffix = crypto.randomUUID().slice(0, 8);
  const categoryName = `Read ${suffix}`;
  await request.post('/admin/categories?/create', {
    headers,
    form: { name: categoryName },
  });
  const admin = await browser.newContext({
    extraHTTPHeaders: { 'cf-access-jwt-assertion': token },
  });
  const writer = await admin.newPage();
  const reader = await browser.newContext({ javaScriptEnabled: false });
  const page = await reader.newPage();
  try {
    await writer.goto('http://localhost:4173/admin/posts/new');
    const options = writer
      .getByLabel('Category', { exact: true })
      .locator('option')
      .filter({ hasText: categoryName });
    const categoryId = await options.getAttribute('value');
    const body =
      '## Readable heading\n\n**Strong text**\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n<script>window.pwned=true</script>\n\n[Unsafe](javascript:alert%281%29)';
    const published = await request.post('/admin/posts/new?/publish', {
      headers,
      form: {
        title: `Reader ${suffix}`,
        body,
        slug: `read-${suffix}`,
        categoryId: categoryId!,
        tags: 'Svelte',
      },
    });
    expect(published.status()).toBe(200);
    const publication = (await published.json()) as {
      type: string;
      status: number;
      location: string;
    };
    expect(publication.type).toBe('redirect');
    expect(publication.status).toBe(303);
    const postUrl = new URL(publication.location, 'http://localhost:4173').href;
    await writer.goto(postUrl);
    const revision = await writer
      .locator('input[name="revision"]')
      .first()
      .inputValue();
    expect(revision).toBeTruthy();
    const anonymous = await page.goto(
      `http://localhost:4173/posts/read-${suffix}`,
    );
    expect(anonymous?.status()).toBe(200);
    expect(anonymous?.headers()['cache-control']).toContain('no-store');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      `Reader ${suffix}`,
    );
    await expect(
      page.getByRole('heading', { name: 'Readable heading', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByText('Strong text', { exact: true })).toBeVisible();
    await expect(page.getByRole('article')).toContainText(categoryName);
    await expect(page.getByText('Svelte', { exact: true })).toBeVisible();
    await expect(
      page.locator('script').filter({ hasText: 'window.pwned' }),
    ).toHaveCount(0);
    expect(
      await page.getByText('Unsafe', { exact: true }).getAttribute('href'),
    ).toBeNull();
    const html = await anonymous!.text();
    expect(html).not.toContain('window.pwned');
    expect(html).not.toContain(revision);
    await page.goto('http://localhost:4173/');
    // Find the record through its public pagination without assuming an empty DB.
    const link = page.getByRole('link', {
      name: `Reader ${suffix}`,
      exact: true,
    });
    while (!(await link.count())) {
      const next = await page
        .getByRole('link', { name: 'Next', exact: true })
        .getAttribute('href');
      if (!next) throw new Error('Published record missing');
      await page.goto(new URL(next, page.url()).href);
    }
    await expect(link).toBeVisible();
    await request.post(`${postUrl}?/archive`, {
      headers,
      form: { revision },
    });
    const hidden = await page.goto(
      `http://localhost:4173/posts/read-${suffix}`,
    );
    expect(hidden?.status()).toBe(404);
    expect(hidden?.headers()['cache-control']).toContain('no-store');
    expect((await request.get(`/posts/not-found-${suffix}`)).status()).toBe(
      404,
    );
  } finally {
    await admin.close();
    await reader.close();
  }
});

test('public detail loading never requests the editor chunk or exposes private slugs', async ({
  page,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  const headers = {
    'cf-access-jwt-assertion': token,
    origin: 'http://localhost:4173',
  };
  const slug = `private-${crypto.randomUUID().slice(0, 8)}`;
  const draft = await request.post('/admin/posts/new?/create', {
    headers,
    form: { title: 'Private title', body: 'Private body', slug },
  });
  expect(draft.status()).toBe(200);
  const manifest = JSON.parse(
    readFileSync('.svelte-kit/output/client/.vite/manifest.json', 'utf8'),
  ) as Record<string, { file: string }>;
  const categoryName = `Public ${slug.slice(-8)}`;
  expect(
    (
      await request.post('/admin/categories?/create', {
        headers,
        form: { name: categoryName },
      })
    ).status(),
  ).toBe(200);
  const editorHtml = await (
    await request.get('/admin/posts/new', { headers })
  ).text();
  const categoryId = editorHtml.match(
    new RegExp(`<option value="([^"]+)"[^>]*>${categoryName}</option>`),
  )?.[1];
  expect(categoryId).toBeTruthy();
  const publicSlug = `public-${slug.slice(-8)}`;
  expect(
    (
      await request.post('/admin/posts/new?/publish', {
        headers,
        form: {
          title: 'Public detail',
          body: 'Reader body',
          slug: publicSlug,
          categoryId: categoryId!,
        },
      })
    ).status(),
  ).toBe(200);
  const editorChunk = manifest['src/lib/editor/crepe.ts'].file;
  let editorLoaded = false;
  page.on('request', request => {
    if (request.url().endsWith(editorChunk)) editorLoaded = true;
  });
  const response = await page.goto(`/posts/${slug}`);
  expect(response?.status()).toBe(404);
  expect(await response!.text()).not.toContain('Private body');
  expect(response?.headers()['cache-control']).toContain('no-store');
  expect((await page.goto(`/posts/${publicSlug}`))?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Public detail',
  );
  await page.waitForLoadState('networkidle');
  expect(editorLoaded).toBe(false);
  const data = await request.get(`/posts/${publicSlug}/__data.json`);
  expect(data.status()).toBe(200);
  expect(data.headers()['cache-control']).toContain('no-store');
  expect(await data.text()).not.toContain('revision');
  expect((await request.get('/?page=0')).status()).toBe(400);
});

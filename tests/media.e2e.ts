import { expect, test } from '@playwright/test';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

test('author stages images privately and explicit publication/removal controls public delivery', async ({
  page,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  const headers = {
    'cf-access-jwt-assertion': token,
    origin: 'http://localhost:4173',
  };
  await page.setExtraHTTPHeaders({ 'cf-access-jwt-assertion': token });
  const suffix = crypto.randomUUID().slice(0, 8);
  const category = `Media ${suffix}`;
  expect(
    (
      await request.post('/admin/categories?/create', {
        headers,
        form: { name: category },
      })
    ).status(),
  ).toBe(200);
  const writes: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().includes('/admin/posts'))
      writes.push(request.url());
  });
  await page.goto('/admin/posts/new');
  await expect(
    page.getByRole('textbox', { name: 'Markdown editor', exact: true }),
  ).toBeVisible();
  const pending = Promise.withResolvers<void>();
  const requested = Promise.withResolvers<void>();
  await page.route(
    '**/admin/media',
    async route => {
      requested.resolve();
      await pending.promise;
      await route.continue();
    },
    { times: 1 },
  );
  await page
    .getByLabel('Upload image', { exact: true })
    .setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: png });
  await requested.promise;
  await expect(
    page.getByRole('button', { name: 'Create draft', exact: true }),
  ).toBeDisabled();
  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    await dialog.dismiss();
  });
  await page.getByRole('link', { name: 'Posts', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/new$/);
  pending.resolve();
  const image = page
    .getByRole('textbox', { name: 'Markdown editor', exact: true })
    .locator('img');
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth))
    .toBe(1);
  const preview = await image.getAttribute('src');
  expect(preview).toContain('/admin/media/');
  const publicUrl = new URL(preview!, 'http://localhost:4173').pathname.replace(
    '/admin/media/',
    '/media/',
  );
  expect((await request.get(publicUrl)).status()).toBe(404);
  expect(
    (
      await request.get(publicUrl.replace('/media/', '/admin/media/'), {
        headers,
      })
    ).status(),
  ).toBe(200);
  await page.getByText('Markdown source', { exact: true }).click();
  await expect(page.getByLabel('Markdown', { exact: true })).toHaveValue(
    new RegExp(publicUrl),
  );
  expect(
    await page.getByLabel('Markdown', { exact: true }).inputValue(),
  ).not.toContain('/admin/media/');
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]+$/);
  expect((await request.get(publicUrl)).status()).toBe(404);
  await page.getByLabel('Title', { exact: true }).fill(`Media post ${suffix}`);
  await page.getByLabel('Slug', { exact: true }).fill(`media-${suffix}`);
  await page
    .getByLabel('Category', { exact: true })
    .selectOption({ label: category });
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(
    page.getByText('Status: published', { exact: true }),
  ).toBeVisible();
  const published = await request.get(publicUrl);
  expect(published.status()).toBe(200);
  expect(published.headers()['cache-control']).toContain('no-store');
  expect(await published.body()).toEqual(png);
  expect((await request.head(publicUrl)).status()).toBe(200);
  page.once('dialog', async dialog => {
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(
    page.getByText('Status: archived', { exact: true }),
  ).toBeVisible();
  expect((await request.head(publicUrl)).status()).toBe(404);
  await page.getByRole('button', { name: 'Republish', exact: true }).click();
  await expect(
    page.getByText('Status: published', { exact: true }),
  ).toBeVisible();
  expect((await request.get(publicUrl)).status()).toBe(200);
  await page.getByText('Markdown source', { exact: true }).click();
  await page.getByLabel('Markdown', { exact: true }).fill('Image removed');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Save', exact: true }),
  ).toBeEnabled();
  expect((await request.get(publicUrl)).status()).toBe(404);
});

test('upload boundary rejects anonymous/cross-origin and spoofed image writes; private and missing images are no-store', async ({
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  expect(
    (
      await request.post('/admin/media', {
        headers: {
          origin: 'http://localhost:4173',
          'content-type': 'image/png',
        },
        data: png,
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post('/admin/media', {
        headers: {
          origin: 'https://evil.test',
          'cf-access-jwt-assertion': token,
          'content-type': 'image/png',
        },
        data: png,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post('/admin/media', {
        headers: {
          origin: 'http://localhost:4173',
          'cf-access-jwt-assertion': token,
          'content-type': 'image/jpeg',
        },
        data: png,
      })
    ).status(),
  ).toBe(415);
  for (const path of [
    '/media/00000000-0000-4000-8000-000000000001',
    '/admin/media/00000000-0000-4000-8000-000000000001',
  ]) {
    const response = await request.get(path, {
      headers: { 'cf-access-jwt-assertion': token },
    });
    expect(response.status()).toBe(404);
    expect(response.headers()['cache-control']).toContain('no-store');
  }
});

test('rejected pasted images show an error and clear the provider upload placeholder', async ({
  page,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  await page.setExtraHTTPHeaders({ 'cf-access-jwt-assertion': token });
  await page.goto('/admin/posts/new');
  const editor = page.getByRole('textbox', {
    name: 'Markdown editor',
    exact: true,
  });
  await expect(editor).toBeVisible();
  await editor.focus();
  const clipboard = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(
      new File(['<svg></svg>'], 'spoof.png', { type: 'image/png' }),
    );
    return data;
  });
  const rejected = page.waitForResponse(
    response =>
      response.url().endsWith('/admin/media') &&
      response.request().method() === 'POST',
  );
  await editor.evaluate(
    (node, data) =>
      node.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      ),
    clipboard,
  );
  expect((await rejected).status()).toBe(415);
  await expect(page.getByRole('alert')).toContainText('contents do not match');
  await expect(
    page.getByText('Upload in progress...', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Create draft', exact: true }),
  ).toBeEnabled();
  await expect(editor.locator('img')).toHaveCount(0);
});

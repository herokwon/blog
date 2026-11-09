import { expect, test } from '@playwright/test';

test('author publishes, archives, trashes and restores without saving unsubmitted content', async ({
  page,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  await page.setExtraHTTPHeaders({ 'cf-access-jwt-assertion': token });
  const slug = `post-${crypto.randomUUID().slice(0, 8)}`;
  const title = `Browser ${slug}`;
  const categoryName = `Posts ${crypto.randomUUID().slice(0, 8)}`;
  expect(
    (
      await request.post('/admin/categories?/create', {
        headers: {
          'cf-access-jwt-assertion': token,
          origin: 'http://localhost:4173',
        },
        form: { name: categoryName },
      })
    ).status(),
  ).toBe(200);
  await page.goto('/admin/posts');
  await page.getByRole('link', { name: 'New post', exact: true }).click();
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]+$/);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Publication requires');
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page
    .getByRole('textbox', { name: 'Markdown editor', exact: true })
    .fill('Saved content');
  await page.getByLabel('Slug', { exact: true }).fill(slug);
  await expect(
    page.getByRole('status', { name: 'Slug availability' }),
  ).toHaveText('Slug is available.');
  await page
    .getByLabel('Category', { exact: true })
    .selectOption({ label: categoryName });
  await page.getByLabel('Add tag', { exact: true }).fill('Svelte');
  await page.getByRole('button', { name: 'Add tag', exact: true }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(
    page.getByText('Status: published', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Slug', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );
  await expect(page.getByLabel('Tag 1', { exact: true })).toHaveValue('Svelte');
  await page.getByLabel('Title', { exact: true }).fill('Unsaved title');
  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Unsaved title',
  );
  page.once('dialog', async dialog => {
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(
    page.getByText('Status: archived', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(title);
  await page.getByRole('button', { name: 'Republish', exact: true }).click();
  await expect(
    page.getByText('Status: published', { exact: true }),
  ).toBeVisible();
  page.once('dialog', async dialog => {
    await dialog.accept();
  });
  await page
    .getByRole('button', { name: 'Move to trash', exact: true })
    .click();
  await expect(
    page.getByText('Trash — read-only', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Title', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(
    page.getByText('Status: archived', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Posts', exact: true }).click();
  await page
    .getByLabel('Status filter', { exact: true })
    .selectOption('archived');
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await expect(
    page.getByRole('link', { name: title, exact: true }),
  ).toBeVisible();
});

test('native content validation retains input while unhydrated destructive controls require confirmation support', async ({
  browser,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  const context = await browser.newContext({
    javaScriptEnabled: false,
    extraHTTPHeaders: { 'cf-access-jwt-assertion': token },
  });
  const page = await context.newPage();
  try {
    await page.goto('http://localhost:4173/admin/posts/new');
    await page.getByLabel('Title', { exact: true }).fill('Native draft');
    await page
      .getByRole('button', { name: 'Create draft', exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]+$/);
    await expect(
      page.getByRole('button', { name: 'Move to trash', exact: true }),
    ).toBeDisabled();
    await page.getByLabel('Title', { exact: true }).fill('Native retained');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Publication requires');
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
      'Native retained',
    );
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
      'Native retained',
    );
  } finally {
    await context.close();
  }
});

test('stale editor input and tag selection survive a competing save; stale slug responses are ignored', async ({
  browser,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  const context = await browser.newContext({
    extraHTTPHeaders: { 'cf-access-jwt-assertion': token },
  });
  const first = await context.newPage();
  const second = await context.newPage();
  try {
    await first.goto('http://localhost:4173/admin/posts/new');
    await first
      .getByRole('button', { name: 'Create draft', exact: true })
      .click();
    await expect(first).toHaveURL(/\/admin\/posts\/[0-9a-f-]+$/);
    await second.goto(first.url());
    await first.getByLabel('Title', { exact: true }).fill('Winning edit');
    await first.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(
      first.getByRole('button', { name: 'Save', exact: true }),
    ).toBeEnabled();
    await second.getByLabel('Title', { exact: true }).fill('Keep stale input');
    await second.getByLabel('Add tag', { exact: true }).fill('Keep tag');
    await second.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(second.getByRole('alert')).toContainText('post changed');
    await expect(second.getByLabel('Title', { exact: true })).toHaveValue(
      'Keep stale input',
    );
    await expect(second.getByLabel('Add tag', { exact: true })).toHaveValue(
      'Keep tag',
    );
    const latest = second.getByRole('link', { name: 'Open latest saved post' });
    await expect(latest).toHaveAttribute('target', '_blank');
    const downloadPromise = second.waitForEvent('download');
    await second.getByRole('button', { name: 'Export unsaved input' }).click();
    const download = await downloadPromise;
    const contents: unknown = JSON.parse(
      await (
        await import('node:fs/promises')
      ).readFile(await download.path(), 'utf8'),
    );
    expect(contents).toMatchObject({
      title: 'Keep stale input',
      body: '',
      slug: '',
      categoryId: '',
      tags: [],
      pendingTag: 'Keep tag',
    });
    await second.evaluate(() => {
      URL.createObjectURL = () => {
        throw new Error('Download blocked');
      };
    });
    await second.getByRole('button', { name: 'Export unsaved input' }).click();
    await expect(second.getByRole('alert')).toContainText(
      'could not be exported',
    );
    second.once('dialog', dialog => dialog.dismiss());
    await second
      .getByRole('button', { name: 'Reload latest saved post' })
      .click();
    await expect(second.getByLabel('Title', { exact: true })).toHaveValue(
      'Keep stale input',
    );
    second.once('dialog', dialog => dialog.accept());
    await second
      .getByRole('button', { name: 'Reload latest saved post' })
      .click();
    await expect(second.getByLabel('Title', { exact: true })).toHaveValue(
      'Winning edit',
    );
    await first.reload();
    await expect(first.getByLabel('Title', { exact: true })).toHaveValue(
      'Winning edit',
    );
    const delayed = Promise.withResolvers<void>();
    const seen = Promise.withResolvers<void>();
    await first.route('**/admin/slug-availability?*', async route => {
      if (
        new URL(route.request().url()).searchParams.get('slug') === 'old-slug'
      ) {
        seen.resolve();
        await delayed.promise;
        await route.fulfill({ json: { valid: true, available: false } });
      } else await route.fulfill({ json: { valid: true, available: true } });
    });
    await first.getByLabel('Slug', { exact: true }).fill('old-slug');
    await seen.promise;
    await first.getByLabel('Slug', { exact: true }).fill('new-slug');
    await expect(
      first.getByRole('status', { name: 'Slug availability' }),
    ).toHaveText('Slug is available.');
    delayed.resolve();
    await expect(
      first.getByRole('status', { name: 'Slug availability' }),
    ).toHaveText('Slug is available.');
  } finally {
    await context.close();
  }
});

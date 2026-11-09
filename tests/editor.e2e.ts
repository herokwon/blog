import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('Crepe explicitly saves Markdown and protects dirty navigation without duplicate dialogs', async ({
  page,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  await page.setExtraHTTPHeaders({ 'cf-access-jwt-assertion': token });
  const posts: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST') posts.push(request.url());
  });
  await page.goto('/admin/posts/new');
  const editor = page.getByRole('textbox', {
    name: 'Markdown editor',
    exact: true,
  });
  await expect(editor).toBeVisible();
  await editor.fill('Crepe body');
  await expect.poll(() => posts.length).toBe(0);
  let dialogs = 0;
  page.once('dialog', async dialog => {
    dialogs++;
    expect(dialog.type()).toBe('confirm');
    await dialog.dismiss();
  });
  await page.getByRole('link', { name: 'Posts', exact: true }).click();
  await expect(editor).toContainText('Crepe body');
  await expect(page).toHaveURL(/\/admin\/posts\/new$/);
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]+$/);
  await expect(editor).toContainText('Crepe body');
  expect(dialogs).toBe(1);
  await page.reload();
  await expect(editor).toContainText('Crepe body');
  await editor.fill('Retained on error');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(editor).toContainText('Retained on error');
  await page.route('**/admin/posts/**', route => route.abort(), { times: 1 });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'request could not be completed',
  );
  await expect(editor).toContainText('Retained on error');
  page.once('dialog', async dialog => {
    dialogs++;
    expect(dialog.type()).toBe('beforeunload');
    await dialog.dismiss();
  });
  await page.evaluate(() => window.location.reload());
  await expect.poll(() => dialogs).toBe(2);
  await expect(editor).toContainText('Retained on error');
  expect(dialogs).toBe(2);
  page.once('dialog', async dialog => {
    dialogs++;
    await dialog.accept();
  });
  await page.getByRole('link', { name: 'Posts', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
  expect(dialogs).toBe(3);
});

test('clean metadata reverts and pending tags correctly govern dirty protection', async ({
  page,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  await page.setExtraHTTPHeaders({ 'cf-access-jwt-assertion': token });
  await page.goto('/admin/posts/new');
  await expect(
    page.getByRole('textbox', { name: 'Markdown editor', exact: true }),
  ).toBeVisible();
  const rich = page.getByRole('textbox', {
    name: 'Markdown editor',
    exact: true,
  });
  await rich.fill('Revert body');
  await rich.fill('');
  await page.getByLabel('Title', { exact: true }).fill('Revert');
  await page.getByLabel('Title', { exact: true }).fill('');
  await page.getByRole('link', { name: 'Posts', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
  await page.getByRole('link', { name: 'New post', exact: true }).click();
  await page.getByLabel('Add tag', { exact: true }).fill('Unsaved tag');
  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    await dialog.dismiss();
  });
  await page.getByRole('link', { name: 'Categories', exact: true }).click();
  await expect(page.getByLabel('Add tag', { exact: true })).toHaveValue(
    'Unsaved tag',
  );
  await page.getByLabel('Add tag', { exact: true }).fill('');
  await page.getByRole('link', { name: 'Categories', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/categories$/);
});

test('editor code stays off public/list pages and cancelled lazy mounts do not survive navigation', async ({
  page,
  request,
}) => {
  const manifest = JSON.parse(
    readFileSync('.svelte-kit/output/client/.vite/manifest.json', 'utf8'),
  ) as Record<string, { file: string }>;
  const chunk = manifest['src/lib/editor/crepe.ts'].file;
  let loaded = false;
  page.on('request', request => {
    if (request.url().endsWith(chunk)) loaded = true;
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(loaded).toBe(false);
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  await page.setExtraHTTPHeaders({ 'cf-access-jwt-assertion': token });
  await page.goto('/admin/posts');
  await page.waitForLoadState('networkidle');
  expect(loaded).toBe(false);
  const pending = Promise.withResolvers<void>();
  const requested = Promise.withResolvers<void>();
  await page.route(
    `**/${chunk}`,
    async route => {
      requested.resolve();
      await pending.promise;
      await route.continue();
    },
    { times: 1 },
  );
  await page.getByRole('link', { name: 'New post', exact: true }).click();
  await requested.promise;
  await page.getByRole('link', { name: 'Posts', exact: true }).click();
  pending.resolve();
  await page.waitForLoadState('networkidle');
  await expect(
    page.getByRole('textbox', { name: 'Markdown editor', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'New post', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: 'Markdown editor', exact: true }),
  ).toHaveCount(1);
  expect(loaded).toBe(true);
  const source = '## Source edited\n\n- first\n- second\n';
  await page.getByText('Markdown source', { exact: true }).click();
  await page.getByLabel('Markdown', { exact: true }).fill(source);
  await expect(
    page.getByRole('textbox', { name: 'Markdown editor', exact: true }),
  ).toContainText('Source edited');
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]+$/);
  await page.reload();
  await expect(
    page.getByRole('textbox', { name: 'Markdown editor', exact: true }),
  ).toContainText('Source edited');
  await page.getByText('Markdown source', { exact: true }).click();
  await expect(page.getByLabel('Markdown', { exact: true })).toHaveValue(
    source,
  );
  await page.getByRole('link', { name: 'Posts', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
});

test('failed editor download retains a usable native Markdown fallback', async ({
  page,
  request,
}) => {
  const manifest = JSON.parse(
    readFileSync('.svelte-kit/output/client/.vite/manifest.json', 'utf8'),
  ) as Record<string, { file: string }>;
  await page.route(`**/${manifest['src/lib/editor/crepe.ts'].file}`, route =>
    route.abort(),
  );
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  await page.setExtraHTTPHeaders({ 'cf-access-jwt-assertion': token });
  await page.goto('/admin/posts/new');
  await expect(
    page.getByRole('status').filter({ hasText: 'rich editor could not load' }),
  ).toBeVisible();
  await page.getByLabel('Markdown', { exact: true }).fill('Fallback body');
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]+$/);
  await expect(page.getByLabel('Markdown', { exact: true })).toHaveValue(
    'Fallback body',
  );
});

test('save feedback reflects actual success and preserves fields after authentication and network failures', async ({
  page,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  await page.setExtraHTTPHeaders({ 'cf-access-jwt-assertion': token });
  await page.goto('/admin/posts/new?saved=1');
  const status = page.getByRole('status', { name: 'Save status' });
  await expect(status).toHaveText('No changes.');
  await page.getByLabel('Title', { exact: true }).fill('Feedback draft');
  await expect(status).toHaveText('Unsaved changes.');
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]+$/);
  await expect(status).toHaveText('Saved.');
  await page.getByLabel('Title', { exact: true }).fill('Retained input');
  await page.route(
    '**/admin/posts/**',
    route =>
      route.fulfill({
        status: 401,
        contentType: 'text/plain',
        body: 'Administrator access denied.',
      }),
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Sign in again');
  await expect(status).toHaveText('Save failed.');
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Retained input',
  );
  await page.route('**/admin/posts/**', route => route.abort(), { times: 1 });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'request could not be completed',
  );
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Retained input',
  );
  await page.route(
    '**/admin/posts/**',
    route =>
      route.fulfill({
        json: {
          type: 'redirect',
          status: 303,
          location: 'https://example.test/login',
        },
      }),
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Sign in again');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(status).toHaveText('Saved.');
  await page.reload();
  await expect(status).toHaveText('No changes.');
});

test('inline category creation preserves unsaved post fields and selects the created category', async ({
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
  await page
    .getByLabel('Title', { exact: true })
    .fill('Unsaved category draft');
  await editor.fill('Keep unsaved Markdown');
  await page.getByLabel('Add tag', { exact: true }).fill('Pending tag');
  await page.getByText('Create a category', { exact: true }).click();
  const categoryForm = page.getByRole('form', {
    name: 'Create category while editing',
  });
  const name = 'Inline ' + crypto.randomUUID().slice(0, 8);
  await categoryForm.getByLabel('Category name', { exact: true }).fill(name);
  await categoryForm
    .getByRole('button', { name: 'Create category', exact: true })
    .click();
  await expect(page.getByLabel('Category', { exact: true })).toHaveValue(/.+/);
  await expect(
    page.getByLabel('Category', { exact: true }).locator('option:checked'),
  ).toHaveText(name);
  await expect(page).toHaveURL(/\/admin\/posts\/new$/);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Unsaved category draft',
  );
  await expect(editor).toContainText('Keep unsaved Markdown');
  await expect(page.getByLabel('Add tag', { exact: true })).toHaveValue(
    'Pending tag',
  );
  await categoryForm.getByLabel('Category name', { exact: true }).fill(name);
  await categoryForm
    .getByRole('button', { name: 'Create category', exact: true })
    .click();
  await expect(categoryForm.getByRole('alert')).toContainText('already exists');
  await expect(
    categoryForm.getByLabel('Category name', { exact: true }),
  ).toHaveValue(name);
  await page.route('**/admin/posts/new?**', route => route.abort(), {
    times: 1,
  });
  await categoryForm
    .getByRole('button', { name: 'Create category', exact: true })
    .click();
  await expect(categoryForm.getByRole('alert')).toContainText(
    'request could not be completed',
  );
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Unsaved category draft',
  );
  await expect(editor).toContainText('Keep unsaved Markdown');
  await expect(page.getByLabel('Add tag', { exact: true })).toHaveValue(
    'Pending tag',
  );
  await expect(
    page.getByLabel('Category', { exact: true }).locator('option:checked'),
  ).toHaveText(name);
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]+$/);
  await expect(
    page.getByLabel('Category', { exact: true }).locator('option:checked'),
  ).toHaveText(name);
  const revision = await page
    .locator('input[name="revision"]')
    .first()
    .inputValue();
  await page.getByText('Create a category', { exact: true }).click();
  await categoryForm
    .getByLabel('Category name', { exact: true })
    .fill(name + ' two');
  await categoryForm
    .getByRole('button', { name: 'Create category', exact: true })
    .click();
  await expect(
    page.getByLabel('Category', { exact: true }).locator('option:checked'),
  ).toHaveText(name + ' two');
  await expect(page.locator('input[name="revision"]').first()).toHaveValue(
    revision,
  );
  expect(
    (
      await request.post('/admin/posts/new?/createCategory', {
        headers: { origin: 'http://localhost:4173' },
        form: { name: 'Denied' },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post('/admin/posts/new?/createCategory', {
        headers: {
          'cf-access-jwt-assertion': token,
          origin: 'https://evil.test',
        },

        form: { name: 'Denied' },
      })
    ).status(),
  ).toBe(403);
});

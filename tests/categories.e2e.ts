import { expect, test } from '@playwright/test';

test('author manages categories with retained validation input and native deletion confirmation', async ({
  page,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  await page.setExtraHTTPHeaders({ 'cf-access-jwt-assertion': token });
  await page.goto('/admin/posts');
  await page.getByRole('link', { name: 'Categories', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Categories', exact: true }),
  ).toBeVisible();
  const name = `Test ${crypto.randomUUID().slice(0, 8)}`;
  const create = page.getByRole('form', { name: 'Create category' });
  const pending = Promise.withResolvers<void>();
  await page.route(
    '**/admin/categories?*',
    route => pending.promise.then(() => route.continue()),
    { times: 1 },
  );
  await create.getByLabel('Category name').fill(`  ${name}  `);
  await create.getByRole('button', { name: 'Create category' }).click();
  try {
    await expect(create.getByLabel('Category name')).toHaveAttribute(
      'readonly',
      '',
    );
  } finally {
    pending.resolve();
  }
  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await expect(row).toBeVisible();
  await create.getByLabel('Category name').fill(name);
  await create.getByRole('button', { name: 'Create category' }).click();
  await expect(page.getByRole('alert')).toContainText('already exists');
  await expect(create.getByLabel('Category name')).toHaveValue(name);

  // Bypass HTML controls: server validation must independently enforce the limit.
  const invalid = await request.post('/admin/categories?/create', {
    headers: {
      'cf-access-jwt-assertion': token,
      origin: 'http://localhost:4173',
    },
    form: { name: 'a'.repeat(21) },
  });
  expect(invalid.status()).toBe(400);
  expect(await invalid.text()).toContain('a'.repeat(21));
  const denied = await request.post('/admin/categories?/create', {
    headers: { origin: 'http://localhost:4173' },
    form: { name: 'Unauthorized' },
  });
  expect(denied.status()).toBe(401);
  const crossOrigin = await request.post('/admin/categories?/delete', {
    headers: {
      'cf-access-jwt-assertion': token,
      origin: 'https://evil.example.test',
    },
    form: { id: 'anything' },
  });
  expect(crossOrigin.status()).toBe(403);

  const renamed = `${name} new`;
  await row.getByLabel('Category name').fill(renamed);
  await row.getByRole('button', { name: 'Save name' }).click();
  const edited = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: renamed, exact: true }) });
  await expect(edited).toBeVisible();
  await edited.getByLabel('Category name').fill('Keep this input');
  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    await dialog.dismiss();
  });
  await edited.getByRole('button', { name: 'Delete category' }).click();
  await expect(edited.getByLabel('Category name')).toHaveValue(
    'Keep this input',
  );
  page.once('dialog', async dialog => {
    await dialog.accept();
  });
  await edited.getByRole('button', { name: 'Delete category' }).click();
  await expect(edited).toHaveCount(0);
});

import { expect, test, type Page } from '@playwright/test';

async function promptAction(
  page: Page,
  button: ReturnType<Page['getByRole']>,
  value: string | null,
) {
  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('prompt');
    if (value === null) await dialog.dismiss();
    else await dialog.accept(value);
  });
  await button.click();
}

test('category prompts, compact menus, validation and deletion confirmation retain safe behavior', async ({
  page,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  const headers = {
    'cf-access-jwt-assertion': token,
    origin: 'http://localhost:4173',
  };
  await page.setExtraHTTPHeaders(headers);
  await page.goto('/admin/categories');
  await page.waitForLoadState('networkidle');
  const create = page.getByRole('button', {
    name: 'Create category',
    exact: true,
  });
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await promptAction(page, create, null);
  await expect(page.getByRole('status')).toHaveCount(0);
  const name = 'A ' + crypto.randomUUID().slice(0, 8);
  await promptAction(page, create, '  ' + name + '  ');
  await expect(page.getByRole('status')).toContainText('created');
  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await expect(row).toBeVisible();
  await promptAction(page, create, name);
  await expect(page.getByRole('alert')).toContainText('already');
  await row.getByLabel('Category actions').click();
  await promptAction(
    page,
    row.getByRole('button', { name: 'Rename', exact: true }),
    name + ' new',
  );
  const renamed = page.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: name + ' new', exact: true }),
  });
  await expect(renamed).toBeVisible();
  await renamed.getByLabel('Category actions').click();
  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    await dialog.dismiss();
  });
  await renamed.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(renamed).toBeVisible();
  await renamed.getByLabel('Category actions').click();
  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    await dialog.accept();
  });
  await renamed.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(renamed).toHaveCount(0);
  expect(
    (
      await request.post('/admin/categories?/create', {
        headers,
        form: { name: 'a'.repeat(21) },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/admin/categories?/create', {
        headers: { origin: 'http://localhost:4173' },
        form: { name: 'Denied' },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post('/admin/categories?/delete', {
        headers: { ...headers, origin: 'https://evil.example.test' },
        form: { id: 'anything' },
      })
    ).status(),
  ).toBe(403);
});

test('used categories alert both from listed usage and a later assignment race', async ({
  page,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  const headers = {
    'cf-access-jwt-assertion': token,
    origin: 'http://localhost:4173',
  };
  await page.setExtraHTTPHeaders(headers);
  await page.goto('/admin/categories');
  await page.waitForLoadState('networkidle');
  const name = 'A used ' + crypto.randomUUID().slice(0, 6);
  await promptAction(
    page,
    page.getByRole('button', { name: 'Create category', exact: true }),
    name,
  );
  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await expect(row).toBeVisible();
  const id = await row.getAttribute('data-category-id');
  expect(id).toBeTruthy();
  expect(
    (
      await request.post('/admin/posts/new?/create', {
        headers,
        form: {
          title: 'Assigned category',
          categoryId: id!,
          body: '',
          slug: '',
          tags: '',
        },
      })
    ).status(),
  ).toBe(200);
  const dialogs: string[] = [];
  page.on('dialog', async dialog => {
    dialogs.push(dialog.type());
    if (dialog.type() === 'confirm') await dialog.accept();
    else await dialog.dismiss();
  });
  await row.getByLabel('Category actions').click();
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.poll(() => dialogs).toEqual(['confirm', 'alert']);
  await expect(row).toBeVisible();
  await page.reload();
  await page.waitForLoadState('networkidle');
  dialogs.length = 0;
  await row.getByLabel('Category actions').click();
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.poll(() => dialogs).toEqual(['alert']);
  await expect(row).toBeVisible();
});

test('failed category requests retain prompt retry names; scriptless operations cannot bypass dialogs', async ({
  page,
  request,
  browser,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  await page.setExtraHTTPHeaders({ 'cf-access-jwt-assertion': token });
  await page.goto('/admin/categories');
  await page.waitForLoadState('networkidle');
  const name = 'A retry ' + crypto.randomUUID().slice(0, 6),
    create = page.getByRole('button', { name: 'Create category', exact: true });
  await page.route('**/admin/categories?**', route => route.abort(), {
    times: 1,
  });
  await promptAction(page, create, name);
  await expect(page.getByRole('alert')).toContainText(
    'request could not be completed',
  );
  page.once('dialog', async dialog => {
    expect(dialog.defaultValue()).toBe(name);
    await dialog.accept(name);
  });
  await create.click();
  await expect(page.getByRole('status')).toContainText('created');
  const context = await browser.newContext({
    javaScriptEnabled: false,
    extraHTTPHeaders: { 'cf-access-jwt-assertion': token },
  });
  try {
    const native = await context.newPage();
    await native.goto('http://localhost:4173/admin/categories');
    await expect(
      native.getByRole('button', { name: 'Create category', exact: true }),
    ).toBeDisabled();
    await expect(
      native.getByText('JavaScript is required to manage categories.', {
        exact: true,
      }),
    ).toBeVisible();
    for (const button of await native
      .getByRole('button', { name: /^(Rename|Delete)$/ })
      .all())
      await expect(button).toBeDisabled();
  } finally {
    await context.close();
  }
});

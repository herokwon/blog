import { expect, test } from '@playwright/test';

test('narrow administrator pages and keyboard feedback keep controls usable and focus actionable', async ({
  page,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  await page.setExtraHTTPHeaders({ 'cf-access-jwt-assertion': token });
  await request.post('/admin/categories?/create', {
    headers: {
      'cf-access-jwt-assertion': token,
      origin: 'http://localhost:4173',
    },
    form: { name: '😀'.repeat(20) },
  });
  await page.setViewportSize({ width: 360, height: 800 });
  const noOverflow = async () =>
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  await page.goto('/admin/posts');
  await expect(
    page.getByRole('heading', { name: 'Posts', exact: true }),
  ).toBeVisible();
  await noOverflow();
  await page
    .getByRole('link', { name: 'New post', exact: true })
    .press('Enter');
  await expect(
    page.getByRole('textbox', { name: 'Markdown editor', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill('x'.repeat(200));
  await page.getByText('Markdown source', { exact: true }).click();
  await page
    .getByLabel('Markdown', { exact: true })
    .fill('\x60\x60\x60\n' + 'long'.repeat(100) + '\n\x60\x60\x60');
  await noOverflow();
  await page.getByText('Create a category', { exact: true }).press('Enter');
  const category = page.getByRole('form', {
    name: 'Create category while editing',
  });
  await category
    .getByLabel('Category name', { exact: true })
    .fill('Keyboard ' + crypto.randomUUID().slice(0, 8));
  await category.getByLabel('Category name', { exact: true }).press('Enter');
  await expect(page.getByLabel('Category', { exact: true })).toBeFocused();
  await page.getByLabel('Title', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('alert')).toBeFocused();
  await page.screenshot({
    path: '.superpowers/admin-improvements/usability-360.png',
    fullPage: true,
  });
  await page.getByLabel('Title', { exact: true }).fill('Keyboard draft');
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Save status' })).toHaveText(
    'Saved.',
  );
  await page.getByRole('link', { name: 'Posts', exact: true }).press('Enter');
  await page
    .getByRole('link', { name: 'Categories', exact: true })
    .press('Enter');
  const create = page.getByRole('form', { name: 'Create category' });
  await create.getByLabel('Category name').fill('a'.repeat(21));
  await create.getByLabel('Category name').press('Enter');
  await expect(page.getByRole('alert')).toBeFocused();
  await expect(create.getByLabel('Category name')).toHaveValue('a'.repeat(21));
  await noOverflow();
  // A 640 CSS-pixel viewport exercises 1280px desktop reflow at 200% zoom.
  await page.setViewportSize({ width: 640, height: 800 });
  await noOverflow();
  await page.goto('/admin/posts/new');
  await expect(
    page.getByRole('textbox', { name: 'Markdown editor', exact: true }),
  ).toBeVisible();
  await noOverflow();
  await page.screenshot({
    path: '.superpowers/admin-improvements/usability-reflow-640.png',
    fullPage: true,
  });
});

test('typing into native fields before hydration survives editor startup', async ({
  page,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  await page.setExtraHTTPHeaders({ 'cf-access-jwt-assertion': token });
  const categoryName = 'Early ' + crypto.randomUUID().slice(0, 8);
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
  let release = Promise.withResolvers<void>();
  await page.route('**/_app/immutable/**/*.js', route =>
    release.promise.then(() => route.continue()),
  );
  try {
    await page.goto('/admin/posts', { waitUntil: 'commit' });
    await page
      .getByLabel('Search titles', { exact: true })
      .fill('Before hydration');
    await page
      .getByLabel('Status filter', { exact: true })
      .selectOption('draft');
  } finally {
    release.resolve();
  }
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('Search titles', { exact: true })).toHaveValue(
    'Before hydration',
  );
  await expect(page.getByLabel('Status filter', { exact: true })).toHaveValue(
    'draft',
  );
  release = Promise.withResolvers<void>();
  let chosenCategory: string;
  try {
    await page.goto('/admin/posts/new', { waitUntil: 'commit' });
    await page
      .getByLabel('Title', { exact: true })
      .fill('Typed before hydration');
    await page.getByLabel('Slug', { exact: true }).fill('before-hydration');
    await page.getByLabel('Add tag', { exact: true }).fill('Early tag');
    chosenCategory = (
      await page
        .getByLabel('Category', { exact: true })
        .selectOption({ label: categoryName })
    )[0];
    await page
      .getByLabel('Markdown', { exact: true })
      .fill('Native body before hydration');
  } finally {
    release.resolve();
  }
  await expect(
    page.getByRole('textbox', { name: 'Markdown editor', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Typed before hydration',
  );
  await expect(page.getByLabel('Slug', { exact: true })).toHaveValue(
    'before-hydration',
  );
  await expect(page.getByLabel('Add tag', { exact: true })).toHaveValue(
    'Early tag',
  );
  await expect(page.getByLabel('Category', { exact: true })).toHaveValue(
    chosenCategory,
  );
  await expect(
    page.getByRole('textbox', { name: 'Markdown editor', exact: true }),
  ).toContainText('Native body before hydration');
});

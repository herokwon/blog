import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  await page.setExtraHTTPHeaders({ 'cf-access-jwt-assertion': token });
  await page.goto('/admin/posts/new');
  await expect(
    page.getByRole('textbox', { name: 'Markdown editor', exact: true }),
  ).toBeVisible();
});

test('tag area opens on activation, commits continuously, hides on blur and restores its empty hint', async ({
  page,
}) => {
  const input = page.getByLabel('Add tag', { exact: true });
  const area = page.getByRole('toolbar', {
    name: 'Tag entry area',
    exact: true,
  });
  await expect(input).not.toBeVisible();
  await expect(
    page.getByText('Enter tags (up to 20).', { exact: true }),
  ).toBeVisible();
  await area.press('Enter');
  await input.fill('Svelte');
  await input.press('Space');
  await expect(
    page.getByRole('button', { name: 'Edit tag Svelte', exact: true }),
  ).toBeVisible();
  await expect(input).toBeFocused();
  await input.fill('Cloudflare');
  await input.press('Enter');
  await expect(input).toBeFocused();
  await page.getByLabel('Title', { exact: true }).click();
  await expect(input).not.toBeVisible();
  await page
    .getByRole('button', { name: 'Edit tag Cloudflare', exact: true })
    .click();
  const edit = page.getByLabel('Edit tag Cloudflare', { exact: true });
  await edit.fill('Workers');
  await edit.press('Enter');
  await expect(input).toBeFocused();
  await input.press('Backspace');
  const workers = page.getByRole('button', {
    name: 'Edit tag Workers',
    exact: true,
  });
  await expect(workers).toBeFocused();
  await workers.press('Backspace');
  const svelte = page.getByRole('button', {
    name: 'Edit tag Svelte',
    exact: true,
  });
  await expect(svelte).toBeFocused();
  await svelte.click();
  const editSvelte = page.getByLabel('Edit tag Svelte', { exact: true });
  await editSvelte.fill('');
  await editSvelte.press('Backspace');
  await expect(
    page.getByText('Enter tags (up to 20).', { exact: true }),
  ).toBeVisible();
  await expect(input).not.toBeVisible();
  await expect(area).toBeFocused();
  await expect(page).toHaveURL(/\/new$/);
});

test('IME, duplicate validation, blur retention and saving use the post form without tag-only writes', async ({
  page,
}) => {
  const area = page.getByRole('toolbar', {
    name: 'Tag entry area',
    exact: true,
  });
  const input = page.getByLabel('Add tag', { exact: true });
  const writes: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST') writes.push(request.url());
  });
  await area.press('Enter');
  await input.dispatchEvent('compositionstart');
  await input.fill('한글');
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  await expect(input).toHaveValue('한글');
  await input.dispatchEvent('compositionend');
  await input.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Edit tag 한글', exact: true }),
  ).toBeVisible();
  await input.fill('한글');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('already');
  await expect(input).toHaveValue('한글');
  await input.fill('Workers');
  await page.getByLabel('Title', { exact: true }).click();
  await expect(input).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Edit tag Workers', exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]+$/);
  await expect(
    page.getByRole('button', { name: 'Edit tag 한글', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Edit tag Workers', exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
});

test('invalid hidden buffers remain recoverable and whitespace paste respects all-or-nothing limits', async ({
  page,
}) => {
  const area = page.getByRole('toolbar', { name: 'Tag entry area' }),
    input = page.getByLabel('Add tag', { exact: true });
  await area.press('Enter');
  await input.fill('a'.repeat(41));
  await page.getByLabel('Title', { exact: true }).click();
  await expect(input).not.toBeVisible();
  await expect(page.getByRole('alert')).toContainText('1–40');
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('a'.repeat(41));
  await input.fill('');
  await input.evaluate(element => {
    const data = new DataTransfer();
    data.setData('text', 'one two one');
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(page.getByRole('alert')).toContainText('already');
  await expect(page.getByRole('button', { name: /^Edit tag / })).toHaveCount(0);
  await input.fill('');
  await input.evaluate(element => {
    const data = new DataTransfer();
    data.setData(
      'text',
      Array.from({ length: 20 }, (_, i) => 'tag' + i).join(' '),
    );
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(page.getByRole('button', { name: /^Edit tag / })).toHaveCount(
    20,
  );
  await input.fill('overflow');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('20');
  await expect(page.getByRole('button', { name: /^Edit tag / })).toHaveCount(
    20,
  );
  await expect(input).toHaveValue('overflow');
  await expect(page).toHaveURL(/\/new$/);
});

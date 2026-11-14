import { expect, test } from '@playwright/test';

test('explicit paragraph breaks survive editor changes, saving and anonymous SSR', async ({
  browser,
  request,
}) => {
  const token = await (await request.get('http://127.0.0.1:4174/token')).text();
  const headers = {
    'cf-access-jwt-assertion': token,
    origin: 'http://localhost:4173',
  };
  const suffix = crypto.randomUUID().slice(0, 8);
  const name = 'Break ' + suffix;
  await request.post('/admin/categories?/create', { headers, form: { name } });
  const editorHtml = await (
    await request.get('/admin/posts/new', { headers })
  ).text();
  const categoryId = editorHtml.match(
    new RegExp('<option value="([^"]+)"[^>]*>' + name + '</option>'),
  )?.[1];
  expect(categoryId).toBeTruthy();
  const body =
    '안녕하세요.\n\n방문해주신 모든 분들을 환영합니다.\n\n<br />\n\n이곳은 저의 경험들을 기록하고 공유하는 공간입니다.\n\n잠시 지나가는 수많은 시간 속에서 작더라도 영감을 줄 수 있다면 굉장히 가치 있는 것이라 믿습니다.\n\n<br />\n\n감사합니다.\n\n좋은 하루 되세요!';
  const created = await request.post('/admin/posts/new?/publish', {
    headers,
    form: {
      title: 'Break example',
      body,
      slug: 'break-' + suffix,
      categoryId: categoryId!,
    },
  });
  const result = (await created.json()) as { location: string };
  const admin = await browser.newContext({
    extraHTTPHeaders: { 'cf-access-jwt-assertion': token },
    viewport: { width: 900, height: 900 },
  });
  const anonymous = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 900, height: 900 },
  });
  try {
    const writer = await admin.newPage();
    writer.on('dialog', dialog => void dialog.accept());
    await writer.goto(result.location);
    const editor = writer.getByRole('textbox', {
      name: 'Markdown editor',
      exact: true,
    });
    await expect(editor).toBeVisible();
    await expect(editor.locator('p').filter({ hasText: /^\s*$/ })).toHaveCount(
      2,
    );
    await editor.press('Control+End');
    await editor.pressSequentially(' Updated');
    await writer
      .getByRole('button', { name: 'Save and update public post', exact: true })
      .click({ timeout: 5000 });
    await expect(
      writer.getByRole('status', { name: 'Save status' }),
    ).toHaveText('Saved.');
    await writer.reload();
    await expect(
      writer.getByRole('textbox', { name: 'Markdown editor', exact: true }),
    ).toContainText('Updated');
    const reader = await anonymous.newPage();
    await reader.goto('/posts/break-' + suffix);
    await expect(
      reader.locator('.content p').filter({ hasText: /^\s*$/ }),
    ).toHaveCount(2);
    await expect(reader.locator('.content')).toContainText('Updated');
    const editorSpacing = await editor
      .locator('p')
      .first()
      .evaluate(el => getComputedStyle(el).marginBlockEnd);
    const readerSpacing = await reader
      .locator('.content p')
      .first()
      .evaluate(el => getComputedStyle(el).marginBlockEnd);
    expect(readerSpacing).toBe(editorSpacing);
  } finally {
    await Promise.all([admin.close(), anonymous.close()]);
  }
});

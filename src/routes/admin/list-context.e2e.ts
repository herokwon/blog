import { expect } from '@playwright/test';
import { test } from '../../../tests/admin/local-d1';

test.beforeEach(async ({ page, localD1 }) => {
  await localD1.db.prepare('DELETE FROM posts').run();
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
});

test('list page correction preserves queries, empty states and authentication boundaries', async ({
  api,
}) => {
  for (const path of [
    '/admin/posts?status=archived&page=7&limit=2',
    '/admin/posts/trash?page=7&limit=2',
  ]) {
    const denied = await api.get(path, {
      headers: { 'Cf-Access-Jwt-Assertion': '' },
      maxRedirects: 0,
    });
    expect(denied.status()).toBe(401);
    const response = await api.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(response.headers().location).toBe(path.replace('page=7', 'page=1'));
    expect(response.headers()['cache-control']).toBe('no-store');
  }
});

for (const width of [1280, 390]) {
  test.describe(`${width}px list return context`, () => {
    test.use({ viewport: { width, height: 900 } });
    test('detail, edit, save, reload and direct menu edit retain the starting list', async ({
      page,
      api,
      localD1,
    }) => {
      for (let i = 0; i < 3; i++)
        await api.post('/api/admin/posts', {
          data: { title: `Context ${width} ${i}`, body: 'Body' },
        });
      const origin = '/admin/posts?status=draft&page=2&limit=1';
      await page.goto(localD1.origin + origin);
      const title = page
        .locator(
          width === 1280
            ? '.post-table tbody a'
            : '.post-cards .card-heading > a',
        )
        .first();
      const name = await title.innerText();
      if (width === 1280)
        await page.locator('.post-table tbody td').nth(1).click();
      else await title.click();
      await expect(
        page.getByRole('link', { name: '목록', exact: true }),
      ).toHaveAttribute('href', origin);
      await page.reload();
      await page.getByRole('link', { name: '수정', exact: true }).click();
      await expect(
        page.getByRole('link', { name: '목록', exact: true }),
      ).toHaveAttribute('href', origin);
      await page.getByRole('link', { name: '취소', exact: true }).click();
      await page.getByRole('link', { name: '수정', exact: true }).click();
      await page.getByLabel('제목', { exact: true }).fill(name + ' edited');
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page.locator('.post-detail h1')).toHaveText(
        name + ' edited',
      );
      await page.getByRole('link', { name: '목록', exact: true }).click();
      await expect(page).toHaveURL(localD1.origin + origin);
      await page.getByRole('button', { name: /작업 메뉴/ }).click();
      await page.getByRole('link', { name: '수정', exact: true }).click();
      await expect(
        page.getByRole('link', { name: '목록', exact: true }),
      ).toHaveAttribute('href', origin);
    });

    test('new draft and immediate publication carry the original filter, and write is Primary', async ({
      page,
      localD1,
    }) => {
      const origin = '/admin/posts?status=archived&page=1&limit=2';
      for (const action of ['초안 생성', '발행']) {
        await page.goto(localD1.origin + origin);
        const write = page.getByRole('link', { name: '글쓰기', exact: true });
        await expect(write).toHaveCSS('background-color', 'rgb(29, 78, 216)');
        await expect(write).toHaveCSS('color', 'rgb(255, 255, 255)');
        const trash = page.getByRole('link', { name: '휴지통', exact: true });
        expect((await write.boundingBox())?.height).toBe(
          (await trash.boundingBox())?.height,
        );
        await write.hover();
        await expect(write).toHaveCSS('background-color', 'rgb(30, 64, 175)');
        await page.mouse.move(0, 0);
        await page.keyboard.press('Tab');
        await write.focus();
        await expect(write).toHaveCSS('outline-style', 'solid');
        await page.screenshot({ path: `.wrangler/list-context-${width}.png` });
        await write.click();
        await expect(
          page.getByRole('link', { name: '취소', exact: true }),
        ).toHaveAttribute('href', origin);
        await page
          .getByLabel('제목', { exact: true })
          .fill(`New ${width} ${action}`);
        await page.locator('.admin-editor .ProseMirror').fill('New body');
        page.once('dialog', dialog => dialog.accept());
        await page.getByRole('button', { name: action, exact: true }).click();
        await expect(page.locator('.post-detail h1')).toHaveText(
          `New ${width} ${action}`,
        );
        await page.getByRole('link', { name: '목록', exact: true }).click();
        await expect(page).toHaveURL(localD1.origin + origin);
        await expect(
          page.getByText('게시글이 없습니다.', { exact: true }),
        ).toBeVisible();
      }
    });
  });
}

test('delete and restore keep their origins and returning corrects missing pages', async ({
  page,
  api,
  localD1,
}) => {
  for (let i = 0; i < 2; i++)
    await api.post('/api/admin/posts', {
      data: { title: `Delete ${i}`, body: 'Body' },
    });
  await page.goto(localD1.origin + '/admin/posts?status=draft&page=2&limit=1');
  await page.locator('.post-table tbody a').first().click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '복구', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: '목록', exact: true }).click();
  await expect(page).toHaveURL(
    localD1.origin + '/admin/posts?status=draft&page=1&limit=1',
  );
  await expect(page.locator('.post-table tbody tr')).toHaveCount(1);
  await page.goto(localD1.origin + '/admin/posts/trash?page=1&limit=1');
  await page.locator('.post-table tbody a').first().click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '복구', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '삭제', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: '목록', exact: true }).click();
  await expect(page).toHaveURL(
    localD1.origin + '/admin/posts/trash?page=1&limit=1',
  );
  await expect(
    page.getByText('휴지통이 비어 있습니다.', { exact: true }),
  ).toBeVisible();
});

test('new tabs keep independent origins and malformed context falls back safely', async ({
  page,
  context,
  api,
  localD1,
}) => {
  const post = await (
    await api.post('/api/admin/posts', {
      data: { title: 'Tabs', body: 'Body' },
    })
  ).json();
  await page.goto(localD1.origin + '/admin/posts?status=draft&page=1&limit=2');
  const href = await page
    .locator('.post-table tbody a')
    .first()
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  const other = await context.newPage();
  try {
    await other.setExtraHTTPHeaders({
      'Cf-Access-Jwt-Assertion': await localD1.token(),
    });
    await other.goto(href);
    await page.goto(localD1.origin + '/admin/posts?page=1&limit=5');
    await page.locator('.post-table tbody a').first().click();
    await expect(
      page.getByRole('link', { name: '목록', exact: true }),
    ).toHaveAttribute('href', '/admin/posts?page=1&limit=5');
    await other.reload();
    await expect(
      other.getByRole('link', { name: '목록', exact: true }),
    ).toHaveAttribute('href', '/admin/posts?status=draft&page=1&limit=2');
    await other.goto(
      `${localD1.origin}/admin/posts/${post.id}?returnTo=https%3A%2F%2Fevil.test`,
    );
    await expect(
      other.getByRole('link', { name: '목록', exact: true }),
    ).toHaveAttribute('href', '/admin/posts');
  } finally {
    await other.close();
  }
});

test('failed saves and failed new-post publication retain context and publication feedback', async ({
  page,
  api,
  localD1,
}) => {
  const post = await (
    await api.post('/api/admin/posts', {
      data: { title: 'Failure context', body: 'Body' },
    })
  ).json();
  const origin = '/admin/posts?status=archived&page=1&limit=2';
  const query = new URLSearchParams({ returnTo: origin });
  await page.goto(`${localD1.origin}/admin/posts/${post.id}/edit?${query}`);
  await page.getByLabel('제목', { exact: true }).fill('Retained input');
  await page.route(`**/api/admin/posts/${post.id}`, async route => {
    if (route.request().method() === 'PATCH')
      await route.fulfill({
        status: 403,
        json: { error: { code: 'FORBIDDEN', message: 'Test rejection' } },
      });
    else await route.continue();
  });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.locator('.feedback-summary')).toHaveText(
    '저장하지 못했습니다.',
  );
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
    'Retained input',
  );
  await expect(
    page.getByRole('link', { name: '목록', exact: true }),
  ).toHaveAttribute('href', origin);
  const cancelled = page
    .waitForEvent('dialog')
    .then(dialog => dialog.dismiss());
  await page.getByRole('link', { name: '목록', exact: true }).click();
  await cancelled;
  await expect(page).toHaveURL(
    `${localD1.origin}/admin/posts/${post.id}/edit?${query}`,
  );
  const discarded = page.waitForEvent('dialog').then(dialog => dialog.accept());
  await page.getByRole('link', { name: '목록', exact: true }).click();
  await discarded;
  await expect(page).toHaveURL(localD1.origin + origin);
  await page.getByRole('link', { name: '글쓰기', exact: true }).click();
  await page
    .getByLabel('제목', { exact: true })
    .fill('Draft survives failed publish');
  await page.locator('.admin-editor .ProseMirror').fill('Body');
  await page.route('**/api/admin/posts/*/publish', route =>
    route.fulfill({
      status: 403,
      json: { error: { code: 'FORBIDDEN', message: 'Test rejection' } },
    }),
  );
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '발행', exact: true }).click();
  await expect(page.locator('.feedback-summary')).toHaveText(
    '발행하지 못했습니다.',
  );
  await expect(page).toHaveURL(/\/edit\?publication=failed&returnTo=/);
  await expect(
    page.getByRole('link', { name: '목록', exact: true }),
  ).toHaveAttribute('href', origin);
});

test('publish, archive and republish keep the origin and return fresh filtered data', async ({
  page,
  api,
  localD1,
}) => {
  const post = await (
    await api.post('/api/admin/posts', {
      data: { title: 'Lifecycle context', body: 'Body' },
    })
  ).json();
  const origin = '/admin/posts?status=draft&page=1&limit=1';
  await page.goto(localD1.origin + origin);
  await page.locator('.post-table tbody a').first().click();
  for (const [action, success, next] of [
    ['발행', '발행되었습니다.', '보관'],
    ['보관', '보관되었습니다.', '재발행'],
    ['재발행', '재발행되었습니다.', '보관'],
  ]) {
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: action, exact: true }).click();
    await expect(page.locator('.feedback-summary')).toHaveText(success);
    await expect(
      page.getByRole('button', { name: next, exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole('link', { name: '목록', exact: true }),
    ).toHaveAttribute('href', origin);
  }
  await page.getByRole('link', { name: '목록', exact: true }).click();
  await expect(page).toHaveURL(localD1.origin + origin);
  await expect(
    page.getByText('게시글이 없습니다.', { exact: true }),
  ).toBeVisible();
  expect(
    (await (await api.get(`/api/admin/posts/${post.id}`)).json()).status,
  ).toBe('published');
});

test('unknown creation inspection opens all posts while ordinary return retains its filter', async ({
  page,
  api,
  localD1,
}) => {
  const origin = '/admin/posts?status=archived&page=1&limit=2';
  await page.goto(localD1.origin + origin);
  await page.getByRole('link', { name: '글쓰기', exact: true }).click();
  await page.getByLabel('제목', { exact: true }).fill('Possibly saved draft');
  await page.locator('.admin-editor .ProseMirror').fill('Body');
  await page.route('**/api/admin/posts', async route => {
    // The server commits creation, but the browser cannot establish its outcome.
    const saved = await route.fetch();
    expect(saved.status()).toBe(201);
    await route.fulfill({ status: 503 });
  });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '초안 생성', exact: true }).click();
  await expect(
    page.getByText('생성 결과를 확인할 수 없습니다.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: '글 목록 확인', exact: true }),
  ).toHaveAttribute('href', '/admin/posts');
  await expect(
    page.getByRole('link', { name: '목록', exact: true }),
  ).toHaveAttribute('href', origin);
  const all = await (await api.get('/api/admin/posts')).json();
  expect(all.items).toMatchObject([
    { title: 'Possibly saved draft', status: 'draft' },
  ]);
  expect(
    (await (await api.get('/api/admin/posts?status=archived')).json()).items,
  ).toEqual([]);
});

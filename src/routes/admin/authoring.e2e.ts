import { expect } from '@playwright/test';
import type { AdminPost } from '#lib/admin/contracts.ts';
import { test } from '../../../tests/admin/local-d1';

test.beforeEach(async ({ localD1, page }) => {
  await localD1.db.prepare('DELETE FROM posts').run();
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
});

for (const width of [1280, 390]) {
  test.describe(`${width}px authoring`, () => {
    test.use({ viewport: { width, height: 900 } });
    test('title-only lost response with concurrent body requires explicit whole-post reload', async ({
      page,
      api,
      localD1,
    }) => {
      const post = (await (
        await api.post('/api/admin/posts', {
          data: { title: 'Base', body: 'Original body' },
        })
      ).json()) as AdminPost;
      await page.goto(`${localD1.origin}/admin/posts/${post.id}/edit`);
      await page.getByLabel('제목', { exact: true }).fill('Submitted');
      let loseFirst = true;
      await page.route(`**/api/admin/posts/${post.id}`, async route => {
        if (loseFirst && route.request().method() === 'PATCH') {
          loseFirst = false;
          await api.patch(`/api/admin/posts/${post.id}`, {
            data: route.request().postDataJSON(),
          });
          await api.patch(`/api/admin/posts/${post.id}`, {
            data: { body: 'Concurrent body', expected_revision: 2 },
          });
          await route.fulfill({ status: 503 });
        } else await route.continue();
      });
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(
        page.getByText('다른 화면에서 글이 변경되었습니다.'),
      ).toBeVisible();
      await expect(page.locator('.ProseMirror')).toContainText('Original body');
      await page.getByRole('button', { name: '저장', exact: true }).click();
      expect(
        (await (await api.get(`/api/admin/posts/${post.id}`)).json()).body,
      ).toBe('Concurrent body');
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: '최신 내용 불러오기' }).click();
      await expect(page.locator('.ProseMirror')).toContainText(
        'Concurrent body',
      );
      await page.getByLabel('제목', { exact: true }).fill('After reload');
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page).toHaveURL(`${localD1.origin}/admin/posts/${post.id}`);
      expect(
        (await (await api.get(`/api/admin/posts/${post.id}`)).json()).body,
      ).toBe('Concurrent body');
    });
    test('stalled latest-content reload times out, unlocks and retains local input and revision', async ({
      page,
      api,
      localD1,
    }) => {
      const post = (await (
        await api.post('/api/admin/posts', {
          data: { title: 'Base', body: 'Original' },
        })
      ).json()) as AdminPost;
      await page.goto(`${localD1.origin}/admin/posts/${post.id}/edit`);
      await page.getByLabel('제목', { exact: true }).fill('Local');
      await api.patch(`/api/admin/posts/${post.id}`, {
        data: { title: 'Concurrent', expected_revision: 1 },
      });
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(
        page.getByRole('button', { name: '최신 내용 불러오기' }),
      ).toBeVisible();
      await page.clock.install();
      await page.route(`**/api/admin/posts/${post.id}`, route =>
        route.request().method() === 'GET'
          ? new Promise<void>(() => {})
          : route.continue(),
      );
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: '최신 내용 불러오기' }).click();
      await expect(page.getByLabel('제목', { exact: true })).toBeDisabled();
      await page.clock.fastForward(30001);
      await expect(
        page.getByText('최신 내용을 불러오지 못했습니다. 입력을 유지합니다.'),
      ).toBeVisible({ timeout: 1500 });
      await expect(page.getByLabel('제목', { exact: true })).toBeEnabled();
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
        'Local',
      );
      await page.unroute(`**/api/admin/posts/${post.id}`);
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(
        page.getByText('다른 화면에서 글이 변경되었습니다.'),
      ).toBeVisible();
      expect(
        (await (await api.get(`/api/admin/posts/${post.id}`)).json()).title,
      ).toBe('Concurrent');
    });
    test('manual retry submits the original save but preserves newer input and stays in the editor', async ({
      page,
      api,
      localD1,
    }) => {
      const post = (await (
        await api.post('/api/admin/posts', {
          data: { title: 'Base', body: 'Original' },
        })
      ).json()) as AdminPost;
      await page.goto(`${localD1.origin}/admin/posts/${post.id}/edit`);
      await page.getByLabel('제목', { exact: true }).fill('Submitted');
      await page.route(`**/api/admin/posts/${post.id}`, route =>
        route.fulfill({ status: 500 }),
      );
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(
        page.getByRole('button', { name: '원래 요청 다시 시도' }),
      ).toBeVisible();
      await page.getByLabel('제목', { exact: true }).fill('Newer input');
      await page.unroute(`**/api/admin/posts/${post.id}`);
      await page.getByRole('button', { name: '원래 요청 다시 시도' }).click();
      await expect
        .poll(
          async () =>
            (await (await api.get(`/api/admin/posts/${post.id}`)).json()).title,
        )
        .toBe('Submitted');
      await expect(page).toHaveURL(
        `${localD1.origin}/admin/posts/${post.id}/edit`,
      );
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
        'Newer input',
      );
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page).toHaveURL(`${localD1.origin}/admin/posts/${post.id}`);
      expect(
        (await (await api.get(`/api/admin/posts/${post.id}`)).json()).title,
      ).toBe('Newer input');
    });
    test('creates a draft, edits only title preserving Markdown, and opens saved detail', async ({
      page,
      api,
      localD1,
    }) => {
      await page.goto(`${localD1.origin}/admin/posts/new`);
      await page.getByLabel('제목', { exact: true }).fill('New draft');
      const editor = page.locator('.admin-editor .ProseMirror');
      await expect(editor).toHaveAttribute('contenteditable', 'true');
      await editor.fill('Draft body');
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/posts\/[^/]+\/edit$/);
      const id = new URL(page.url()).pathname.split('/')[3];
      const saved = (await (
        await api.get(`/api/admin/posts/${id}`)
      ).json()) as AdminPost;
      expect(saved.status).toBe('draft');
      expect(saved.body).toContain('Draft body');
      await page.getByLabel('제목', { exact: true }).fill('Title changed');
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page).toHaveURL(`${localD1.origin}/admin/posts/${id}`);
      const updated = (await (
        await api.get(`/api/admin/posts/${id}`)
      ).json()) as AdminPost;
      expect(updated.body).toBe(saved.body);
      expect(updated.title).toBe('Title changed');
      expect(
        await page.evaluate(() =>
          localStorage.getItem('blog:admin:new-post-recovery:v1'),
        ),
      ).toBeNull();
    });
    test('publishes a new post through two stages and navigates to detail', async ({
      page,
      api,
      localD1,
    }) => {
      await page.goto(`${localD1.origin}/admin/posts/new`);
      await page.getByLabel('제목', { exact: true }).fill('New published');
      await page.locator('.admin-editor .ProseMirror').fill('Publish body');
      await page.getByRole('button', { name: '발행', exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]{36}$/);
      const list = await (await api.get('/api/admin/posts')).json();
      expect(list.items).toHaveLength(1);
      expect(list.items[0].status).toBe('published');
    });
    test('ordinary conflict preserves input, inspect opens a new tab, reload requires discard and preserves input on fetch failure', async ({
      page,
      api,
      localD1,
      context,
    }) => {
      const post = (await (
        await api.post('/api/admin/posts', {
          data: { title: 'Base', body: '**Original**\n' },
        })
      ).json()) as AdminPost;
      await page.goto(`${localD1.origin}/admin/posts/${post.id}/edit`);
      await page.getByLabel('제목', { exact: true }).fill('Local input');
      await api.patch(`/api/admin/posts/${post.id}`, {
        data: { title: 'Concurrent', expected_revision: 1 },
      });
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(
        page.getByText('다른 화면에서 글이 변경되었습니다.'),
      ).toBeVisible();
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
        'Local input',
      );
      const opened = context.waitForEvent('page');
      await page.getByRole('link', { name: '최신 글 확인' }).click();
      const latest = await opened;
      await latest.waitForLoadState();
      await expect(latest).toHaveURL(
        `${localD1.origin}/admin/posts/${post.id}`,
      );
      await latest.close();
      page.once('dialog', dialog => dialog.dismiss());
      await page.getByRole('button', { name: '최신 내용 불러오기' }).click();
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
        'Local input',
      );
      await page.route(`**/api/admin/posts/${post.id}`, route =>
        route.fulfill({ status: 500 }),
      );
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: '최신 내용 불러오기' }).click();
      await expect(
        page.getByText('최신 내용을 불러오지 못했습니다. 입력을 유지합니다.'),
      ).toBeVisible();
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
        'Local input',
      );
      await page.unroute(`**/api/admin/posts/${post.id}`);
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: '최신 내용 불러오기' }).click();
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
        'Concurrent',
      );
      await page.getByLabel('제목', { exact: true }).fill('After reload');
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page).toHaveURL(`${localD1.origin}/admin/posts/${post.id}`);
    });
    test('recovery waits for an explicit choice without extending expiry or submitting, discard removes it', async ({
      page,
      api,
      localD1,
    }) => {
      await page.goto(`${localD1.origin}/admin/posts/new`);
      const editedAt = Date.now() - 10000;
      await page.evaluate(
        copy =>
          localStorage.setItem(
            'blog:admin:new-post-recovery:v1',
            JSON.stringify(copy),
          ),
        { title: 'Recovered', body: 'Recovery body', editedAt },
      );
      await page.reload();
      await expect(page.getByText('미저장 작성 내용이 있습니다')).toBeVisible();
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue('');
      await page.getByRole('button', { name: '복구', exact: true }).click();
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
        'Recovered',
      );
      expect(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('blog:admin:new-post-recovery:v1')!)
              .editedAt,
        ),
      ).toBe(editedAt);
      expect(
        (await (await api.get('/api/admin/posts')).json()).items,
      ).toHaveLength(0);
      page.once('dialog', dialog => dialog.accept());
      await page.reload();
      await page.getByRole('button', { name: '버리기', exact: true }).click();
      expect(
        await page.evaluate(() =>
          localStorage.getItem('blog:admin:new-post-recovery:v1'),
        ),
      ).toBeNull();
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue('');
    });
    test('unknown creation retains input and recorded copy, requires manual inspection, and unlocks controls', async ({
      page,
      localD1,
    }) => {
      await page.goto(`${localD1.origin}/admin/posts/new`);
      await page.getByLabel('제목', { exact: true }).fill('Uncertain');
      await page.locator('.admin-editor .ProseMirror').fill('Retained body');
      let attempts = 0;
      await page.route('**/api/admin/posts', route => {
        attempts++;
        return route.fulfill({ status: 503 });
      });
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(
        page.getByText(
          '생성 결과를 확인할 수 없습니다. 글 목록을 확인한 뒤 다시 시도하세요.',
        ),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: '글 목록 확인' }),
      ).toHaveAttribute('target', '_blank');
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
        'Uncertain',
      );
      await expect(page.getByLabel('제목', { exact: true })).toBeEnabled();
      expect(attempts).toBe(1);
      await expect
        .poll(() =>
          page.evaluate(() =>
            localStorage.getItem('blog:admin:new-post-recovery:v1'),
          ),
        )
        .toContain('Retained body');
    });
    test('confirmed creation clears recovery even when publishing fails and keeps the saved ID', async ({
      page,
      api,
      localD1,
    }) => {
      await page.goto(`${localD1.origin}/admin/posts/new`);
      await page.getByLabel('제목', { exact: true }).fill('Saved but private');
      await page.locator('.admin-editor .ProseMirror').fill('Private body');
      await page.route('**/api/admin/posts/*/publish', route =>
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'FORBIDDEN', message: 'Denied' },
          }),
        }),
      );
      await page.getByRole('button', { name: '발행', exact: true }).click();
      await expect(page).toHaveURL(/\/edit\?publication=failed$/);
      await expect(
        page.getByText(
          '초안은 저장되었습니다. 발행하지 못했습니다. 상세 화면에서 발행을 다시 시도하세요.',
        ),
      ).toBeVisible();
      expect(
        await page.evaluate(() =>
          localStorage.getItem('blog:admin:new-post-recovery:v1'),
        ),
      ).toBeNull();
      const list = await (await api.get('/api/admin/posts')).json();
      expect(list.items).toHaveLength(1);
      expect(list.items[0].status).toBe('draft');
    });
    test('unsaved navigation can be cancelled and storage failure shows one notice without blocking server saving', async ({
      page,
      localD1,
    }) => {
      await page.addInitScript(() => {
        Storage.prototype.setItem = () => {
          throw new Error('Unavailable');
        };
      });
      await page.goto(`${localD1.origin}/admin/posts/new`);
      await page
        .getByLabel('제목', { exact: true })
        .fill('Storage unavailable');
      await page.locator('.admin-editor .ProseMirror').fill('Still editable');
      await expect(
        page.getByText('브라우저 입력 복구를 사용할 수 없습니다.'),
      ).toHaveCount(1);
      page.once('dialog', dialog => dialog.dismiss());
      await page.getByRole('link', { name: '목록', exact: true }).click();
      await expect(page).toHaveURL(`${localD1.origin}/admin/posts/new`);
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page).toHaveURL(/\/edit$/);
    });
    test('unsupported persisted body blocks editing and save; deleted posts cannot be edited', async ({
      page,
      api,
      localD1,
    }) => {
      const post = (await (
        await api.post('/api/admin/posts', {
          data: {
            title: 'Unsupported',
            body: '![image](https://example.com/x.png)',
          },
        })
      ).json()) as AdminPost;
      await page.goto(`${localD1.origin}/admin/posts/${post.id}/edit`);
      await expect(page.getByText(/지원하지 않는 콘텐츠:/)).toBeVisible();
      await expect(
        page.getByRole('button', { name: '저장', exact: true }),
      ).toBeDisabled();
      await expect(page.locator('.editor-source')).toContainText(post.body);
      await api.delete(`/api/admin/posts/${post.id}`, {
        data: { expected_revision: 1 },
      });
      const denied = await page.goto(
        `${localD1.origin}/admin/posts/${post.id}/edit`,
      );
      expect(denied?.status()).toBe(409);
    });
  });
}

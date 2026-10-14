import { expect, type Page } from '@playwright/test';
import type { AdminPost } from '#lib/admin/contracts.ts';
import { acceptMutationConfirmations } from '../../../tests/admin/confirmation';
import { test } from '../../../tests/admin/local-d1';

const recoveryKey = 'blog:admin:new-post-recovery:v1';
const recoveryCopy = {
  title: 'Recovered',
  body: '**Recovery body**\n',
  editedAt: Date.now() - 10000,
};

async function openRecovery(page: Page, origin: string) {
  await page.goto(`${origin}/admin/posts/new`);
  await expect(page.getByLabel('제목', { exact: true })).toBeEnabled();
  await page.evaluate(
    ({ key, copy }) => localStorage.setItem(key, JSON.stringify(copy)),
    { key: recoveryKey, copy: recoveryCopy },
  );
  await page.reload();
}

test.beforeEach(async ({ localD1, page }) => {
  acceptMutationConfirmations(page);
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
        page.getByText('최신 내용을 불러오지 못했습니다.'),
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
        page.getByText('최신 내용을 불러오지 못했습니다.'),
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
    test('recovery confirmation restores unsaved input without extending expiry or submitting', async ({
      page,
      api,
      localD1,
    }) => {
      await openRecovery(page, localD1.origin);
      const dialog = page.getByRole('dialog', {
        name: '미저장 작성 내용이 있습니다',
      });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAccessibleDescription(
        '확인하면 이전 내용을 복구합니다. 취소하거나 창을 닫으면 이전 내용이 삭제됩니다.',
      );
      await expect(
        dialog.getByText('Recovered', { exact: true }),
      ).toBeVisible();
      await expect(dialog.locator('time')).toHaveAttribute(
        'datetime',
        new Date(recoveryCopy.editedAt).toISOString(),
      );
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue('');
      await dialog.getByRole('button', { name: '확인', exact: true }).click();
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
        'Recovered',
      );
      await expect(page.getByLabel('제목', { exact: true })).toBeFocused();
      await expect(page.locator('.admin-editor .ProseMirror')).toContainText(
        'Recovery body',
      );
      expect(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('blog:admin:new-post-recovery:v1')!)
              .editedAt,
        ),
      ).toBe(recoveryCopy.editedAt);
      expect(
        (await (await api.get('/api/admin/posts')).json()).items,
      ).toHaveLength(0);
    });
    test('recovery modal confines focus and retains its inert mounted editor through inner clicks and reload', async ({
      page,
      localD1,
    }) => {
      await openRecovery(page, localD1.origin);
      const dialog = page.getByRole('dialog', {
        name: '미저장 작성 내용이 있습니다',
      });
      await expect(dialog).toBeVisible();
      const editor = page.locator('.admin-editor .ProseMirror');
      await expect(editor).toBeVisible();
      await expect(editor).toHaveAttribute('contenteditable', 'false');
      await expect(page.getByLabel('제목', { exact: true })).toBeDisabled();
      await expect(page.locator('.post-actions button').nth(0)).toBeDisabled();
      await expect(page.locator('.post-actions button').nth(1)).toBeDisabled();
      await editor.evaluate(element =>
        element.setAttribute('data-recovery-mounted', 'true'),
      );
      await dialog.getByText('Recovered', { exact: true }).click();
      await expect(dialog).toBeVisible();
      await expect(editor).toHaveAttribute('data-recovery-mounted', 'true');
      await dialog.getByRole('button', { name: '확인', exact: true }).focus();
      for (const key of [
        'Tab',
        'Tab',
        'Tab',
        'Shift+Tab',
        'Shift+Tab',
        'Shift+Tab',
      ]) {
        await page.keyboard.press(key);
        expect(
          await dialog.evaluate(element =>
            element.contains(document.activeElement),
          ),
        ).toBe(true);
      }
      await page
        .locator('.admin-session a')
        .evaluate(element => (element as HTMLElement).focus());
      expect(
        await dialog.evaluate(element =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
      await page.reload();
      await expect(dialog).toBeVisible();
      expect(
        await page.evaluate(
          key => JSON.parse(localStorage.getItem(key)!),
          recoveryKey,
        ),
      ).toEqual(recoveryCopy);
      await dialog.getByRole('button', { name: '취소', exact: true }).click();
      await expect(page.getByLabel('제목', { exact: true })).toBeFocused();
      await expect(page.locator('.admin-editor .ProseMirror')).toHaveAttribute(
        'contenteditable',
        'true',
      );
    });
    for (const dismissal of ['Cancel', 'Escape', 'backdrop', 'X'] as const) {
      test(`recovery ${dismissal} discards exactly once and leaves an empty editable form`, async ({
        page,
        localD1,
      }) => {
        await openRecovery(page, localD1.origin);
        const dialog = page.getByRole('dialog', {
          name: '미저장 작성 내용이 있습니다',
        });
        await expect(dialog).toBeVisible();
        await page.evaluate(() => {
          const removals: string[] = [];
          const remove = Storage.prototype.removeItem;
          Storage.prototype.removeItem = function (key) {
            removals.push(key);
            return remove.call(this, key);
          };
          Object.defineProperty(window, 'recoveryRemovals', {
            value: removals,
          });
        });
        if (dismissal === 'Cancel')
          await dialog
            .getByRole('button', { name: '취소', exact: true })
            .click();
        else if (dismissal === 'Escape') await page.keyboard.press('Escape');
        else if (dismissal === 'X')
          await dialog.getByRole('button', { name: '복구 창 닫기' }).click();
        else await page.mouse.click(4, 4);
        await expect(dialog).toHaveCount(0);
        await expect(page.getByLabel('제목', { exact: true })).toHaveValue('');
        await expect(page.getByLabel('제목', { exact: true })).toBeFocused();
        await expect(
          page.locator('.admin-editor .ProseMirror'),
        ).toHaveAttribute('contenteditable', 'true');
        expect(
          await page.evaluate(key => localStorage.getItem(key), recoveryKey),
        ).toBeNull();
        expect(
          await page.evaluate(
            key =>
              Reflect.get(window, 'recoveryRemovals').filter(
                (removed: string) => removed === key,
              ).length,
            recoveryKey,
          ),
        ).toBe(1);
      });
    }
    test('failed recovery deletion shows one storage notice and still unlocks authoring', async ({
      page,
      localD1,
    }) => {
      await openRecovery(page, localD1.origin);
      const dialog = page.getByRole('dialog', {
        name: '미저장 작성 내용이 있습니다',
      });
      await expect(dialog).toBeVisible();
      await page.evaluate(() => {
        Storage.prototype.removeItem = () => {
          throw new Error('Unavailable');
        };
      });
      await dialog.getByRole('button', { name: '취소', exact: true }).click();
      await expect(
        page.getByText('브라우저 입력 복구를 사용할 수 없습니다.'),
      ).toHaveCount(1);
      expect(
        await page.evaluate(
          key => JSON.parse(localStorage.getItem(key)!),
          recoveryKey,
        ),
      ).toEqual(recoveryCopy);
      await page.getByLabel('제목', { exact: true }).fill('Still editable');
      await page.locator('.admin-editor .ProseMirror').fill('Can save');
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page).toHaveURL(/\/edit$/);
    });
    for (const recorded of [false, true]) {
      test(`confirmed application discard cannot return after timers or immediate revisit (recorded: ${recorded})`, async ({
        page,
        localD1,
      }) => {
        await page.goto(`${localD1.origin}/admin/posts/new`);
        const editor = page.locator('.admin-editor .ProseMirror');
        await expect(editor).toHaveAttribute('contenteditable', 'true');
        await page.clock.install();
        await page.clock.pauseAt(new Date());
        await page.getByLabel('제목', { exact: true }).fill('Discard this');
        await editor.fill('Discarded body');
        if (recorded) {
          await page.clock.runFor(600);
          expect(
            await page.evaluate(key => localStorage.getItem(key), recoveryKey),
          ).toContain('Discarded body');
        } else {
          expect(
            await page.evaluate(key => localStorage.getItem(key), recoveryKey),
          ).toBeNull();
        }
        page.once('dialog', dialog => dialog.accept());
        // The clock is paused to keep departure deterministically ahead of the debounce.
        await page
          .getByRole('link', { name: '목록', exact: true })
          .evaluate(element => (element as HTMLElement).click());
        await expect
          .poll(async () => {
            await page.clock.runFor(50);
            return page.url();
          })
          .toBe(`${localD1.origin}/admin/posts`);
        await page.clock.fastForward(2500);
        expect(
          await page.evaluate(key => localStorage.getItem(key), recoveryKey),
        ).toBeNull();
        await page
          .getByRole('link', { name: '글쓰기', exact: true })
          .evaluate(element => (element as HTMLElement).click());
        await expect
          .poll(async () => {
            await page.clock.runFor(50);
            return page.url();
          })
          .toBe(`${localD1.origin}/admin/posts/new`);
        await expect(page.getByLabel('제목', { exact: true })).toBeEnabled();
        await expect(page.getByLabel('제목', { exact: true })).toHaveValue('');
        await expect(page.getByRole('dialog')).toHaveCount(0);
      });
    }
    test('cancelled application departure preserves input and the existing recovery copy', async ({
      page,
      localD1,
    }) => {
      await page.goto(`${localD1.origin}/admin/posts/new`);
      await page.getByLabel('제목', { exact: true }).fill('Keep this');
      await page.locator('.admin-editor .ProseMirror').fill('Keep body');
      await expect
        .poll(() =>
          page.evaluate(key => localStorage.getItem(key), recoveryKey),
        )
        .toContain('Keep body');
      const stored = await page.evaluate(
        key => localStorage.getItem(key),
        recoveryKey,
      );
      page.once('dialog', dialog => dialog.dismiss());
      await page.getByRole('link', { name: '목록', exact: true }).click();
      await expect(page).toHaveURL(`${localD1.origin}/admin/posts/new`);
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
        'Keep this',
      );
      await expect(page.locator('.admin-editor .ProseMirror')).toContainText(
        'Keep body',
      );
      expect(
        await page.evaluate(key => localStorage.getItem(key), recoveryKey),
      ).toBe(stored);
    });
    test('refresh before the debounce preserves edited input for an explicit recovery choice', async ({
      page,
      localD1,
    }) => {
      await page.goto(`${localD1.origin}/admin/posts/new`);
      await expect(page.locator('.admin-editor .ProseMirror')).toHaveAttribute(
        'contenteditable',
        'true',
      );
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.getByLabel('제목', { exact: true }).fill('Reload this');
      await page.locator('.admin-editor .ProseMirror').fill('Reload body');
      expect(
        await page.evaluate(key => localStorage.getItem(key), recoveryKey),
      ).toBeNull();
      page.once('dialog', dialog => dialog.accept());
      await page.reload();
      const dialog = page.getByRole('dialog', {
        name: '미저장 작성 내용이 있습니다',
      });
      await expect(dialog).toBeVisible();
      await dialog
        .getByRole('button', { name: '확인', exact: true })
        .evaluate(element => (element as HTMLElement).click());
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
        'Reload this',
      );
      await expect(page.locator('.admin-editor .ProseMirror')).toContainText(
        'Reload body',
      );
    });
    test('confirmed creation leaves no new-post recovery on revisit', async ({
      page,
      localD1,
      api,
    }) => {
      await page.goto(`${localD1.origin}/admin/posts/new`);
      await page.getByLabel('제목', { exact: true }).fill('Created once');
      await page.locator('.admin-editor .ProseMirror').fill('Saved body');
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page).toHaveURL(/\/edit$/);
      await page.getByRole('link', { name: '목록', exact: true }).click();
      await page.getByRole('link', { name: '글쓰기', exact: true }).click();
      await expect(page.getByLabel('제목', { exact: true })).toBeEnabled();
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue('');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(
        await page.evaluate(key => localStorage.getItem(key), recoveryKey),
      ).toBeNull();
      expect(
        (await (await api.get('/api/admin/posts')).json()).items,
      ).toHaveLength(1);
    });
    test('rejected creation retains input and recorded copy without creating a post', async ({
      page,
      localD1,
      api,
    }) => {
      await page.goto(`${localD1.origin}/admin/posts/new`);
      await page.getByLabel('제목', { exact: true }).fill('Rejected');
      await page
        .locator('.admin-editor .ProseMirror')
        .fill('Retained rejected body');
      await page.route('**/api/admin/posts', route =>
        route.request().method() === 'POST'
          ? route.fulfill({
              status: 403,
              contentType: 'application/json',
              body: JSON.stringify({
                error: { code: 'FORBIDDEN', message: 'Denied' },
              }),
            })
          : route.continue(),
      );
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page.getByText('저장하지 못했습니다.')).toBeVisible();
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
        'Rejected',
      );
      await expect(page.locator('.admin-editor .ProseMirror')).toContainText(
        'Retained rejected body',
      );
      expect(
        await page.evaluate(key => localStorage.getItem(key), recoveryKey),
      ).toContain('Retained rejected body');
      expect(
        (await (await api.get('/api/admin/posts')).json()).items,
      ).toHaveLength(0);
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
        page.getByText('생성 결과를 확인할 수 없습니다.'),
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
      await expect(page.getByText('발행하지 못했습니다.')).toBeVisible();
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

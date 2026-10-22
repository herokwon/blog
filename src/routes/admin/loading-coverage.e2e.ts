import { expect } from '@playwright/test';
import type { AdminPost } from '#lib/admin/contracts.ts';
import { test } from '../../../tests/admin/local-d1';
import {
  newPostModuleURL,
  waitForPostListReady,
} from '../../../tests/admin/navigation';

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => (release = resolve));
  let released = false;
  return {
    promise,
    release: () => {
      released = true;
      release();
    },
    get released() {
      return released;
    },
  };
}

test.beforeEach(async ({ page, localD1 }) => {
  page.on('dialog', dialog => dialog.accept());
  await localD1.db.prepare('DELETE FROM posts').run();
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
});

for (const elapsed of [100, 199, 200, 201, 800, 2000]) {
  test(`completion at ${elapsed}ms never holds processing for a visual timer`, async ({
    page,
    api,
    localD1,
  }) => {
    const post = (await (
      await api.post('/api/admin/posts', {
        data: { title: `Timing ${elapsed}`, body: 'Body' },
      })
    ).json()) as AdminPost;
    await page.goto(`${localD1.origin}/admin/posts/${post.id}`);
    const response = gate();
    await page.route(`**/api/admin/posts/${post.id}/publish`, async route => {
      await response.promise;
      await route.continue();
    });
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    try {
      await page.getByRole('button', { name: '발행', exact: true }).click();
      await page.clock.runFor(elapsed);
      const indicator = page.locator('[data-processing="local"]');
      if (elapsed < 200) await expect(indicator).toHaveCount(0);
      else await expect(indicator).toBeVisible();
      response.release();
      const result = page.locator('.admin-feedback[data-tone="success"]');
      // No clock advancement: settlement, controls and the result must update
      // even if a hypothetical minimum processing timer has not elapsed.
      await expect(result).toContainText('발행되었습니다.');
      await expect(indicator).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: '보관', exact: true }),
      ).toBeEnabled();
      await expect(page.locator('header')).not.toHaveAttribute('inert', '');
      await page.clock.runFor(400);
      await expect(result).toBeVisible();
      await expect(indicator).toHaveCount(0);
    } finally {
      response.release();
      await page.clock.resume();
    }
  });
}

for (const width of [1280, 390]) {
  for (const destination of [
    'filter',
    'page',
    'detail',
    'new',
    'trash',
  ] as const) {
    for (const delayedBootstrap of destination === 'page' ||
    destination === 'trash'
      ? [false, true]
      : [false]) {
      test(`${width}px ${destination} navigation has scoped feedback while its route data is pending${delayedBootstrap ? ' with delayed bootstrap' : ''}`, async ({
        page,
        api,
        localD1,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        for (let number = 0; number < 2; number++)
          await api.post('/api/admin/posts', {
            data: { title: `Navigation ${width} ${number}`, body: 'Body' },
          });
        const bootstrap = gate();
        const bootstrapStarted = gate();
        if (delayedBootstrap)
          await page.route(
            /\/_app\/immutable\/entry\/app\.[^/]+\.js/,
            async route => {
              bootstrapStarted.release();
              await bootstrap.promise;
              await route.continue();
            },
          );
        await page.goto(`${localD1.origin}/admin/posts?page=1&limit=1`);
        const load = gate();
        const started = gate();
        const target =
          destination === 'filter'
            ? page.getByRole('link', { name: '초안', exact: true })
            : destination === 'page'
              ? page.getByRole('link', { name: '다음 페이지' })
              : destination === 'detail'
                ? page.getByRole('link', { name: /Navigation/ })
                : page.getByRole('link', {
                    name: destination === 'new' ? '글쓰기' : '휴지통',
                    exact: true,
                  });
        try {
          if (delayedBootstrap)
            await expect.poll(() => bootstrapStarted.released).toBe(true);
          bootstrap.release();
          await waitForPostListReady(page);
          const href = await target.evaluate(
            (anchor: HTMLAnchorElement) => anchor.href,
          );
          const destinationURL = new URL(href);
          const codeURL =
            destination === 'new'
              ? await newPostModuleURL(localD1.origin)
              : null;
          const documentRequests: string[] = [];
          page.on('request', request => {
            if (
              request.isNavigationRequest() &&
              request.resourceType() === 'document'
            )
              documentRequests.push(request.url());
          });
          await page.route(
            url =>
              codeURL
                ? url.href === codeURL
                : url.origin === destinationURL.origin &&
                  url.pathname === `${destinationURL.pathname}/__data.json` &&
                  [...destinationURL.searchParams].every(
                    ([key, value]) => url.searchParams.get(key) === value,
                  ),
            async route => {
              expect(route.request().resourceType()).toBe(
                codeURL ? 'script' : 'fetch',
              );
              started.release();
              await load.promise;
              await route.continue();
            },
          );
          await target.click();
          await expect.poll(() => started.released).toBe(true);
          expect(
            documentRequests,
            'Navigation must stay inside the hydrated app',
          ).toEqual([]);
          const overlay = page.locator(
            '.admin-shell > [data-processing="region"]',
          );
          await expect(overlay).toBeVisible();
          await expect(overlay.getByRole('status')).toHaveText(
            '화면 불러오는 중…',
          );
          expect(await overlay.evaluate(el => !!el.closest('[inert]'))).toBe(
            false,
          );
          await expect(page.locator('header')).toHaveAttribute('inert', '');
          await page.screenshot({
            path: testInfo.outputPath('navigation-region.png'),
          });
          load.release();
          await expect(overlay).toHaveCount(0);
          await expect(page.locator('header')).not.toHaveAttribute('inert', '');
          if (destination === 'filter')
            await expect(page).toHaveURL(/status=draft/);
          if (destination === 'page') await expect(page).toHaveURL(/page=2/);
          if (destination === 'detail')
            await expect(page.locator('.post-detail')).toBeVisible();
          if (destination === 'new')
            await expect(page.locator('.post-form')).toBeVisible();
          if (destination === 'trash') await expect(page).toHaveURL(/\/trash$/);
          expect(
            documentRequests,
            'Navigation must not reload the document',
          ).toEqual([]);
        } finally {
          bootstrap.release();
          load.release();
        }
      });
    }
  }
  for (const [operation, label, summary] of [
    ['publish', '발행', '발행되었습니다.'],
    ['republish', '재발행', '재발행되었습니다.'],
    ['archive', '보관', '보관되었습니다.'],
    ['delete', '삭제', '휴지통으로 이동했습니다.'],
    ['restore', '복구', '복구되었습니다.'],
  ] as const) {
    test(`${width}px ${operation} covers the list until refresh settles and then unlocks with one result`, async ({
      page,
      api,
      localD1,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      let post = (await (
        await api.post('/api/admin/posts', {
          data: { title: `Loading ${width} ${operation}`, body: 'Body' },
        })
      ).json()) as AdminPost;
      if (operation === 'archive' || operation === 'republish') {
        post = (await (
          await api.post(`/api/admin/posts/${post.id}/publish`, {
            data: { expected_revision: post.revision },
          })
        ).json()) as AdminPost;
      }
      if (operation === 'republish') {
        post = (await (
          await api.post(`/api/admin/posts/${post.id}/archive`, {
            data: { expected_revision: post.revision },
          })
        ).json()) as AdminPost;
      }
      if (operation === 'restore')
        await api.delete(`/api/admin/posts/${post.id}`, {
          data: { expected_revision: post.revision },
        });
      // Publishing removes the only item from this filter; restore/delete also
      // unmount the row. The list must retain its own processing ownership.
      const origin =
        operation === 'restore'
          ? '/admin/posts/trash?page=1&limit=1'
          : `/admin/posts?status=${post.status}&page=1&limit=1`;
      await page.goto(localD1.origin + origin);
      const mutation = gate();
      const refresh = gate();
      const refreshing = gate();
      let requests = 0;
      const command = operation === 'republish' ? 'publish' : operation;
      const endpoint = `/api/admin/posts/${post.id}${command === 'delete' ? '' : `/${command}`}`;
      await page.route(`**${endpoint}`, async route => {
        requests++;
        await mutation.promise;
        await route.continue();
      });
      await page.route(/\/api\/admin\/posts(?:\/trash)?\?/, async route => {
        refreshing.release();
        await refresh.promise;
        await route.continue();
      });
      try {
        await page
          .getByRole('button', { name: `${post.title} 작업 메뉴` })
          .click();
        await page.getByRole('button', { name: label, exact: true }).click();
        const section = page.locator('section.admin-content');
        const overlay = section.locator('[data-processing="region"]');
        await expect(overlay).toBeVisible();
        await expect(overlay.getByRole('status')).toContainText('중');
        expect(await overlay.evaluate(el => !!el.closest('[inert]'))).toBe(
          false,
        );
        const bounds = await section.boundingBox();
        const cover = await overlay.boundingBox();
        expect(Math.abs(cover!.x - bounds!.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(cover!.y - bounds!.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(cover!.height - bounds!.height)).toBeLessThanOrEqual(1);
        const heading = await page.locator('.admin-heading').boundingBox();
        expect(cover!.y).toBeGreaterThanOrEqual(heading!.y + heading!.height);
        await expect(page.locator('header')).toHaveAttribute('inert', '');
        expect(
          await section.evaluate(el => {
            const link = el.querySelector('a');
            if (!(link instanceof HTMLElement)) return false;
            link.focus();
            return document.activeElement === link;
          }),
        ).toBe(false);
        await expect(overlay).toHaveCSS('cursor', 'progress');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect(overlay.locator('svg')).toHaveCSS(
          'animation-name',
          'none',
        );
        await page.screenshot({
          path: testInfo.outputPath('list-region.png'),
          fullPage: true,
        });
        mutation.release();
        await expect.poll(() => refreshing.released).toBe(true);
        await expect(overlay).toBeVisible();
        refresh.release();
        await expect(overlay).toHaveCount(0);
        await expect(page.locator('header')).not.toHaveAttribute('inert', '');
        const notice = page.locator('.admin-feedback[data-tone="success"]');
        await expect(notice.locator('.feedback-summary')).toHaveText(summary);
        await expect(notice).toHaveCount(1);
        expect(requests).toBe(1);
        await expect(page).toHaveURL(localD1.origin + origin);
        if (
          ['publish', 'republish', 'archive', 'delete', 'restore'].includes(
            operation,
          )
        )
          await expect(page.locator('.admin-empty')).toBeVisible();
        // Results remain readable without retaining a blocking loader.
        await page.clock.install();
        await page.clock.fastForward(400);
        await expect(notice).toBeVisible();
        await expect(overlay).toHaveCount(0);
      } finally {
        mutation.release();
        refresh.release();
      }
    });
  }
}

test('cancelled list confirmation sends no mutation and never starts loading', async ({
  page,
  api,
  localD1,
}) => {
  const post = (await (
    await api.post('/api/admin/posts', {
      data: { title: 'Cancelled loading', body: 'Body' },
    })
  ).json()) as AdminPost;
  await page.goto(`${localD1.origin}/admin/posts`);
  page.removeAllListeners('dialog');
  page.on('dialog', dialog => dialog.dismiss());
  let mutations = 0;
  page.on('request', request => {
    if (request.url().includes(`/api/admin/posts/${post.id}/publish`))
      mutations++;
  });
  await page.getByRole('button', { name: `${post.title} 작업 메뉴` }).click();
  await page.getByRole('button', { name: '발행', exact: true }).click();
  await page.clock.install();
  await page.clock.runFor(1000);
  await expect(page.locator('[data-processing]')).toHaveCount(0);
  await expect(page.locator('header')).not.toHaveAttribute('inert', '');
  expect(mutations).toBe(0);
  expect(
    (await (await api.get(`/api/admin/posts/${post.id}`)).json()).revision,
  ).toBe(1);
});

for (const width of [1280, 390]) {
  test(`${width}px deleting the last page keeps the region pending through page correction`, async ({
    page,
    api,
    localD1,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (let number = 0; number < 2; number++)
      await api.post('/api/admin/posts', {
        data: { title: `Correct page ${width} ${number}`, body: 'Body' },
      });
    await page.goto(
      `${localD1.origin}/admin/posts?status=draft&page=2&limit=1`,
    );
    const title = await page
      .locator(
        width === 1280
          ? '.post-table tbody a'
          : '.post-cards .card-heading > a',
      )
      .innerText();
    const correction = gate();
    const started = gate();
    const pages: string[] = [];
    await page.route(/\/api\/admin\/posts\?/, async route => {
      const number = new URL(route.request().url()).searchParams.get('page')!;
      pages.push(number);
      if (number === '1') {
        started.release();
        await correction.promise;
      }
      await route.continue();
    });
    try {
      await page.getByRole('button', { name: `${title} 작업 메뉴` }).click();
      await page.getByRole('button', { name: '삭제', exact: true }).click();
      await expect.poll(() => started.released).toBe(true);
      const overlay = page.locator(
        'section.admin-content [data-processing="region"]',
      );
      await expect(overlay).toBeVisible();
      await expect(page.locator('header')).toHaveAttribute('inert', '');
      correction.release();
      await expect(overlay).toHaveCount(0);
      await expect(page).toHaveURL(
        `${localD1.origin}/admin/posts?status=draft&page=1&limit=1`,
      );
      expect(pages).toEqual(['2', '1']);
      await expect(
        page.locator('.admin-feedback[data-tone="success"]'),
      ).toContainText('휴지통으로 이동했습니다.');
      await expect(page.locator('header')).not.toHaveAttribute('inert', '');
    } finally {
      correction.release();
    }
  });
}

for (const outcome of [
  'rejected',
  'conflict',
  'refresh-failed',
  'observed',
  'unresolved',
] as const) {
  test(`list ${outcome} removes processing promptly and retains accurate result feedback`, async ({
    page,
    api,
    localD1,
  }) => {
    const post = (await (
      await api.post('/api/admin/posts', {
        data: { title: `Loading outcome ${outcome}`, body: 'Body' },
      })
    ).json()) as AdminPost;
    await page.goto(`${localD1.origin}/admin/posts`);
    const response = gate();
    let committed = false;
    await page.route(`**/api/admin/posts/${post.id}/publish`, async route => {
      await response.promise;
      if (outcome === 'refresh-failed') return route.continue();
      if (outcome === 'observed' || outcome === 'unresolved') {
        if (outcome === 'observed' && !committed) {
          await api.post(`/api/admin/posts/${post.id}/publish`, {
            data: { expected_revision: 1 },
          });
          committed = true;
        }
        return route.fulfill({ status: 503 });
      }
      await route.fulfill({
        status: outcome === 'conflict' ? 409 : 403,
        json: {
          error: {
            code:
              outcome === 'conflict' ? 'POST_VERSION_CONFLICT' : 'FORBIDDEN',
            message: 'Controlled rejection',
          },
        },
      });
    });
    if (outcome === 'refresh-failed')
      await page.route(/\/api\/admin\/posts\?/, route =>
        route.fulfill({ status: 503 }),
      );
    try {
      await page
        .getByRole('button', { name: `${post.title} 작업 메뉴` })
        .click();
      await page.getByRole('button', { name: '발행', exact: true }).click();
      const overlay = page.locator(
        'section.admin-content [data-processing="region"]',
      );
      await expect(overlay).toBeVisible();
      response.release();
      await expect(overlay).toHaveCount(0);
      const tone =
        outcome === 'rejected'
          ? 'error'
          : outcome === 'conflict'
            ? 'conflict'
            : 'uncertain';
      const notice = page.locator(`.admin-feedback[data-tone="${tone}"]`);
      await expect(notice).toBeVisible();
      await expect(
        page.locator('.admin-feedback[data-tone="success"]'),
      ).toHaveCount(0);
      if (outcome === 'refresh-failed')
        await expect(notice).toContainText('작업은 완료되었습니다.');
      if (outcome === 'observed')
        await expect(notice).toContainText('최신 상태');
      await expect(page.locator('header')).not.toHaveAttribute('inert', '');
      await page.clock.install();
      await page.clock.fastForward(6000);
      await expect(notice).toBeVisible();
    } finally {
      response.release();
    }
  });
}

for (const width of [1280, 390]) {
  for (const editing of [false, true]) {
    test(`${width}px ${editing ? 'save' : 'create'} keeps authoring busy through destination loading`, async ({
      page,
      api,
      localD1,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const post = editing
        ? ((await (
            await api.post('/api/admin/posts', {
              data: { title: `Destination ${width}`, body: 'Body' },
            })
          ).json()) as AdminPost)
        : undefined;
      await page.goto(
        `${localD1.origin}/admin/posts/${post ? `${post.id}/edit` : 'new'}`,
      );
      const editor = page.locator('.ProseMirror');
      await expect(editor).toHaveAttribute('contenteditable', 'true');
      await page
        .getByLabel('제목', { exact: true })
        .fill(`Destination changed ${width} ${editing}`);
      if (!editing) await editor.fill('Body');
      const destination = gate();
      const started = gate();
      await page.route(/\/admin\/posts\/[^/]+\/__data\.json/, async route => {
        started.release();
        await destination.promise;
        await route.continue();
      });
      try {
        await page
          .getByRole('button', {
            name: editing ? '저장' : '초안 생성',
            exact: true,
          })
          .click();
        await expect.poll(() => started.released).toBe(true);
        const overlay = page.locator('.post-inputs [data-processing="region"]');
        await expect(overlay).toBeVisible();
        await expect(page.getByLabel('제목', { exact: true })).toBeDisabled();
        await expect(page.locator('header')).toHaveAttribute('inert', '');
        await page.screenshot({
          path: testInfo.outputPath('authoring-destination.png'),
        });
        destination.release();
        await expect(page.locator('.post-detail')).toBeVisible();
        await expect(overlay).toHaveCount(0);
        await expect(page.locator('header')).not.toHaveAttribute('inert', '');
        await expect(
          page.locator('.admin-feedback[data-tone="success"]'),
        ).toContainText(editing ? '저장되었습니다.' : '초안이 생성되었습니다.');
      } finally {
        destination.release();
      }
    });
  }

  test(`${width}px latest-content reload replaces old conflict with a readable result`, async ({
    page,
    api,
    localD1,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const post = (await (
      await api.post('/api/admin/posts', {
        data: { title: `Reload ${width}`, body: 'Original' },
      })
    ).json()) as AdminPost;
    await page.goto(`${localD1.origin}/admin/posts/${post.id}/edit`);
    await expect(page.locator('.ProseMirror')).toHaveAttribute(
      'contenteditable',
      'true',
    );
    await page.getByLabel('제목', { exact: true }).fill('Local input');
    await api.patch(`/api/admin/posts/${post.id}`, {
      data: { title: 'Concurrent', body: 'Latest body', expected_revision: 1 },
    });
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(
      page.locator('.admin-feedback[data-tone="conflict"]'),
    ).toBeVisible();
    const reload = gate();
    await page.route(`**/api/admin/posts/${post.id}`, async route => {
      await reload.promise;
      await route.continue();
    });
    try {
      await page.getByRole('button', { name: '최신 내용 불러오기' }).click();
      const overlay = page.locator('.post-inputs [data-processing="region"]');
      await expect(overlay).toBeVisible();
      await expect(
        page.locator('.admin-feedback[data-tone="conflict"]'),
      ).toHaveCount(0);
      await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
        'Local input',
      );
      await page.screenshot({ path: testInfo.outputPath('reload-region.png') });
      reload.release();
      await expect(overlay).toHaveCount(0);
      await expect(page.locator('.ProseMirror')).toHaveAttribute(
        'contenteditable',
        'true',
      );
      await expect(page.locator('.ProseMirror')).toContainText('Latest body');
      await expect(
        page.locator('.admin-feedback[data-tone="success"]'),
      ).toContainText('최신 내용을 불러왔습니다.');
      await page.clock.install();
      await page.clock.fastForward(400);
      await expect(
        page.locator('.admin-feedback[data-tone="success"]'),
      ).toBeVisible();
      await expect(page.getByLabel('제목', { exact: true })).toBeEnabled();
    } finally {
      reload.release();
    }
  });
}

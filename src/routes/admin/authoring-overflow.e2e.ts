import { expect } from '@playwright/test';
import type { AdminPost } from '#lib/admin/contracts.ts';
import { test } from '../../../tests/admin/local-d1';

test.beforeEach(async ({ page, localD1 }) => {
  await page.setExtraHTTPHeaders({
    'Cf-Access-Jwt-Assertion': await localD1.token(),
  });
});

for (const width of [1280, 390]) {
  test(`${width}px multiple notices remain usable in a short viewport`, async ({
    page,
    localD1,
  }) => {
    await page.setViewportSize({ width, height: 520 });
    await page.goto(`${localD1.origin}/admin/posts/new?publication=failed`);
    await expect(page.locator('.ProseMirror')).toHaveAttribute(
      'contenteditable',
      'true',
    );
    await page.getByRole('button', { name: '초안 생성', exact: true }).click();
    const notices = page.locator('.post-form .admin-feedback');
    await expect(notices).toHaveCount(2);
    const boxes = await notices.evaluateAll(elements =>
      elements.map(el => {
        const box = el.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom };
      }),
    );
    expect(boxes[1].top - boxes[0].bottom).toBeGreaterThanOrEqual(12);
    for (let count = 2; count > 0; count--) {
      await page.getByRole('button', { name: '안내 닫기' }).last().click();
      await expect(notices).toHaveCount(count - 1);
    }
    await page
      .getByRole('textbox', { name: '제목', exact: true })
      .fill('Retained input');
    const editor = page.locator('.ProseMirror');
    await editor.focus();
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.setData('text/plain', 'pasted'.repeat(150));
      document.querySelector('.ProseMirror')!.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: transfer,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect(editor).toContainText('pasted'.repeat(150));
    await page.keyboard.press('Control+End');
    const caret = await editor.evaluate(el => {
      const range = window.getSelection()!.getRangeAt(0);
      const box = range.getBoundingClientRect();
      const parent = el.getBoundingClientRect();
      return {
        right: box.right,
        left: box.left,
        boundary: parent.right,
        start: parent.left,
        width: el.clientWidth,
        scroll: el.scrollWidth,
      };
    });
    expect(caret.scroll).toBeLessThanOrEqual(caret.width + 1);
    expect(caret.right).toBeLessThanOrEqual(caret.boundary);
    expect(caret.left).toBeGreaterThanOrEqual(caret.start);
    await expect(
      page.getByRole('textbox', { name: '제목', exact: true }),
    ).toHaveValue('Retained input');
    await page.screenshot({
      path: `.wrangler/issue-77/short-${width}.png`,
      fullPage: true,
    });
  });
  for (const route of ['new', 'edit']) {
    test(`${route} ${width}px feedback separates from heading and returns to stable geometry`, async ({
      page,
      api,
      localD1,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const post =
        route === 'edit'
          ? ((await (
              await api.post('/api/admin/posts', {
                data: { title: `Notice ${width}`, body: 'Body' },
              })
            ).json()) as AdminPost)
          : null;
      await page.goto(
        `${localD1.origin}/admin/posts/${post ? `${post.id}/edit` : 'new'}`,
      );
      const editor = page.locator('.admin-editor .ProseMirror');
      await expect(editor).toHaveAttribute('contenteditable', 'true');
      const title = page.getByRole('textbox', { name: '제목', exact: true });
      await title.fill('');
      const geometry = () =>
        page.evaluate(() => {
          const rect = (selector: string) => {
            const el = document.querySelector(selector)!;
            const box = el.getBoundingClientRect();
            return { top: box.top, bottom: box.bottom, height: box.height };
          };
          return {
            heading: rect('.admin-heading'),
            editor: rect('.admin-editor'),
            pageHeight: document.documentElement.scrollHeight,
            notices: [
              ...document.querySelectorAll('.post-form .admin-feedback'),
            ].map(el => {
              const box = el.getBoundingClientRect();
              const summary = el
                .querySelector('.feedback-summary')!
                .getBoundingClientRect();
              const close = el.querySelector('button')!.getBoundingClientRect();
              return {
                top: box.top,
                height: box.height,
                summaryHeight: summary.height,
                closeHeight: close.height,
              };
            }),
          };
        });
      const baseline = await geometry();
      for (let cycle = 0; cycle < 3; cycle++) {
        await page
          .getByRole('button', {
            name: post ? '저장' : '초안 생성',
            exact: true,
          })
          .click();
        await expect(
          page.getByText('제목과 본문을 입력하세요.', { exact: true }),
        ).toBeVisible();
        const shown = await geometry();
        if (cycle === 0)
          await page.screenshot({
            path: `.wrangler/issue-77/${route}-${width}-notice.png`,
            fullPage: true,
          });
        await testInfo.attach(`feedback-${cycle}`, {
          body: JSON.stringify(shown),
          contentType: 'application/json',
        });
        expect
          .soft(shown.notices[0].top - shown.heading.bottom)
          .toBeGreaterThanOrEqual(12);
        // A single-line notice should not be inflated by the standard 42px button minimum.
        expect
          .soft(shown.notices[0].height)
          .toBeLessThanOrEqual(shown.notices[0].summaryHeight + 32);
        expect.soft(shown.notices[0].closeHeight).toBeLessThan(42);
        expect
          .soft(shown.pageHeight)
          .toBeLessThanOrEqual(baseline.pageHeight + 1);
        await page.getByRole('button', { name: '안내 닫기' }).click();
        await expect(page.locator('.post-form .admin-feedback')).toHaveCount(0);
        const dismissed = await geometry();
        expect(dismissed.editor.height).toBeCloseTo(baseline.editor.height, 0);
        expect(dismissed.pageHeight).toBe(baseline.pageHeight);
      }
      await page.screenshot({
        path: `.wrangler/issue-77/${route}-${width}.png`,
        fullPage: true,
      });
    });

    test(`${route} ${width}px wraps long paragraphs and code without horizontal scrolling`, async ({
      page,
      api,
      localD1,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const long = 'longword'.repeat(100);
      const body = `https://example.test/${long}\n\n${long}\n\n\`\`\`typescript\nconst value = '${long}';\n\`\`\``;
      const post = (await (
        await api.post('/api/admin/posts', {
          data: { title: `Overflow ${route} ${width}`, body },
        })
      ).json()) as AdminPost;
      // New route receives real recovery input; edit receives the persisted Markdown.
      if (route === 'new')
        await page.addInitScript(
          copy =>
            localStorage.setItem(
              'blog:admin:new-post-recovery:v1',
              JSON.stringify({
                title: 'Overflow',
                body: copy,
                editedAt: Date.now(),
              }),
            ),
          body,
        );
      await page.goto(
        `${localD1.origin}/admin/posts/${route === 'new' ? 'new' : `${post.id}/edit`}`,
      );
      if (route === 'new') {
        const recovery = page.getByRole('dialog', {
          name: '미저장 작성 내용이 있습니다',
        });
        await recovery.getByText('Overflow', { exact: true }).click();
        await recovery
          .getByRole('button', { name: '확인', exact: true })
          .click();
      }
      await page.locator('.milkdown-code-block').scrollIntoViewIfNeeded();
      await expect(page.locator('.cm-content')).toHaveAttribute(
        'contenteditable',
        'true',
      );
      const bounds = await page
        .locator('.admin-editor, .ProseMirror, .cm-scroller')
        .evaluateAll(elements =>
          elements.map(el => ({
            name: el.className,
            width: el.clientWidth,
            scroll: el.scrollWidth,
            height: el.clientHeight,
            scrollHeight: el.scrollHeight,
          })),
        );
      await testInfo.attach('overflow-baseline', {
        body: JSON.stringify(bounds),
        contentType: 'application/json',
      });
      for (const box of bounds)
        expect(box.scroll, box.name).toBeLessThanOrEqual(box.width + 1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await expect(page.locator('.cm-content')).toContainText(long);
      const code = page.locator('.cm-content');
      await code.click();
      await page.keyboard.press('Control+End');
      await page.keyboard.insertText(' // retained');
      await expect(code).toContainText(`'; // retained`);
      const codeCaret = await code.evaluate(el => {
        const selection = window.getSelection()!;
        const caret = selection.getRangeAt(0).getBoundingClientRect();
        const scroller = el.closest('.cm-scroller')!.getBoundingClientRect();
        const body = el.closest('.ProseMirror')!.getBoundingClientRect();
        return {
          inside: el.contains(selection.anchorNode),
          left: caret.left,
          right: caret.right,
          bottom: caret.bottom,
          start: scroller.left,
          end: scroller.right,
          bodyEnd: body.bottom,
        };
      });
      expect(codeCaret.inside).toBe(true);
      expect(codeCaret.left).toBeGreaterThanOrEqual(codeCaret.start);
      expect(codeCaret.right).toBeLessThanOrEqual(codeCaret.end);
      expect(codeCaret.bottom).toBeLessThanOrEqual(codeCaret.bodyEnd + 1);
      page.once('dialog', dialog => dialog.accept());
      await page
        .getByRole('button', {
          name: route === 'new' ? '초안 생성' : '저장',
          exact: true,
        })
        .click();
      // `/new` also matches a generic final path segment. Wait for persisted detail.
      await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]{36}$/);
      const saved = (await (
        await api.get(
          `/api/admin/posts/${new URL(page.url()).pathname.split('/').pop()}`,
        )
      ).json()) as AdminPost;
      expect(saved.body.match(/```typescript\n([\s\S]*?)\n```/)?.[1]).toBe(
        `const value = '${long}'; // retained`,
      );
    });
  }
}

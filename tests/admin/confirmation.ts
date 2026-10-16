import type { Page } from '@playwright/test';

/** Existing flow tests opt into accepting new mutation prompts. Tests with an
 * explicit dialog handler retain control, including cancellation assertions. */
export function acceptMutationConfirmations(page: Page) {
  const messages = new Set([
    '현재 내용을 저장할까요?',
    '현재 내용을 저장하고 공개할까요?',
    '원래 저장 요청을 다시 시도할까요?',
    '이 게시글을 공개할까요?',
    '이 게시글의 공개를 취소할까요?',
    '게시글을 복구할까요?',
  ]);
  page.on('dialog', async dialog => {
    const emitter = page as Page & { listenerCount(event: string): number };
    if (emitter.listenerCount('dialog') > 1) return;
    if (messages.has(dialog.message())) await dialog.accept();
    else await dialog.dismiss();
  });
}

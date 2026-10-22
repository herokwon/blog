import type { Page } from '@playwright/test';

/** Existing flow tests opt into accepting new mutation prompts. Tests with an
 * explicit dialog handler retain control, including cancellation assertions. */
export function acceptMutationConfirmations(page: Page) {
  const messages = new Set([
    '현재 내용으로 초안을 생성할까요?',
    '현재 내용을 저장할까요?',
    '현재 내용을 저장하고 공개할까요?',
    '원래 저장 요청을 다시 시도할까요?',
    '게시글을 발행할까요?\n공개 목록과 상세 페이지에 표시됩니다.',
    '게시글을 다시 발행할까요?\n다시 공개되며 최초 발행일은 유지됩니다.',
    '게시글을 보관할까요?\n더 이상 공개되지 않습니다.',
    '게시글을 복구할까요?',
  ]);
  page.on('dialog', async dialog => {
    const emitter = page as Page & { listenerCount(event: string): number };
    if (emitter.listenerCount('dialog') > 1) return;
    if (messages.has(dialog.message())) await dialog.accept();
    else await dialog.dismiss();
  });
}

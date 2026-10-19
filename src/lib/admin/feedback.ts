export type FeedbackTone =
  'success' | 'error' | 'conflict' | 'uncertain' | 'warning';

export function successMessage(
  operation: 'create' | 'save' | 'publish' | 'archive' | 'delete' | 'restore',
  republish = false,
): string {
  if (operation === 'publish' && republish) return '재발행되었습니다.';
  return {
    create: '초안이 생성되었습니다.',
    save: '저장되었습니다.',
    publish: '발행되었습니다.',
    archive: '보관되었습니다.',
    delete: '휴지통으로 이동했습니다.',
    restore: '복구되었습니다.',
  }[operation];
}

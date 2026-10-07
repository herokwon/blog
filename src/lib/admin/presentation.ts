import type { PostStatus } from './contracts';

export const statusLabels: Record<PostStatus, string> = {
  draft: '초안',
  published: '발행',
  archived: '공개 취소',
};

export function displayTime(value: string | null): string {
  return value ? value.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC') : '—';
}

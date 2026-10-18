import type { PostStatus } from './contracts';

export const statusLabels: Record<PostStatus, string> = {
  draft: '초안',
  published: '발행',
  archived: '보관',
};

const koreanTime = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function displayTime(value: string | null): string {
  if (value === null) return '—';
  const parts = Object.fromEntries(
    koreanTime
      .formatToParts(new Date(value))
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

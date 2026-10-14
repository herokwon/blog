<script lang="ts">
  import type { FeedbackTone } from './feedback';

  let {
    tone,
    message,
    details = '',
  }: { tone: FeedbackTone; message: string; details?: string } = $props();
  const labels: Record<FeedbackTone, string> = {
    success: '완료',
    error: '실패',
    conflict: '충돌',
    uncertain: '확인 필요',
    warning: '주의',
  };
  const icons: Record<FeedbackTone, string> = {
    success: 'M6.5 12l3.5 3.5 7.5-7.5',
    error: 'M7.5 7.5l9 9 M16.5 7.5l-9 9',
    conflict: 'M4 15V3h11 M9 8h11v13H9Z',
    uncertain: 'M8.5 8.5a3.5 3.5 0 0 1 7 1c0 2.5-3.5 2.5-3.5 5 M12 18h.01',
    warning: 'M12 9v5 M12 18h.01',
  };
</script>

<p class="admin-feedback text-sm" data-tone={tone} role="status">
  <svg
    class="feedback-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {#if tone === 'warning'}<path
        d="M12 3L2 21h20L12 3"
        fill="currentColor"
        stroke="none"
      />
    {:else if tone !== 'conflict'}<circle
        cx="12"
        cy="12"
        r="11"
        fill="currentColor"
        stroke="none"
      />{/if}
    <path
      d={icons[tone]}
      stroke={tone === 'conflict' ? 'currentColor' : 'white'}
    />
  </svg>
  <span class="feedback-content"
    ><span class="sr-only">{labels[tone]}: </span><span class="feedback-summary"
      >{message}</span
    >
    {#if details}<span class="feedback-details">{details}</span>{/if}</span
  >
</p>

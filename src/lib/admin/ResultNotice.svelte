<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { FeedbackTone } from './feedback';

  let {
    tone,
    message,
    details = '',
    ondismiss,
    actions,
  }: {
    tone: FeedbackTone;
    message: string;
    details?: string;
    ondismiss?: () => void;
    actions?: Snippet;
  } = $props();
  let hovered = $state(false);
  let focused = $state(false);
  $effect(() => {
    const currentMessage = message;
    const dismiss = ondismiss;
    if (tone !== 'success' || !dismiss || !currentMessage) return;
    let remaining = 5000;
    $effect(() => {
      if (hovered || focused) return;
      const started = Date.now();
      const timer = setTimeout(dismiss, remaining);
      return () => {
        clearTimeout(timer);
        remaining = Math.max(0, remaining - (Date.now() - started));
      };
    });
  });
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

<div
  class="admin-feedback flex items-start gap-x-3 gap-y-1 rounded-md bg-admin-surface px-4 py-3 text-sm leading-[1.6] text-admin-feedback"
  data-tone={tone}
  role="group"
  aria-label="작업 결과"
  onpointerenter={() => (hovered = true)}
  onpointerleave={() => (hovered = false)}
  onfocusin={() => (focused = true)}
  onfocusout={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
      focused = false;
  }}
>
  <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
    <div class="flex min-w-0 flex-1 basis-80 items-start gap-3">
      <svg
        class="feedback-icon mt-[calc((1lh_-_1.25em)_/_2)] size-[1.25em] shrink-0"
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
      <div class="feedback-content min-w-0 wrap-anywhere">
        <div role="status">
          <span class="sr-only">{labels[tone]}: </span><span
            class="feedback-summary block font-semibold">{message}</span
          >
          {#if details}<span
              class="feedback-details mt-1 block whitespace-pre-line text-admin-muted"
              >{details}</span
            >{/if}
        </div>
      </div>
    </div>
    {#if actions}<div class="ml-[calc(1.25em_+_0.75rem)] shrink-0">
        {@render actions()}
      </div>{/if}
  </div>
  {#if ondismiss}<button
      class="admin-button size-6 min-h-0 shrink-0 border-0 bg-transparent p-1"
      type="button"
      aria-label="안내 닫기"
      onclick={ondismiss}
    >
      <svg
        class="size-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg
      >
    </button>{/if}
</div>

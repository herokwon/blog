<script lang="ts">
  import { onMount } from 'svelte';

  let {
    title,
    editedAt,
    onDecision,
  }: {
    title: string;
    editedAt: number;
    onDecision: (decision: 'restore' | 'discard') => void;
  } = $props();

  let dialog: HTMLDialogElement;
  let decided = false;

  function decide(decision: 'restore' | 'discard') {
    if (decided) return;
    decided = true;
    onDecision(decision);
  }

  onMount(() => {
    dialog.showModal();
    // Closing or unmounting the element is not a user discard decision.
  });
</script>

<dialog
  class="recovery-dialog m-auto max-h-[calc(100%_-_2rem)] w-[min(32rem,calc(100%_-_2rem))] overflow-auto rounded-lg border border-admin-border bg-white p-0 text-admin-ink backdrop:bg-black/40"
  bind:this={dialog}
  aria-labelledby="recovery-heading"
  aria-describedby="recovery-description"
  oncancel={event => {
    event.preventDefault();
    decide('discard');
  }}
  onclick={event => {
    if (event.target === dialog) decide('discard');
  }}
  onkeydown={event => {
    if (event.key !== 'Tab') return;
    const buttons = dialog.querySelectorAll<HTMLButtonElement>('button');
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }}
>
  <div class="recovery-panel relative grid gap-4 p-6 wrap-anywhere">
    <h2 class="pr-8 text-xl leading-[inherit] font-bold" id="recovery-heading">
      미저장 작성 내용이 있습니다
    </h2>
    <p class="recovery-title font-semibold whitespace-pre-wrap">{title}</p>
    <p class="recovery-meta text-sm leading-[inherit] opacity-70">
      마지막 수정: <time datetime={new Date(editedAt).toISOString()}
        >{new Date(editedAt).toLocaleString('ko-KR')}</time
      >
    </p>
    <p id="recovery-description">
      확인하면 이전 내용을 복구합니다. 취소하거나 창을 닫으면 이전 내용이
      삭제됩니다.
    </p>
    <div class="recovery-actions flex justify-end gap-3">
      <button
        class="admin-button action-primary"
        type="button"
        onclick={() => decide('restore')}>확인</button
      >
      <button
        class="admin-button"
        type="button"
        onclick={() => decide('discard')}>취소</button
      >
    </div>
    <button
      type="button"
      class="admin-button recovery-close absolute top-2 right-2 border-0 text-2xl leading-none"
      aria-label="복구 창 닫기"
      onclick={() => decide('discard')}>×</button
    >
  </div>
</dialog>

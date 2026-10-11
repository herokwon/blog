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
  class="recovery-dialog"
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
  <div class="recovery-panel">
    <h2 id="recovery-heading">미저장 작성 내용이 있습니다</h2>
    <p class="recovery-title">{title}</p>
    <p>
      마지막 수정: <time datetime={new Date(editedAt).toISOString()}
        >{new Date(editedAt).toLocaleString('ko-KR')}</time
      >
    </p>
    <p id="recovery-description">
      확인하면 이전 내용을 복구합니다. 취소하거나 창을 닫으면 이전 내용이
      삭제됩니다.
    </p>
    <div class="recovery-actions">
      <button type="button" onclick={() => decide('restore')}>확인</button>
      <button type="button" onclick={() => decide('discard')}>취소</button>
    </div>
    <button
      type="button"
      class="recovery-close"
      aria-label="복구 창 닫기"
      onclick={() => decide('discard')}>×</button
    >
  </div>
</dialog>

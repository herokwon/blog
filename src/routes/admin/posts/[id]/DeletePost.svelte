<script lang="ts">
  import { resolve } from '$app/paths';

  let {
    id,
    version,
    confirming = false,
  }: { id: string; version: number; confirming?: boolean } = $props();
  let dialog: HTMLDialogElement;
  const warning =
    '게시글이 휴지통으로 이동합니다. 휴지통에서 복원할 수 있습니다.';

  function open(event: MouseEvent) {
    if (!dialog?.showModal) return;
    event.preventDefault();
    dialog.showModal();
  }
</script>

{#snippet confirmDelete()}
  <form method="POST" action="?/delete" aria-label="게시글 삭제 확인">
    <input type="hidden" name="version" value={version} />
    <button type="submit">확인</button>
  </form>
{/snippet}

{#if confirming}
  <section aria-label="게시글 삭제">
    <p role="alert">{warning}</p>
    <a href={resolve('/admin/posts/[id]', { id })}>취소</a>
    {@render confirmDelete()}
  </section>
{:else}
  <form method="GET" action={resolve('/admin/posts/[id]', { id })}>
    <button type="submit" name="confirmDelete" value="1" onclick={open}
      >삭제</button
    >
  </form>
{/if}

<dialog
  bind:this={dialog}
  aria-labelledby="delete-title"
  aria-describedby="delete-warning"
>
  <h1 id="delete-title">게시글 삭제</h1>
  <p id="delete-warning">{warning}</p>
  <div class="actions">
    <form method="dialog">
      <button type="submit">취소</button>
    </form>
    {@render confirmDelete()}
  </div>
</dialog>

<style>
  dialog {
    max-inline-size: min(28rem, calc(100% - 3rem));
  }

  dialog:modal {
    overscroll-behavior: contain;
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 45%);
    overflow: hidden;
    overscroll-behavior: contain;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
</style>

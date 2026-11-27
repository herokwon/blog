<script lang="ts">
  import { onMount, tick } from 'svelte';

  import CategoryNameInput from './CategoryNameInput.svelte';

  let {
    categoryId,
    value = '',
    message,
  }: { categoryId?: number; value?: string; message?: string } = $props();
  let modalAvailable = $state(false);
  let dialog = $state<HTMLDialogElement>();
  let invoker = $state<HTMLButtonElement>();
  const editing = $derived(categoryId !== undefined);
  const formId = $derived(`category-${categoryId ?? 'new'}`);
  const title = $derived(editing ? '카테고리 수정' : '카테고리 추가');
  const trigger = $derived(editing ? '수정' : '추가');
  const errorId = $derived(message ? `${formId}-error` : undefined);

  onMount(async () => {
    if (
      typeof HTMLDialogElement === 'undefined' ||
      typeof HTMLDialogElement.prototype.showModal !== 'function'
    )
      return;
    modalAvailable = true;
    await tick();
    if (message && dialog) {
      invoker?.focus();
      dialog.showModal();
    }
  });
</script>

{#snippet nameForm()}
  <form
    method="POST"
    action={editing ? '?/rename' : '?/create'}
    aria-label={title}
  >
    {#if editing}
      <input type="hidden" name="id" value={categoryId} />
    {/if}
    {#if message}
      <p role="alert" id={errorId}>{message}</p>
    {/if}
    <CategoryNameInput id={`${formId}-name`} {value} {errorId} />
    <div class="actions">
      <button type="submit">{trigger}</button>
      {#if modalAvailable}
        <button type="submit" formmethod="dialog" formnovalidate>취소</button>
      {/if}
    </div>
  </form>
{/snippet}

{#if modalAvailable}
  <button type="button" bind:this={invoker} onclick={() => dialog?.showModal()}
    >{trigger}</button
  >
  <dialog bind:this={dialog} aria-labelledby={`${formId}-title`}>
    <h1 id={`${formId}-title`}>{title}</h1>
    {@render nameForm()}
  </dialog>
{:else}
  <details open={!!message}>
    <summary>{trigger}</summary>
    {@render nameForm()}
  </details>
{/if}

<style>
  dialog {
    max-inline-size: min(30rem, calc(100% - 3rem));
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
    gap: 0.5rem;
    margin-block-start: 0.5rem;
  }
</style>

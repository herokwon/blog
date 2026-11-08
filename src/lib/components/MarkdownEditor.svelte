<script lang="ts">
  import { onMount } from 'svelte';
  import type { mountMarkdownEditor } from '#lib/editor/crepe.js';

  let {
    value = $bindable(''),
    readonly = false,
    uploading = $bindable(false),
  }: { value?: string; readonly?: boolean; uploading?: boolean } = $props();
  let root: HTMLDivElement;
  let editor = $state<Awaited<ReturnType<typeof mountMarkdownEditor>>>();
  let failed = $state(false);
  let uploadError = $state('');
  let pendingUploads = 0;
  onMount(() => {
    let cancelled = false;
    const pending = import('#lib/editor/crepe.js')
      .then(async ({ mountMarkdownEditor }) => {
        if (cancelled) return;
        const instance = await mountMarkdownEditor(
          root,
          value,
          markdown => {
            if (!cancelled) value = markdown;
          },
          delta => {
            if (!cancelled) {
              pendingUploads += delta;
              uploading = pendingUploads > 0;
            }
          },
          message => {
            if (!cancelled) uploadError = message;
          },
        );
        if (cancelled) {
          await instance.destroy();
          return;
        }
        instance.setReadonly(readonly);
        editor = instance;
      })
      .catch(() => {
        if (!cancelled) failed = true;
      });
    return () => {
      cancelled = true;
      uploading = false;
      if (editor) void editor.destroy();
      void pending;
    };
  });
  $effect(() => {
    if (editor) {
      editor.setValue(value);
      editor.setReadonly(readonly);
    }
  });
  async function chooseImage(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !editor) return;
    uploadError = '';
    try {
      await editor.insertImage(file);
    } catch (cause) {
      uploadError =
        cause instanceof Error
          ? cause.message
          : 'The image could not be uploaded.';
    } finally {
      input.value = '';
    }
  }
  export function read() {
    return editor?.read() ?? value;
  }
</script>

<div bind:this={root} class="markdown-editor" hidden={!editor}></div>
{#if editor}
  <label
    >Upload image <input
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      disabled={readonly || uploading}
      onchange={chooseImage}
    /></label
  >
  {#if uploading}<p role="status">Uploading image…</p>{/if}
  {#if uploadError}<p role="alert">{uploadError}</p>{/if}
  <details>
    <summary>Markdown source</summary><label
      >Markdown <textarea name="body" rows="12" bind:value {readonly}
      ></textarea></label
    >
  </details>
{:else}
  {#if failed}<p role="status">
      The rich editor could not load. You can continue using Markdown below.
    </p>{/if}
  <label
    >Markdown <textarea name="body" rows="16" bind:value {readonly}
    ></textarea></label
  >
{/if}

<style>
  .markdown-editor {
    border: 1px solid #ccc;
    min-height: 16rem;
  }
  .markdown-editor :global(.milkdown) {
    --crepe-font-default: system-ui, sans-serif;
  }
  .markdown-editor :global(.ProseMirror) {
    min-height: 12rem;
    padding: 1.25rem;
  }
  label {
    display: grid;
    gap: 0.3rem;
    margin-block: 0.8rem;
  }
  textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 0.5rem;
    font: inherit;
    font-family: ui-monospace, monospace;
    resize: vertical;
  }
</style>

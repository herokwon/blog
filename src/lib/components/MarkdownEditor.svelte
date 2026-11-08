<script lang="ts">
  import { onMount } from 'svelte';
  import type { mountMarkdownEditor } from '#lib/editor/crepe.js';

  let {
    value = $bindable(''),
    readonly = false,
  }: { value?: string; readonly?: boolean } = $props();
  let root: HTMLDivElement;
  let editor = $state<Awaited<ReturnType<typeof mountMarkdownEditor>>>();
  let failed = $state(false);
  onMount(() => {
    let cancelled = false;
    const pending = import('#lib/editor/crepe.js')
      .then(async ({ mountMarkdownEditor }) => {
        if (cancelled) return;
        const instance = await mountMarkdownEditor(root, value, markdown => {
          if (!cancelled) value = markdown;
        });
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
  export function read() {
    return editor?.read() ?? value;
  }
</script>

<div bind:this={root} class="markdown-editor" hidden={!editor}></div>
{#if editor}
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

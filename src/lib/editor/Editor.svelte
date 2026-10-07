<script lang="ts">
  import { onMount } from 'svelte';
  import { documentStyleNonce } from './nonce';
  import { inspectMarkdown } from './policy';
  import type { EditorController } from './runtime';

  let {
    source,
    locked = false,
    onchange = () => {},
    onready = () => {},
  }: {
    source: string;
    locked?: boolean;
    onchange?: () => void;
    onready?: (controller: EditorController) => void;
  } = $props();
  // svelte-ignore state_referenced_locally
  const initialSource = source;
  const inspection = inspectMarkdown(initialSource);
  let root: HTMLDivElement;
  let controller = $state<EditorController>();
  let error = $state('');
  $effect(() => {
    controller?.setReadonly(locked);
  });
  onMount(() => {
    if (!inspection.supported) return;
    let disposed = false;
    void import('./runtime')
      .then(async ({ mountEditor }) => {
        const mounted = await mountEditor({
          element: root,
          body: initialSource,
          readonly: false,
          styleNonce: documentStyleNonce(),
          onDocumentChange: () => onchange(),
        });
        if (disposed) {
          await mounted.destroy();
          return;
        }
        mounted.setReadonly(locked);
        controller = mounted;
        onready(mounted);
      })
      .catch(() => {
        if (!disposed)
          error = '편집기를 불러오지 못했습니다. 원문을 보존합니다.';
      });
    return () => {
      disposed = true;
      void controller?.destroy();
    };
  });
</script>

{#if !inspection.supported || error}
  <p role="alert">
    {error || `지원하지 않는 콘텐츠: ${inspection.reasons.join(', ')}`}
  </p>
  <pre class="editor-source">{initialSource}</pre>
{/if}
<div class="admin-editor" class:editor-locked={locked} bind:this={root}></div>

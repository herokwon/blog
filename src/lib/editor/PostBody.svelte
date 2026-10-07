<script lang="ts">
  import { onMount } from 'svelte';
  import { documentStyleNonce } from './nonce';
  import type { EditorController } from './runtime';

  let { source }: { source: string } = $props();
  // svelte-ignore state_referenced_locally
  const initialSource = source;
  let root: HTMLDivElement;
  let error = $state(false);
  onMount(() => {
    let disposed = false;
    let controller: EditorController | undefined;
    void import('./runtime')
      .then(async ({ mountEditor }) => {
        const mounted = await mountEditor({
          element: root,
          body: initialSource,
          readonly: true,
          styleNonce: documentStyleNonce(),
          onDocumentChange: () => {},
        });
        if (disposed) {
          await mounted.destroy();
          return;
        }
        controller = mounted;
      })
      .catch(() => {
        if (!disposed) error = true;
      });
    return () => {
      disposed = true;
      void controller?.destroy();
    };
  });
</script>

{#if error}<pre class="editor-source">{initialSource}</pre>{/if}
<div class="admin-reading" bind:this={root}></div>

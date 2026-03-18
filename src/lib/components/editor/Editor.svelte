<script lang="ts">
  import { onMount } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  import { createMilkdownEditor } from './config';

  type Props = HTMLAttributes<HTMLDivElement> & {
    content: string;
    readOnly?: boolean;
  };

  let {
    content = $bindable(),
    readOnly = false,
    class: className,
    ...divProps
  }: Props = $props();

  let editorElement: HTMLElement | null = null;

  const focusEditorOnContainerMouseDown = (event: MouseEvent) => {
    if (readOnly) return;

    const target = event.target;
    const editable = editorElement?.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    if (!(target instanceof Node) || !editable) return;
    if (target && editable.contains(target)) return;

    event.preventDefault();
    editable.focus();
  };

  onMount(async () => {
    if (editorElement) {
      await createMilkdownEditor({
        root: editorElement,
        defaultValue: content,
        readOnly,
        onChange: (markdown: string) => {
          content = markdown;
        },
      });

      if (readOnly) return;
      editorElement
        ?.querySelector('[contenteditable="true"]')
        ?.setAttribute('aria-label', 'content');
    }
  });
</script>

<div
  {...divProps}
  class={['milkdown-container', className].filter(Boolean).join(' ')}
  onmousedown={focusEditorOnContainerMouseDown}
>
  <div bind:this={editorElement} class="milkdown-editor prose"></div>
</div>

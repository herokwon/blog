<script lang="ts">
  import { onMount } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  import {
    createVideoBlockNodeView,
    videoBlockSchema,
  } from '$lib/milkdown/videoBlock';
  import {
    useNodeViewFactory,
    useProsemirrorAdapterProvider,
  } from '@prosemirror-adapter/svelte';

  import { createMilkdownEditor } from './config';
  import type { EditorAssetEventHandlers } from './types';

  type Props = HTMLAttributes<HTMLDivElement> &
    Partial<EditorAssetEventHandlers> & {
      content: string;
      readOnly?: boolean;
    };

  let {
    content = $bindable(),
    readOnly = false,
    onImageAdd,
    onImageError,
    onVideoAdd,
    onVideoError,
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
      useProsemirrorAdapterProvider();

      const nodeViewFactory = useNodeViewFactory();

      const videoBlockNodeView = createVideoBlockNodeView(nodeViewFactory);

      await createMilkdownEditor({
        root: editorElement,
        defaultValue: content,
        readOnly,
        nodes: [videoBlockSchema],
        nodeViews: [videoBlockNodeView],
        onChange: (markdown: string) => {
          content = markdown;
        },
        onImageAdd,
        onImageError,
        onVideoAdd,
        onVideoError,
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

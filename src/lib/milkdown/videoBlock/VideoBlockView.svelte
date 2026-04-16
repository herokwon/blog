<script lang="ts">
  import { useNodeViewContext } from '@prosemirror-adapter/svelte';

  const node = useNodeViewContext('node');
  const selected = useNodeViewContext('selected');
  const { src, mimeType, poster } = $node.attrs;
</script>

<div class="video-block" class:selected={$selected}>
  <video controls poster={poster || undefined} playsinline>
    <source {src} type={mimeType} />
    <track kind="captions" />
    <p>Your browser does not support the video tag</p>
  </video>
</div>

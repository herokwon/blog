<script lang="ts">
  import '#lib/reader-typography.css';
  import favicon from '#lib/assets/favicon.svg';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

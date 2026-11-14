<script lang="ts">
  import { publicIndexable } from '#lib/site.js';
  import { page } from '$app/state';
  import '#lib/reader-typography.css';
  import favicon from '#lib/assets/favicon.svg';
  import type { LayoutProps } from './$types';

  let { children, data }: LayoutProps = $props();
</script>

<svelte:head>
  {#if !publicIndexable(data.production, page.url, page.status)}<meta
      name="robots"
      content="noindex, nofollow"
    />{/if}
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

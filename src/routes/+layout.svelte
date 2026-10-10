<script lang="ts">
  import './layout.css';
  import favicon from '#lib/assets/favicon.svg';
  import { page } from '$app/state';

  let { children } = $props();
</script>

<svelte:head>
  {#if !page.url.pathname.startsWith('/admin')}
    <link rel="icon" href={favicon} />
  {/if}
</svelte:head>
{@render children()}

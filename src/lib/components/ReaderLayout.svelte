<script lang="ts">
  import type { Snippet } from 'svelte';
  import { resolve } from '$app/paths';

  let { children }: { children: Snippet } = $props();
</script>

<svelte:head
  ><link
    rel="alternate"
    type="application/rss+xml"
    title="Personal Blog RSS"
    href={resolve('/rss.xml')}
  /></svelte:head
>
<div class="reader">
  <header>
    <a href={resolve('/')}>Personal Blog</a><a href={resolve('/rss.xml')}>RSS</a
    >
  </header>
  <main>{@render children()}</main>
</div>

<style>
  .reader {
    max-width: 48rem;
    margin: auto;
    padding: 1.5rem;
    color: #202124;
    font-family: system-ui, sans-serif;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: space-between;
    border-bottom: 1px solid #ddd;
    padding-bottom: 1rem;
    margin-bottom: 2rem;
  }
  a,
  .reader :global(a) {
    color: #174e9e;
    text-underline-offset: 0.15em;
  }
  .reader :global(img) {
    max-width: 100%;
    height: auto;
  }
  .reader :global(pre) {
    overflow-x: auto;
    padding: 1rem;
    background: #f4f4f4;
    border-radius: 0.25rem;
  }
  .reader :global(blockquote) {
    border-left: 0.2rem solid #ccc;
    margin-inline: 0;
    padding-left: 1rem;
  }
  .reader :global(table) {
    border-collapse: collapse;
  }
  .reader :global(th),
  .reader :global(td) {
    border: 1px solid #ccc;
    padding: 0.4rem 0.7rem;
  }
</style>

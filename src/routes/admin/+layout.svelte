<script lang="ts">
  import { resolve } from '$app/paths';
  import type { LayoutProps } from './$types';

  let { data, children }: LayoutProps = $props();
</script>

<svelte:head><meta name="robots" content="noindex, nofollow" /></svelte:head>

<header>
  <strong>Administration</strong>
  <nav aria-label="Administrator navigation">
    <a href={resolve('/admin/posts')}>Posts</a>
    <a href={resolve('/admin/categories')}>Categories</a>
    <a href={resolve('/')}>View blog</a>
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- Access owns this root endpoint, outside SvelteKit routing. -->
    <a href="/cdn-cgi/access/logout" data-sveltekit-reload>Sign out of Access</a
    >
  </nav>
  <p>Signed in as {data.author.email}</p>
</header>
<main>{@render children()}</main>

<style>
  header,
  main {
    max-width: 64rem;
    margin: auto;
    padding: 1.5rem;
    font-family: system-ui, sans-serif;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 1rem;
  }
  main :global(label) {
    min-width: 0;
    max-width: 100%;
  }
  main :global(input),
  main :global(select),
  main :global(textarea),
  main :global(button),
  main :global(fieldset) {
    box-sizing: border-box;
    min-width: 0;
    max-width: 100%;
  }
  main :global(:focus-visible),
  header :global(:focus-visible) {
    outline: 3px solid #174e9e;
    outline-offset: 3px;
  }
  main :global([role='alert']:focus) {
    outline: 3px solid #174e9e;
    outline-offset: 3px;
  }
  a {
    color: #174e9e;
  }
</style>

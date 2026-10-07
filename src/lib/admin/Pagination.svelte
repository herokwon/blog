<script lang="ts">
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { pageNumbers } from './pagination';

  let {
    current,
    total,
    trash = false,
  }: { current: number; total: number; trash?: boolean } = $props();
  let path = $derived(
    trash ? ('/admin/posts/trash' as const) : ('/admin/posts' as const),
  );
  function queryString(number: number): `?${string}` {
    const query = new SvelteURLSearchParams(page.url.searchParams);
    query.set('page', String(number));
    return `?${query}`;
  }
</script>

{#if total > 0}
  <nav class="admin-pagination" aria-label="페이지">
    {#if current > 1}<a
        href={resolve(`${path}${queryString(current - 1)}`)}
        aria-label="이전 페이지">‹</a
      >
    {:else}<button disabled aria-label="이전 페이지">‹</button>{/if}
    <div class="page-numbers">
      {#each pageNumbers(current, total) as number (number)}
        <a
          href={resolve(`${path}${queryString(number)}`)}
          aria-label={`${number} 페이지`}
          aria-current={number === current ? 'page' : undefined}>{number}</a
        >
      {/each}
    </div>
    {#if current < total}<a
        href={resolve(`${path}${queryString(current + 1)}`)}
        aria-label="다음 페이지">›</a
      >
    {:else}<button disabled aria-label="다음 페이지">›</button>{/if}
  </nav>
{/if}

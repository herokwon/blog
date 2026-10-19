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
    const query = new SvelteURLSearchParams(page.url.searchParams.toString());
    query.set('page', String(number));
    return `?${query}`;
  }
</script>

{#snippet arrow(direction: 'previous' | 'next')}
  <svg
    class="size-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d={direction === 'previous' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
  </svg>
{/snippet}

{#if total > 0}
  <nav
    class="admin-pagination mt-6 flex items-center justify-center gap-2"
    aria-label="페이지"
  >
    {#if current > 1}<a
        class="admin-button admin-button-page"
        href={resolve(`${path}${queryString(current - 1)}`)}
        aria-label="이전 페이지">{@render arrow('previous')}</a
      >
    {:else}<button
        class="admin-button admin-button-page"
        disabled
        aria-label="이전 페이지">{@render arrow('previous')}</button
      >{/if}
    <div class="page-numbers flex">
      {#each pageNumbers(current, total) as number (number)}
        <a
          class="admin-button admin-button-page aria-[current=page]:bg-admin-selected aria-[current=page]:font-bold"
          href={resolve(`${path}${queryString(number)}`)}
          aria-label={`${number} 페이지`}
          aria-current={number === current ? 'page' : undefined}>{number}</a
        >
      {/each}
    </div>
    {#if current < total}<a
        class="admin-button admin-button-page"
        href={resolve(`${path}${queryString(current + 1)}`)}
        aria-label="다음 페이지">{@render arrow('next')}</a
      >
    {:else}<button
        class="admin-button admin-button-page"
        disabled
        aria-label="다음 페이지">{@render arrow('next')}</button
      >{/if}
  </nav>
{/if}

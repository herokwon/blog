<script lang="ts">
  import { resolve } from '$app/paths';

  import type { PublishedPostSummary } from '../../lib/server/db/public-posts';
  import PublishedDate from './PublishedDate.svelte';
  import TopicLinks from './TopicLinks.svelte';

  let {
    posts,
    collectionHref,
    pageNumber,
    hasNext,
  }: {
    posts: PublishedPostSummary[];
    collectionHref: string;
    pageNumber: number;
    hasNext: boolean;
  } = $props();
</script>

{#if posts.length}
  <ol>
    {#each posts as post (post.id)}
      <li>
        <h2>
          <a
            href={resolve('/(public)/posts/[id]', { id: post.id })}
            data-sveltekit-preload-data="false"
          >
            {post.title}
          </a>
        </h2>
        <div class="metadata">
          {#if post.publishedAt}
            <PublishedDate value={post.publishedAt} />
          {/if}
          <TopicLinks
            categories={[{ id: post.categoryId, name: post.categoryName }]}
            tags={post.tags}
          />
        </div>
      </li>
    {/each}
  </ol>
{:else}
  <p>아직 발행된 글이 없습니다.</p>
{/if}

{#if pageNumber > 1 || hasNext}
  <!-- eslint-disable svelte/no-navigation-without-resolve -- The parent resolves the collection path. -->
  <nav aria-label="글 목록 페이지">
    {#if pageNumber > 1}
      <a
        href={pageNumber === 2
          ? collectionHref
          : `${collectionHref}?page=${pageNumber - 1}`}
        data-sveltekit-preload-data="false">이전</a
      >
    {/if}
    <span>{pageNumber}페이지</span>
    {#if hasNext}
      <a
        href={`${collectionHref}?page=${pageNumber + 1}`}
        data-sveltekit-preload-data="false">다음</a
      >
    {/if}
  </nav>
  <!-- eslint-enable svelte/no-navigation-without-resolve -->
{/if}

<style>
  ol {
    padding-inline-start: 1.5rem;
  }

  li {
    margin-block: 1rem;
  }

  h2 {
    margin-block: 0 0.25rem;
    font-size: 1.125rem;
  }

  nav,
  .metadata {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
</style>

<script lang="ts">
  import PublishedDate from '../../PublishedDate.svelte';
  import TopicLinks from '../../TopicLinks.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const post = $derived(data.post);
</script>

<svelte:head>
  <title>{post.title} | 블로그</title>
</svelte:head>

<main>
  <h1>{post.title}</h1>
  <div class="metadata">
    {#if post.publishedAt}
      <PublishedDate value={post.publishedAt} />
    {/if}
    <TopicLinks
      categories={[{ id: post.categoryId, name: post.categoryName }]}
      tags={post.tags}
    />
  </div>
  <article aria-label="게시글 본문">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- The server renderer sanitizes this HTML. -->
    {@html post.html}
  </article>
</main>

<style>
  .metadata {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  article {
    line-height: 1.65;
    margin-block-start: 2rem;
  }

  article :global(pre),
  article :global(.article-table) {
    overflow-x: auto;
    max-inline-size: 100%;
  }

  article :global(pre) {
    padding: 0.75rem;
    background: color-mix(in srgb, CanvasText 6%, Canvas);
  }

  article :global(table) {
    border-collapse: collapse;
    overflow-wrap: normal;
  }

  article :global(:is(th, td)) {
    border: 1px solid GrayText;
    padding: 0.25rem 0.5rem;
  }

  article :global(img) {
    max-inline-size: 100%;
    block-size: auto;
  }
</style>

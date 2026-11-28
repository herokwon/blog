<script lang="ts">
  import type { PublishedPostSummary } from '../../lib/server/db/public-posts';
  import PostList from './PostList.svelte';

  let {
    title,
    posts,
    collectionHref,
    pageNumber,
    hasNext,
  }: {
    title: string;
    posts: PublishedPostSummary[];
    collectionHref: string;
    pageNumber: number;
    hasNext: boolean;
  } = $props();
</script>

<svelte:head>
  <title>{title} | 블로그</title>
</svelte:head>

<main>
  <h1>{title}</h1>
  <PostList {posts} {collectionHref} {pageNumber} {hasNext} />
</main>

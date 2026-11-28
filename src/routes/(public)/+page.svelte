<script lang="ts">
  import { resolve } from '$app/paths';

  import type { PageProps } from './$types';
  import PostList from './PostList.svelte';
  import TopicLinks from './TopicLinks.svelte';

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>최신 글 | 블로그</title>
</svelte:head>

<main>
  <h1>최신 글</h1>
  {#if data.topics.categories.length || data.topics.tags.length}
    <nav aria-label="글 주제">
      <TopicLinks {...data.topics} />
    </nav>
  {/if}
  <PostList
    posts={data.posts}
    pageNumber={data.pageNumber}
    hasNext={data.hasNext}
    collectionHref={resolve('/(public)')}
  />
</main>

<style>
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
</style>

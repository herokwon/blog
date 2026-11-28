<script lang="ts">
  import { resolve } from '$app/paths';

  import type { PageProps } from './$types';
  import PostList from './PostList.svelte';

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>최신 글 | 블로그</title>
</svelte:head>

<main>
  <h1>최신 글</h1>
  <PostList {...data} collectionHref={resolve('/(public)')} />
</main>

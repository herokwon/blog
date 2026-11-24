<script lang="ts">
  import { resolve } from '$app/paths';

  import PostForm from '../../PostForm.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
  const values = $derived(
    form?.values ??
      (data.post && {
        id: data.post.id,
        title: data.post.title,
        body: data.post.body,
        categoryId: String(data.post.categoryId),
        tags: data.post.tags.join(', '),
        version: String(data.post.version),
      }),
  );
</script>

<svelte:head>
  <title>게시글 수정</title>
</svelte:head>

<main lang="ko">
  <h1>게시글 수정</h1>
  {#if values}
    <PostForm
      categories={data.categories}
      {values}
      errors={form?.errors}
      message={form?.message}
    />
  {:else}
    <p>게시글을 불러오지 못했습니다.</p>
    <p><a href={resolve('/admin/posts')}>게시글 목록</a></p>
  {/if}
</main>

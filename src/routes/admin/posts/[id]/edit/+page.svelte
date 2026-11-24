<script lang="ts">
  import { page } from '$app/state';

  import AdminHeading from '../../../AdminHeading.svelte';
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
  <AdminHeading title="게시글 수정" postId={page.params.id} />
  {#if values}
    {#key values.id}
      <PostForm
        categories={data.categories}
        {values}
        existingTags={data.post?.tags}
        errors={form?.errors}
        message={form?.message}
      />
    {/key}
  {:else}
    <p>게시글을 불러오지 못했습니다.</p>
  {/if}
</main>

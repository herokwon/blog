<script lang="ts">
  import { resolve } from '$app/paths';

  import AdminHeading from '../../AdminHeading.svelte';
  import PostForm from '../PostForm.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<svelte:head>
  <title>새 게시글</title>
</svelte:head>

<main lang="ko">
  <AdminHeading title="새 게시글" />
  {#if data.categories?.length || form}
    <PostForm
      creating
      categories={data.categories}
      values={form?.values ?? {
        id: data.id,
        title: '',
        body: '',
        tags: '',
        categoryId: '',
      }}
      errors={form?.errors}
      message={form?.message}
    />
  {:else}
    {#if data.categories === null}
      <p>카테고리 목록을 불러오지 못했습니다.</p>
    {/if}
    <p><a href={resolve('/admin/posts')}>게시글 목록</a></p>
  {/if}
  {#if data.categories?.length === 0}
    <p>
      게시글을 쓰려면 먼저 <a href={resolve('/admin/categories')}
        >카테고리를 추가</a
      >해 주세요.
    </p>
  {/if}
</main>

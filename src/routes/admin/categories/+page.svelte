<script lang="ts">
  import { resolve } from '$app/paths';

  import type { PageProps } from './$types';
  import CategoryNameInput from './CategoryNameInput.svelte';

  let { data, form }: PageProps = $props();
  let errorSummary = $state<HTMLParagraphElement>();
  $effect(() => {
    if (form?.error) errorSummary?.focus();
  });
</script>

<svelte:head>
  <title>카테고리 관리</title>
</svelte:head>

<main lang="ko">
  <h1>카테고리 관리</h1>
  <p><a href={resolve('/admin/posts')}>게시글 목록</a></p>
  {#if form?.error}
    <p id="category-error" role="alert" tabindex="-1" bind:this={errorSummary}>
      {form.error}
    </p>
  {/if}
  {#if data.categories === null}
    <p>카테고리 목록을 불러오지 못했습니다.</p>
  {:else if data.categories.length}
    <ul>
      {#each data.categories as category (category.id)}
        {@const renaming =
          form?.id === String(category.id) && form?.name !== undefined}
        <li>
          <strong>{category.name}</strong> · 게시글 {category.postCount}개
          <details open={renaming}>
            <summary>이름 변경</summary>
            <form
              method="POST"
              action="?/rename"
              aria-label={`${category.name} 이름 변경`}
            >
              <input type="hidden" name="id" value={category.id} />
              <CategoryNameInput
                id={`name-${category.id}`}
                value={renaming ? form?.name : category.name}
                invalid={renaming}
              />
              <button type="submit">이름 저장</button>
            </form>
          </details>
          {#if category.referenceCount === 0}
            <details>
              <summary>삭제</summary>
              <form
                method="POST"
                action="?/remove"
                aria-label={`${category.name} 삭제`}
              >
                <input type="hidden" name="id" value={category.id} />
                <button type="submit">카테고리 삭제 확인</button>
              </form>
            </details>
          {:else if category.postCount === 0}
            <small>휴지통의 게시글에서 사용 중</small>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p>게시글을 쓰려면 먼저 카테고리를 추가해 주세요.</p>
  {/if}
  <form method="POST" action="?/create" aria-label="카테고리 추가">
    <CategoryNameInput
      id="name"
      value={form?.id === undefined ? form?.name : ''}
      invalid={!!form?.error && form.id === undefined}
    />
    <button type="submit">카테고리 추가</button>
  </form>
</main>

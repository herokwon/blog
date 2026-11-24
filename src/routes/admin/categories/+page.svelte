<script lang="ts">
  import { resolve } from '$app/paths';

  import type { PageProps } from './$types';

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
  {#if data.categories === null}
    <p>카테고리 목록을 불러오지 못했습니다.</p>
  {:else if data.categories.length}
    <ul>
      {#each data.categories as category (category.id)}
        <li>{category.name}</li>
      {/each}
    </ul>
  {:else}
    <p>게시글을 쓰려면 먼저 카테고리를 추가해 주세요.</p>
  {/if}
  <form method="POST" action="?/create">
    {#if form?.error}
      <p
        id="category-error"
        role="alert"
        tabindex="-1"
        bind:this={errorSummary}
      >
        {form.error}
      </p>
    {/if}
    <label for="name">카테고리 이름 (필수)</label>
    <input
      id="name"
      name="name"
      value={form?.name ?? ''}
      required
      aria-invalid={form?.error ? true : undefined}
      aria-describedby={form?.error ? 'category-error' : undefined}
    />
    <button type="submit">카테고리 추가</button>
  </form>
</main>

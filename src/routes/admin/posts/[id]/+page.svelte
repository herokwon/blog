<script lang="ts">
  import { resolve } from '$app/paths';

  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
  const post = $derived(data.post);
  let errorSummary = $state<HTMLParagraphElement>();
  const states = {
    draft: { label: '초안', next: '발행', action: '?/publish' },
    published: { label: '발행됨', next: '발행취소', action: '?/archive' },
    archived: { label: '보관됨', next: '재발행', action: '?/publish' },
  };
  $effect(() => {
    if (form?.error) errorSummary?.focus();
  });
</script>

<svelte:head>
  <title>{data.post?.title ?? '게시글 상세'}</title>
</svelte:head>

<main lang="ko">
  <h1>{post?.title ?? '게시글 상세'}</h1>
  {#if post}
    {@const state = states[post.status]}
    <div class="actions">
      <form method="POST" action={state.action} aria-label="게시글 상태 변경">
        <input type="hidden" name="version" value={post.version} />
        <button type="submit">{state.next}</button>
      </form>
      <a href={resolve('/admin/posts/[id]/edit', { id: post.id })}>수정</a>
      <details>
        <summary>삭제</summary>
        <form method="POST" action="?/delete" aria-label="게시글 삭제 확인">
          <input type="hidden" name="version" value={post.version} />
          <button type="submit">휴지통으로 이동</button>
        </form>
      </details>
    </div>
  {/if}
  {#if form?.error}
    <p role="alert" tabindex="-1" bind:this={errorSummary}>{form.error}</p>
  {/if}
  {#if post}
    <dl>
      <dt>상태</dt>
      <dd>{states[post.status].label}</dd>
      <dt>카테고리</dt>
      <dd>{post.categoryName}</dd>
      {#if post.tags.length}
        <dt>태그</dt>
        <dd>{post.tags.join(', ')}</dd>
      {/if}
    </dl>
    <article aria-label="게시글 본문">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- The server renderer sanitizes this HTML. -->
      {@html post.html}
    </article>
  {/if}
  <p><a href={resolve('/admin/posts')}>게시글 목록</a></p>
</main>

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.75rem;
  }
</style>

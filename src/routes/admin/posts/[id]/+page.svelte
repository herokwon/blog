<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';

  import AdminHeading from '../../AdminHeading.svelte';
  import { postStatusLabels } from '../../post-status';
  import PostTime from '../../PostTime.svelte';
  import type { PageProps } from './$types';
  import DeletePost from './DeletePost.svelte';

  let { data, form }: PageProps = $props();
  const post = $derived(data.post);
  let errorSummary = $state<HTMLParagraphElement>();
  const states = {
    draft: { next: '발행', action: '?/publish' },
    published: { next: '발행취소', action: '?/archive' },
    archived: { next: '재발행', action: '?/publish' },
  };
  $effect(() => {
    if (form?.error) errorSummary?.focus();
  });
</script>

<svelte:head>
  <title>{data.post?.title ?? '게시글 상세'}</title>
</svelte:head>

<main lang="ko">
  <AdminHeading title={post?.title ?? '게시글 상세'} />
  {#if post}
    {@const state = states[post.status]}
    <div class="actions">
      <form method="POST" action={state.action} aria-label="게시글 상태 변경">
        <input type="hidden" name="version" value={post.version} />
        <button type="submit">{state.next}</button>
      </form>
      <a href={resolve('/admin/posts/[id]/edit?from=detail', { id: post.id })}
        >수정</a
      >
      <DeletePost
        id={post.id}
        version={post.version}
        confirming={page.url.searchParams.has('confirmDelete')}
      />
    </div>
  {/if}
  {#if form?.error}
    <p role="alert" tabindex="-1" bind:this={errorSummary}>{form.error}</p>
  {/if}
  {#if post}
    <dl>
      <dt>상태</dt>
      <dd>{postStatusLabels[post.status]}</dd>
      <dt>카테고리</dt>
      <dd>{post.categoryName}</dd>
      {#if post.tags.length}
        <dt>태그</dt>
        <dd>{post.tags.join(', ')}</dd>
      {/if}
      <dt>생성 시각</dt>
      <dd><PostTime value={post.createdAt} /></dd>
      {#if post.publishedAt}
        <dt>최초 발행 시각</dt>
        <dd><PostTime value={post.publishedAt} /></dd>
      {/if}
      <dt>최종 변경 시각</dt>
      <dd><PostTime value={post.updatedAt} /></dd>
    </dl>
    <article aria-label="게시글 본문">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- The server renderer sanitizes this HTML. -->
      {@html post.html}
    </article>
  {/if}
</main>

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.75rem;
  }
</style>

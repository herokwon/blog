<script lang="ts">
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import { beforeNavigate, goto, refreshAll } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { AdminPostPage, PostStatus } from './contracts';
  import type { FeedbackTone } from './feedback';
  import { pageAfterMutation } from './pagination';
  import Pagination from './Pagination.svelte';
  import PostActions from './PostActions.svelte';
  import { displayTime, statusLabels } from './presentation';
  import ProcessingIndicator from './ProcessingIndicator.svelte';
  import ResultNotice from './ResultNotice.svelte';

  let {
    posts,
    status,
    trash = false,
  }: { posts: AdminPostPage; status?: PostStatus; trash?: boolean } = $props();
  const filters = [undefined, 'draft', 'published', 'archived'] as const;
  const actionState = $state({
    busy: false,
    message: '',
    operation: '처리 중…',
    tone: 'success' as FeedbackTone,
    details: '',
  });
  let correction: string | undefined;
  function openItem(event: MouseEvent, id: string) {
    if (actionState.busy) {
      event.preventDefault();
      return;
    }
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      (event.target as Element).closest('a, button, .post-actions') ||
      window.getSelection()?.toString()
    )
      return;
    void goto(resolve('/admin/posts/[id]', { id }));
  }
  beforeNavigate(navigation => {
    const destination = navigation.to?.url;
    if (
      actionState.busy &&
      (!destination || destination.pathname + destination.search !== correction)
    )
      navigation.cancel();
  });
  let path = $derived(
    trash ? ('/admin/posts/trash' as const) : ('/admin/posts' as const),
  );
  function queryString(
    filter: PostStatus | undefined,
    number = 1,
  ): `?${string}` {
    const query = new SvelteURLSearchParams();
    if (filter) query.set('status', filter);
    query.set('page', String(number));
    query.set('limit', String(posts.limit));
    return `?${query}`;
  }
  async function refresh(publishedId?: string) {
    await refreshAll();
    const number = pageAfterMutation(posts.page, posts.totalPages);
    if (publishedId || number !== posts.page) {
      const destination = publishedId
        ? resolve('/admin/posts/[id]', { id: publishedId })
        : resolve(`${path}${queryString(status, number)}`);
      correction = destination;
      try {
        await goto(destination);
      } finally {
        correction = undefined;
      }
    }
  }
</script>

<svelte:head><title>{trash ? '휴지통' : '게시글'} · Admin</title></svelte:head>
<div class="admin-heading">
  <h1 class="admin-title">{trash ? '휴지통' : '게시글'}</h1>
  <div
    class="heading-actions flex flex-wrap items-center gap-3"
    inert={actionState.busy}
  >
    {#if trash}<a class="admin-button" href={resolve('/admin/posts')}
        >게시글 목록</a
      >
    {:else}
      <a class="admin-button" href={resolve('/admin/posts/new')}>글쓰기</a>
      <a
        class="admin-button trash-link"
        href={resolve('/admin/posts/trash')}
        aria-label="휴지통"
      >
        <svg
          class="size-5 fill-none stroke-current stroke-[1.5]"
          aria-hidden="true"
          viewBox="0 0 24 24"
          ><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" /></svg
        >
      </a>
    {/if}
  </div>
</div>
<section
  class="admin-content flex-1 pt-6"
  aria-label={trash ? '삭제한 게시글' : '게시글 목록'}
>
  <ProcessingIndicator
    active={actionState.busy}
    message={actionState.operation}
  />
  {#if !actionState.busy && actionState.message}<ResultNotice
      tone={actionState.tone}
      message={actionState.message}
      details={actionState.details}
      ondismiss={() => (actionState.message = '')}
    />{/if}
  {#if !trash}
    <nav
      class="post-filters mb-5 flex gap-2"
      aria-label="상태 필터"
      inert={actionState.busy}
    >
      {#each filters as filter (filter)}
        <a
          class="rounded-md border border-transparent px-2.5 py-1.5 hover:bg-admin-surface aria-current:border-admin-filter aria-current:font-bold"
          href={resolve(`${path}${queryString(filter)}`)}
          aria-current={filter === status ? 'true' : undefined}
          >{filter ? statusLabels[filter] : '전체'}</a
        >
      {/each}
    </nav>
  {/if}
  {#if posts.items.length === 0}
    <p class="admin-empty py-12 text-center text-admin-muted">
      {trash ? '휴지통이 비어 있습니다.' : '게시글이 없습니다.'}
    </p>
  {:else}
    <table
      class="post-table hidden w-full border-collapse text-left text-sm leading-[inherit] md:table"
    >
      <thead
        ><tr
          ><th class="border-b border-admin-divider px-2 py-3">제목</th><th
            class="border-b border-admin-divider px-2 py-3">상태</th
          ><th class="border-b border-admin-divider px-2 py-3">작성</th><th
            class="border-b border-admin-divider px-2 py-3">발행</th
          ><th class="border-b border-admin-divider px-2 py-3"
            >{trash ? '삭제' : '수정'}</th
          ><th class="border-b border-admin-divider px-2 py-3"
            ><span class="sr-only">작업</span></th
          ></tr
        ></thead
      >
      <tbody>
        {#each posts.items as post (post.id)}
          <!-- Real title anchors provide keyboard and native link navigation. -->
          <tr
            class="group cursor-pointer"
            onclick={event => openItem(event, post.id)}
          >
            <td
              class="border-b border-admin-divider px-2 py-3 first:w-[30%] first:wrap-anywhere"
              ><a
                class="focus-visible:underline [@media(hover:hover)]:group-hover:underline"
                href={resolve('/admin/posts/[id]', { id: post.id })}
                >{post.title}</a
              ></td
            >
            <td
              class="border-b border-admin-divider px-2 py-3 first:w-[30%] first:wrap-anywhere"
              >{statusLabels[post.status]}</td
            >
            <td
              class="border-b border-admin-divider px-2 py-3 first:w-[30%] first:wrap-anywhere"
              ><time
                class="text-xs leading-[inherit] text-admin-muted"
                datetime={post.created_at}>{displayTime(post.created_at)}</time
              ></td
            >
            <td
              class="border-b border-admin-divider px-2 py-3 first:w-[30%] first:wrap-anywhere"
              ><time
                class="text-xs leading-[inherit] text-admin-muted"
                datetime={post.published_at ?? undefined}
                >{displayTime(post.published_at)}</time
              ></td
            >
            <td
              class="border-b border-admin-divider px-2 py-3 first:w-[30%] first:wrap-anywhere"
              ><time
                class="text-xs leading-[inherit] text-admin-muted"
                datetime={(trash ? post.deleted_at : post.updated_at) ??
                  undefined}
                >{displayTime(trash ? post.deleted_at : post.updated_at)}</time
              ></td
            >
            <td
              class="border-b border-admin-divider px-2 py-3 first:w-[30%] first:wrap-anywhere"
              ><PostActions {post} {refresh} state={actionState} overflow /></td
            >
          </tr>
        {/each}
      </tbody>
    </table>
    <div class="post-cards grid gap-4 md:hidden">
      {#each posts.items as post (post.id)}
        <!-- Real title anchors provide keyboard and native link navigation. -->
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
        <article
          class="group min-w-0 cursor-pointer rounded-lg border border-admin-card p-4"
          onclick={event => openItem(event, post.id)}
        >
          <div class="card-heading flex items-start justify-between gap-3">
            <a
              class="min-w-0 font-semibold wrap-anywhere focus-visible:underline [@media(hover:hover)]:group-hover:underline"
              href={resolve('/admin/posts/[id]', { id: post.id })}
              >{post.title}</a
            ><PostActions {post} {refresh} state={actionState} overflow />
          </div>
          <dl
            class="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs leading-[inherit] text-admin-muted"
          >
            <dt class="post-status font-semibold wrap-anywhere text-admin-ink">
              상태
            </dt>
            <dd class="post-status font-semibold wrap-anywhere text-admin-ink">
              {statusLabels[post.status]}
            </dd>
            <dt>작성</dt>
            <dd class="wrap-anywhere">{displayTime(post.created_at)}</dd>
            <dt>발행</dt>
            <dd class="wrap-anywhere">{displayTime(post.published_at)}</dd>
            <dt>{trash ? '삭제' : '수정'}</dt>
            <dd class="wrap-anywhere">
              {displayTime(trash ? post.deleted_at : post.updated_at)}
            </dd>
          </dl>
        </article>
      {/each}
    </div>
  {/if}
  <div inert={actionState.busy}>
    <Pagination current={posts.page} total={posts.totalPages} {trash} />
  </div>
</section>

<script lang="ts">
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { AdminPostPage, PostStatus } from './contracts';
  import { pageAfterMutation } from './pagination';
  import Pagination from './Pagination.svelte';
  import PostActions from './PostActions.svelte';
  import { displayTime, statusLabels } from './presentation';

  let {
    posts,
    status,
    trash = false,
  }: { posts: AdminPostPage; status?: PostStatus; trash?: boolean } = $props();
  const filters = [undefined, 'draft', 'published', 'archived'] as const;
  const actionState = $state({ busy: false, message: '' });
  let correction: string | undefined;
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
  async function refresh() {
    await invalidateAll();
    const number = pageAfterMutation(posts.page, posts.totalPages);
    if (number !== posts.page) {
      const destination = `${path}${queryString(status, number)}` as const;
      correction = resolve(destination);
      try {
        await goto(resolve(destination));
      } finally {
        correction = undefined;
      }
    }
  }
</script>

<svelte:head><title>{trash ? '휴지통' : '게시글'} · Admin</title></svelte:head>
<header class="admin-heading">
  <h1>{trash ? '휴지통' : '게시글'}</h1>
  <div class="heading-actions">
    {#if trash}<a href={resolve('/admin/posts')}>게시글 목록</a>
    {:else}
      <a href={resolve('/admin/posts/new')}>글쓰기</a>
      <a
        class="trash-link"
        href={resolve('/admin/posts/trash')}
        aria-label="휴지통"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24"
          ><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" /></svg
        >
      </a>
    {/if}
  </div>
</header>
<section
  class="admin-content"
  aria-label={trash ? '삭제한 게시글' : '게시글 목록'}
>
  {#if actionState.busy}<p role="status">
      처리 중…
    </p>{:else if actionState.message}<p role="status">
      {actionState.message}
    </p>{/if}
  {#if !trash}
    <nav class="post-filters" aria-label="상태 필터">
      {#each filters as filter (filter)}
        <a
          href={resolve(`${path}${queryString(filter)}`)}
          aria-current={filter === status ? 'true' : undefined}
          >{filter ? statusLabels[filter] : '전체'}</a
        >
      {/each}
    </nav>
  {/if}
  {#if posts.items.length === 0}
    <p class="admin-empty">
      {trash ? '휴지통이 비어 있습니다.' : '게시글이 없습니다.'}
    </p>
  {:else}
    <table class="post-table">
      <thead
        ><tr
          ><th>제목</th><th>상태</th><th>작성</th><th>발행</th><th
            >{trash ? '삭제' : '수정'}</th
          ><th><span class="sr-only">작업</span></th></tr
        ></thead
      >
      <tbody>
        {#each posts.items as post (post.id)}
          <tr>
            <td
              ><a href={resolve('/admin/posts/[id]', { id: post.id })}
                >{post.title}</a
              ></td
            >
            <td>{statusLabels[post.status]}</td>
            <td
              ><time datetime={post.created_at}
                >{displayTime(post.created_at)}</time
              ></td
            >
            <td
              ><time datetime={post.published_at ?? undefined}
                >{displayTime(post.published_at)}</time
              ></td
            >
            <td
              ><time
                datetime={(trash ? post.deleted_at : post.updated_at) ??
                  undefined}
                >{displayTime(trash ? post.deleted_at : post.updated_at)}</time
              ></td
            >
            <td
              ><PostActions {post} {refresh} state={actionState} overflow /></td
            >
          </tr>
        {/each}
      </tbody>
    </table>
    <div class="post-cards">
      {#each posts.items as post (post.id)}
        <article>
          <div class="card-heading">
            <a href={resolve('/admin/posts/[id]', { id: post.id })}
              >{post.title}</a
            ><PostActions {post} {refresh} state={actionState} overflow />
          </div>
          <dl>
            <dt>상태</dt>
            <dd>{statusLabels[post.status]}</dd>
            <dt>작성</dt>
            <dd>{displayTime(post.created_at)}</dd>
            <dt>발행</dt>
            <dd>{displayTime(post.published_at)}</dd>
            <dt>{trash ? '삭제' : '수정'}</dt>
            <dd>{displayTime(trash ? post.deleted_at : post.updated_at)}</dd>
          </dl>
        </article>
      {/each}
    </div>
  {/if}
  <Pagination current={posts.page} total={posts.totalPages} {trash} />
</section>

<script lang="ts">
  import { returnContext, returnList } from '#lib/admin/list-context.ts';
  import { readAdminPost } from '#lib/admin/mutations.ts';
  import PostActions from '#lib/admin/PostActions.svelte';
  import { displayTime, statusLabels } from '#lib/admin/presentation.ts';
  import { useProcessing } from '#lib/admin/processing.svelte.ts';
  import PostBody from '#lib/editor/PostBody.svelte';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const processing = useProcessing();
  async function refresh() {
    const post = await readAdminPost(data.post.id, fetch);
    data = { ...data, post };
  }
</script>

<svelte:head><title>{data.post.title} · Admin</title></svelte:head>
<div class="admin-heading" class:admin-busy={processing.busy}>
  <a
    class="admin-button"
    aria-disabled={processing.busy}
    href={resolve(returnList(page.url.searchParams, !!data.post.deleted_at))}
    >목록</a
  >
  {#key data.post.id}<PostActions
      post={data.post}
      {refresh}
      returnTo={returnContext(page.url.searchParams)}
    />{/key}
</div>
<article class="admin-content post-detail pt-6">
  <h1 class="admin-title">{data.post.title}</h1>
  <dl
    class="post-metadata mt-4 mb-8 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm leading-[inherit] text-admin-muted"
  >
    <dt class="post-status font-semibold wrap-anywhere text-admin-ink">상태</dt>
    <dd class="post-status font-semibold wrap-anywhere text-admin-ink">
      {statusLabels[data.post.status]}{data.post.deleted_at ? ' · 삭제됨' : ''}
    </dd>
    <dt>작성</dt>
    <dd class="wrap-anywhere">{displayTime(data.post.created_at)}</dd>
    <dt>발행</dt>
    <dd class="wrap-anywhere">{displayTime(data.post.published_at)}</dd>
    <dt>수정</dt>
    <dd class="wrap-anywhere">{displayTime(data.post.updated_at)}</dd>
    {#if data.post.deleted_at}<dt>삭제</dt>
      <dd class="wrap-anywhere">{displayTime(data.post.deleted_at)}</dd>{/if}
  </dl>
  {#key data.post.id + ':' + data.post.revision}<PostBody
      source={data.post.body}
    />{/key}
</article>

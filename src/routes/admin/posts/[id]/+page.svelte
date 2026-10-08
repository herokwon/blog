<script lang="ts">
  import PostActions from '$lib/admin/PostActions.svelte';
  import { displayTime, statusLabels } from '$lib/admin/presentation';
  import PostBody from '$lib/editor/PostBody.svelte';
  import { invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.post.title} · Admin</title></svelte:head>
<div class="admin-heading">
  <a
    href={resolve(data.post.deleted_at ? '/admin/posts/trash' : '/admin/posts')}
    >목록</a
  >
  {#key data.post.id}<PostActions
      post={data.post}
      refresh={invalidateAll}
    />{/key}
</div>
<article class="admin-content post-detail">
  <h1>{data.post.title}</h1>
  <dl class="post-metadata">
    <dt>상태</dt>
    <dd>
      {statusLabels[data.post.status]}{data.post.deleted_at ? ' · 삭제됨' : ''}
    </dd>
    <dt>작성</dt>
    <dd>{displayTime(data.post.created_at)}</dd>
    <dt>발행</dt>
    <dd>{displayTime(data.post.published_at)}</dd>
    <dt>수정</dt>
    <dd>{displayTime(data.post.updated_at)}</dd>
    {#if data.post.deleted_at}<dt>삭제</dt>
      <dd>{displayTime(data.post.deleted_at)}</dd>{/if}
  </dl>
  {#key data.post.id + ':' + data.post.revision}<PostBody
      source={data.post.body}
    />{/key}
</article>

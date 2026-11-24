<script lang="ts">
  import { resolve } from '$app/paths';

  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const statuses = { draft: '초안', published: '발행됨', archived: '보관됨' };
</script>

<svelte:head>
  <title>게시글 관리</title>
</svelte:head>

<main lang="ko">
  <h1>게시글 관리</h1>
  <nav aria-label="게시글 관리">
    <a href={resolve('/admin/posts/new')}>새 글</a>
    <a href={resolve('/admin/categories')}>카테고리</a>
  </nav>
  {#if data.posts.length}
    <ul>
      {#each data.posts as post (post.id)}
        <li>
          <a href={resolve('/admin/posts/[id]/edit', { id: post.id })}
            >{post.title}</a
          >
          · {post.categoryName} · {statuses[post.status]}
        </li>
      {/each}
    </ul>
  {:else}
    <p>저장된 게시글이 없습니다.</p>
  {/if}
</main>

<script lang="ts">
  import { resolve } from '$app/paths';

  import AdminHeading from '../AdminHeading.svelte';
  import { postStatusLabels } from '../post-status';
  import PostTime from '../PostTime.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>게시글 관리</title>
</svelte:head>

<main lang="ko">
  <AdminHeading title="게시글 관리" home />
  <nav aria-label="게시글 관리">
    <a href={resolve('/admin/posts/new')}>새 글</a>
    <a href={resolve('/admin/categories')}>카테고리</a>
    <a href={resolve('/admin/trash')}>휴지통</a>
  </nav>
  {#if data.posts.length}
    <ul>
      {#each data.posts as post (post.id)}
        <li>
          <a href={resolve('/admin/posts/[id]', { id: post.id })}
            >{post.title}</a
          >
          · {post.categoryName} · {postStatusLabels[post.status]}
          <a
            href={resolve('/admin/posts/[id]/edit', { id: post.id })}
            aria-label={`${post.title} 수정`}>수정</a
          >
          <div class="times">
            {#if post.status === 'draft'}
              <span>생성 시각 <PostTime value={post.createdAt} /></span>
            {:else if post.status === 'published' && post.publishedAt}
              <span>최초 발행 시각 <PostTime value={post.publishedAt} /></span>
            {/if}
            <span>최종 변경 시각 <PostTime value={post.updatedAt} /></span>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p>저장된 게시글이 없습니다.</p>
  {/if}
</main>

<style>
  .times {
    display: flex;
    flex-wrap: wrap;
    column-gap: 1rem;
  }
</style>

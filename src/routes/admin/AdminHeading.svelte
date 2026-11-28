<script lang="ts">
  import { resolve } from '$app/paths';

  let {
    title,
    home = false,
    postId,
  }: { title: string; home?: boolean; postId?: string } = $props();
</script>

<div class="heading">
  <a
    href={postId
      ? resolve('/admin/posts/[id]', { id: postId })
      : home
        ? resolve('/(public)')
        : resolve('/admin/posts')}
    aria-label={postId
      ? '게시글 상세로 돌아가기'
      : home
        ? '홈으로 돌아가기'
        : '게시글 목록으로 돌아가기'}>←</a
  >
  <h1>{title}</h1>
</div>

<style>
  .heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-block: 0.5rem 1rem;
  }

  a {
    display: grid;
    flex: none;
    place-items: center;
    min-inline-size: 2.75rem;
    min-block-size: 2.75rem;
    font-size: 1.5rem;
    text-decoration: none;
  }

  h1 {
    margin: 0;
    overflow-wrap: anywhere;
  }
</style>

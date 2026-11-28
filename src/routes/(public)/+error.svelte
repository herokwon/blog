<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';

  const title = $derived(
    page.status === 404
      ? '페이지를 찾을 수 없습니다.'
      : '페이지를 불러오지 못했습니다.',
  );
</script>

<svelte:head>
  <title>{title} | 블로그</title>
</svelte:head>

<main>
  <h1>{title}</h1>
  {#if page.status === 503}
    <p>잠시 후 다시 시도해 주세요.</p>
  {/if}
  <a href={resolve('/(public)')}>글 목록으로 돌아가기</a>
</main>

<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';

  const route = $derived(page.route.id ?? page.url.pathname);
  const onAdminPage = $derived(
    route === '/admin' || route.startsWith('/admin/'),
  );
  const title = $derived(
    onAdminPage && page.error?.message
      ? page.error.message
      : page.status === 404
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
  {#if !onAdminPage}
    <a href={resolve('/(public)')}>글 목록으로 돌아가기</a>
  {/if}
</main>

<style>
  main {
    box-sizing: border-box;
    max-inline-size: 76ch;
    margin-inline: auto;
    padding: 1rem clamp(0.75rem, 4vw, 2rem) 3rem;
  }
</style>

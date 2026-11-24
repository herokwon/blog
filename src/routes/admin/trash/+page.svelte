<script lang="ts">
  import AdminHeading from '../AdminHeading.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
  let errorSummary = $state<HTMLParagraphElement>();
  const deletionDate = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  });
  $effect(() => {
    if (form?.error) errorSummary?.focus();
  });
</script>

<svelte:head>
  <title>휴지통</title>
</svelte:head>

<main lang="ko">
  <AdminHeading title="휴지통" />
  {#if form?.error}
    <p role="alert" tabindex="-1" bind:this={errorSummary}>{form.error}</p>
  {/if}
  {#if data.posts?.length}
    <ul>
      {#each data.posts as post (post.id)}
        <li>
          <strong>{post.title}</strong>
          {#if post.deletedAt}
            · 삭제 시각 <time datetime={post.deletedAt.toISOString()}
              >{deletionDate.format(post.deletedAt)}</time
            >
          {/if}
          <form
            method="POST"
            action="?/restore"
            aria-label={`${post.title} 복원`}
          >
            <input type="hidden" name="id" value={post.id} />
            <input type="hidden" name="version" value={post.version} />
            <button type="submit">복원</button>
          </form>
        </li>
      {/each}
    </ul>
  {:else if data.posts}
    <p>휴지통이 비어 있습니다.</p>
  {/if}
</main>

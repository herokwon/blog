<script lang="ts">
  import { beforeNavigate } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { AdminPostListItem, PostCommand } from './contracts';
  import { runMutation } from './mutations';

  let {
    post,
    overflow = false,
    refresh,
    state: actionState,
  }: {
    post: AdminPostListItem;
    overflow?: boolean;
    refresh: (publishedId?: string) => Promise<void>;
    state?: { busy: boolean; message: string };
  } = $props();
  const localState = $state({ busy: false, message: '' });
  let action = $derived(actionState ?? localState);
  let menuOpen = $state(false);
  beforeNavigate(navigation => {
    if (!overflow && action.busy) navigation.cancel();
  });
  async function command(kind: PostCommand) {
    if (action.busy) return;
    const warning =
      kind === 'delete'
        ? post.status === 'published'
          ? '게시글을 삭제하면 공개되지 않습니다. 삭제할까요?'
          : '게시글을 휴지통으로 이동할까요?'
        : kind === 'restore' && post.status === 'published'
          ? '복구하면 게시글이 다시 공개됩니다. 복구할까요?'
          : undefined;
    if (warning && !window.confirm(warning)) return;
    action.busy = true;
    action.message = '';
    menuOpen = false;
    const title = post.title;
    try {
      const result = await runMutation(
        { kind, id: post.id, input: { expected_revision: post.revision } },
        fetch,
      );
      const message =
        result.kind === 'confirmed'
          ? '변경했습니다.'
          : result.kind === 'observed'
            ? ''
            : result.kind === 'conflict'
              ? '다른 화면에서 변경된 글입니다. 최신 상태를 확인하고 다시 선택하세요.'
              : result.kind === 'rejected'
                ? `변경하지 못했습니다. ${result.error.message}`
                : '변경 결과를 확인할 수 없습니다. 최신 상태를 확인한 뒤 다시 선택하세요.';
      action.message = message ? `${title}: ${message}` : '';
      await refresh(
        result.kind === 'confirmed' && kind === 'publish' ? post.id : undefined,
      );
    } catch {
      action.message = `${title}: 최신 상태를 불러오지 못했습니다. 페이지를 새로고침해 확인하세요.`;
    } finally {
      action.busy = false;
    }
  }
</script>

{#snippet controls()}
  {#if post.deleted_at === null}
    <a
      href={resolve(`/admin/posts/${post.id}/edit`)}
      aria-disabled={action.busy}
      onclick={event => {
        if (action.busy) event.preventDefault();
      }}>수정</a
    >
    {#if post.status !== 'published'}
      <button disabled={action.busy} onclick={() => command('publish')}
        >{post.status === 'archived' ? '재발행' : '발행'}</button
      >
    {:else}
      <button disabled={action.busy} onclick={() => command('archive')}
        >공개 취소</button
      >
    {/if}
    <button disabled={action.busy} onclick={() => command('delete')}
      >삭제</button
    >
  {:else}
    <button disabled={action.busy} onclick={() => command('restore')}
      >복구</button
    >
  {/if}
{/snippet}

<div class="post-actions" aria-busy={action.busy}>
  {#if overflow}
    <div class="post-menu-container">
      <button
        class="post-menu-trigger"
        aria-label={`${post.title} 작업 메뉴`}
        aria-expanded={menuOpen}
        onclick={() => (menuOpen = !menuOpen)}
        onkeydown={event => {
          if (event.key === 'Escape') menuOpen = false;
        }}>⋯</button
      >
      {#if menuOpen}<div class="post-menu">{@render controls()}</div>{/if}
    </div>
  {:else}{@render controls()}{/if}
  {#if !overflow}
    {#if action.busy}<span role="status">처리 중…</span
      >{:else if action.message}<span role="status">{action.message}</span>{/if}
  {/if}
</div>

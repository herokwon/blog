<script lang="ts">
  import { beforeNavigate } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import type { AdminPostListItem, PostCommand } from './contracts';
  import { successMessage, type FeedbackTone } from './feedback';
  import { runMutation } from './mutations';
  import { useNotices } from './notices.svelte';
  import { useProcessing } from './processing.svelte';
  import ResultNotice from './ResultNotice.svelte';

  let {
    post,
    overflow = false,
    refresh,
    state: actionState,
  }: {
    post: AdminPostListItem;
    overflow?: boolean;
    refresh: (publishedId?: string) => Promise<void>;
    state?: {
      busy: boolean;
      message: string;
      operation?: string;
      tone?: FeedbackTone;
      details?: string;
    };
  } = $props();
  const localState = $state({
    busy: false,
    message: '',
    operation: '처리 중…',
    tone: 'success' as FeedbackTone,
    details: '',
  });
  let action = $derived(actionState ?? localState);
  let menuOpen = $state(false);
  let menuContainer = $state<HTMLDivElement>();
  $effect(() => {
    if (!menuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menuContainer?.contains(event.target)
      )
        menuOpen = false;
    };
    document.addEventListener('pointerdown', closeOutside, true);
    return () =>
      document.removeEventListener('pointerdown', closeOutside, true);
  });
  const writable = $derived(page.data.adminContext?.writable ?? true);
  const processing = useProcessing();
  const notices = useNotices();
  const processingOwner = Symbol();
  $effect(() => {
    processing.update(processingOwner, action.busy);
    return () => processing.update(processingOwner, false);
  });
  beforeNavigate(navigation => {
    if (!overflow && action.busy) navigation.cancel();
  });
  async function command(kind: PostCommand) {
    if (action.busy || !writable) return;
    const warning =
      kind === 'delete'
        ? post.status === 'published'
          ? '게시글을 삭제하면 공개되지 않습니다. 삭제할까요?'
          : '게시글을 휴지통으로 이동할까요?'
        : kind === 'restore' && post.status === 'published'
          ? '복구하면 게시글이 다시 공개됩니다. 복구할까요?'
          : kind === 'restore'
            ? '게시글을 복구할까요?'
            : kind === 'archive'
              ? '이 게시글의 공개를 취소할까요?'
              : '이 게시글을 공개할까요?';
    if (!confirm(warning)) return;
    action.operation = {
      publish: '발행 중…',
      archive: '공개 취소 중…',
      delete: '휴지통으로 이동 중…',
      restore: '복구 중…',
    }[kind];
    action.busy = true;
    action.message = '';
    action.details = '';
    notices.dismiss();
    menuOpen = false;
    const title = post.title;
    const republish = post.status === 'archived';
    try {
      const result = await runMutation(
        { kind, id: post.id, input: { expected_revision: post.revision } },
        fetch,
      );
      const message =
        result.kind === 'confirmed'
          ? ''
          : result.kind === 'observed'
            ? ''
            : result.kind === 'conflict'
              ? '다른 화면에서 변경된 글입니다.'
              : result.kind === 'rejected'
                ? '변경하지 못했습니다.'
                : '변경 결과를 확인할 수 없습니다.';
      action.details =
        result.kind === 'conflict'
          ? '최신 상태를 확인하세요.'
          : result.kind === 'rejected'
            ? result.error.message
            : result.kind === 'unresolved'
              ? '최신 상태에서 변경 여부를 확인하세요.'
              : '';
      action.message = message ? `${title}: ${message}` : '';
      action.tone =
        result.kind === 'confirmed'
          ? 'success'
          : result.kind === 'conflict'
            ? 'conflict'
            : result.kind === 'rejected'
              ? 'error'
              : 'uncertain';
      await refresh(
        result.kind === 'confirmed' && kind === 'publish' ? post.id : undefined,
      );
      if (result.kind === 'confirmed')
        notices.show(successMessage(kind, republish));
    } catch {
      action.tone = 'uncertain';
      action.message = `${title}: 최신 상태를 불러오지 못했습니다.`;
      action.details = '페이지를 새로고침해 변경 결과를 확인하세요.';
    } finally {
      action.busy = false;
    }
  }
</script>

{#snippet controls()}
  {#if post.deleted_at === null}
    <a
      class="admin-button"
      href={resolve('/admin/posts/[id]/edit', { id: post.id })}
      aria-disabled={action.busy}
      onclick={event => {
        if (action.busy) event.preventDefault();
      }}>수정</a
    >
    {#if post.status !== 'published'}
      <button
        class="admin-button action-publish"
        disabled={action.busy || !writable}
        onclick={() => command('publish')}
        >{post.status === 'archived' ? '재발행' : '발행'}</button
      >
    {:else}
      <button
        class="admin-button"
        disabled={action.busy || !writable}
        onclick={() => command('archive')}>공개 취소</button
      >
    {/if}
    <button
      class="admin-button action-danger"
      disabled={action.busy || !writable}
      onclick={() => command('delete')}>삭제</button
    >
  {:else}
    <button
      class="admin-button"
      disabled={action.busy || !writable}
      onclick={() => command('restore')}>복구</button
    >
  {/if}
{/snippet}

<div
  class="post-actions relative flex flex-wrap items-center gap-3 [&>.admin-feedback]:max-w-136 [&>.admin-feedback]:basis-full [&>.admin-feedback]:text-sm [&>.admin-feedback]:leading-[inherit]"
  aria-busy={action.busy}
>
  {#if overflow}
    <div class="post-menu-container relative" bind:this={menuContainer}>
      <button
        class="admin-button post-menu-trigger border-0 bg-transparent p-2 text-[1.4rem] leading-none"
        aria-label={`${post.title} 작업 메뉴`}
        aria-expanded={menuOpen}
        onclick={() => (menuOpen = !menuOpen)}
        onkeydown={event => {
          if (event.key === 'Escape') menuOpen = false;
        }}>⋯</button
      >
      {#if menuOpen}<div
          class="post-menu absolute top-full right-0 z-10 grid min-w-30 rounded-md border border-admin-border bg-white p-1.5 shadow-[0_4px_12px_#0002]"
        >
          {@render controls()}
        </div>{/if}
    </div>
  {:else}{@render controls()}{/if}
  {#if !overflow}
    {#if action.busy}<span class="admin-processing" role="status"
        >{action.operation ?? '처리 중…'}</span
      >{:else if action.message}<ResultNotice
        tone={action.tone ?? 'uncertain'}
        message={action.message}
        details={action.details}
        ondismiss={() => (action.message = '')}
      />{/if}
  {/if}
</div>

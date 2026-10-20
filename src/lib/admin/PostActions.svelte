<script lang="ts">
  import { beforeNavigate } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import type { AdminPostListItem, PostCommand } from './contracts';
  import { successMessage, type FeedbackTone } from './feedback';
  import { withListContext } from './list-context';
  import { runMutation } from './mutations';
  import { useNotices } from './notices.svelte';
  import { useProcessing } from './processing.svelte';
  import ProcessingIndicator from './ProcessingIndicator.svelte';
  import ResultNotice from './ResultNotice.svelte';

  let {
    post,
    overflow = false,
    refresh,
    returnTo = null,
    state: actionState,
  }: {
    post: AdminPostListItem;
    overflow?: boolean;
    refresh: () => Promise<void>;
    returnTo?: string | null;
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
    const republish = post.status === 'archived';
    const warning =
      kind === 'delete'
        ? post.status === 'published'
          ? '게시글을 휴지통으로 이동할까요?\n더 이상 공개되지 않으며, 복구하면 다시 공개됩니다.'
          : '게시글을 휴지통으로 이동할까요?'
        : kind === 'restore' && post.status === 'published'
          ? '복구하면 게시글이 다시 공개됩니다. 복구할까요?'
          : kind === 'restore'
            ? '게시글을 복구할까요?'
            : kind === 'archive'
              ? '게시글을 보관할까요?\n더 이상 공개되지 않습니다.'
              : republish
                ? '게시글을 다시 발행할까요?\n다시 공개되며 최초 발행일은 유지됩니다.'
                : '게시글을 발행할까요?\n공개 목록과 상세 페이지에 표시됩니다.';
    if (!confirm(warning)) return;
    action.operation = {
      publish: republish ? '재발행 중…' : '발행 중…',
      archive: '보관 중…',
      delete: '휴지통으로 이동 중…',
      restore: '복구 중…',
    }[kind];
    action.busy = true;
    action.message = '';
    action.details = '';
    notices.dismiss();
    menuOpen = false;
    const title = post.title;
    let confirmed = false;
    try {
      const result = await runMutation(
        { kind, id: post.id, input: { expected_revision: post.revision } },
        fetch,
      );
      confirmed = result.kind === 'confirmed';
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
      await refresh();
      if (result.kind === 'confirmed')
        notices.show(successMessage(kind, republish));
    } catch {
      action.tone = 'uncertain';
      action.message = `${title}: 최신 상태를 불러오지 못했습니다.`;
      action.details = confirmed
        ? '작업은 완료되었습니다. 페이지를 새로고침해 최신 상태를 확인하세요.'
        : '페이지를 새로고침해 변경 결과를 확인하세요.';
    } finally {
      action.busy = false;
    }
  }
</script>

{#snippet controls()}
  {#if post.deleted_at === null}
    <a
      class="admin-button"
      class:admin-button-menu={overflow}
      href={withListContext(
        resolve('/admin/posts/[id]/edit', { id: post.id }),
        returnTo,
      )}
      aria-disabled={action.busy}
      onclick={event => {
        if (action.busy) event.preventDefault();
      }}>수정</a
    >
    {#if post.status !== 'published'}
      <button
        class="admin-button"
        class:admin-button-menu={overflow}
        class:action-publish={!overflow}
        disabled={action.busy || !writable}
        onclick={() => command('publish')}
        >{post.status === 'archived' ? '재발행' : '발행'}</button
      >
    {:else}
      <button
        class="admin-button"
        class:admin-button-menu={overflow}
        disabled={action.busy || !writable}
        onclick={() => command('archive')}>보관</button
      >
    {/if}
    <button
      class="admin-button action-danger"
      class:admin-button-menu={overflow}
      disabled={action.busy || !writable}
      onclick={() => command('delete')}>삭제</button
    >
  {:else}
    <button
      class="admin-button"
      class:admin-button-menu={overflow}
      disabled={action.busy || !writable}
      onclick={() => command('restore')}>복구</button
    >
  {/if}
{/snippet}

<div
  class="post-actions relative flex flex-wrap items-center gap-3 [&>.admin-feedback]:max-w-136 [&>.admin-feedback]:basis-full [&>.admin-feedback]:text-sm [&>.admin-feedback]:leading-[inherit]"
  aria-busy={action.busy}
  class:admin-busy={action.busy}
>
  {#if overflow}
    <div class="post-menu-container relative" bind:this={menuContainer}>
      <button
        class="admin-button admin-button-trigger post-menu-trigger"
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
    <ProcessingIndicator
      active={action.busy}
      message={action.operation ?? '처리 중…'}
    />
    {#if !action.busy && action.message}<ResultNotice
        tone={action.tone ?? 'uncertain'}
        message={action.message}
        details={action.details}
        ondismiss={() => (action.message = '')}
      />{/if}
  {/if}
</div>

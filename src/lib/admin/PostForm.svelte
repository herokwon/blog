<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Editor from '#lib/editor/Editor.svelte';
  import { inspectMarkdown } from '#lib/editor/policy.ts';
  import type { EditorController } from '#lib/editor/runtime.ts';
  import { beforeNavigate, goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { createAuthoringState, submitAuthoring } from './authoring';
  import { createPostSchema, type AdminPost } from './contracts';
  import { successMessage, type FeedbackTone } from './feedback';
  import { returnContext, returnList, withListContext } from './list-context';
  import { readAdminPost } from './mutations';
  import { useNotices } from './notices.svelte';
  import { useProcessing } from './processing.svelte';
  import ProcessingIndicator from './ProcessingIndicator.svelte';
  import {
    clearRecovery,
    readRecovery,
    writeRecovery,
    type RecoveryCopy,
  } from './recovery';
  import RecoveryDialog from './RecoveryDialog.svelte';
  import ResultNotice from './ResultNotice.svelte';

  let { post }: { post?: AdminPost } = $props();
  const writable = $derived(page.data.adminContext?.writable ?? true);
  // svelte-ignore state_referenced_locally
  let form = $state(createAuthoringState(post));
  // svelte-ignore state_referenced_locally
  let editorSource = $state(post?.body ?? '');
  let editorKey = $state(0);
  let controller = $state<EditorController>();
  let recovery = $state<RecoveryCopy | null>(null);
  let storageNotice = $state(false);
  let message = $state('');
  let messageDetails = $state('');
  let messageTone = $state<FeedbackTone>('error');
  let dismissedPublication = $state<string | null>(null);
  let loading = $state(false);
  let submitting = $state(false);
  const busy = $derived(form.pending || loading || submitting);
  let client = false;
  let recordingDisabled = false;
  let discarded = false;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let maximum: ReturnType<typeof setTimeout> | undefined;
  let editedAt = 0;
  let bodyChanged = $state(false);
  let editorBaselineSource = $state('');
  let editorBaselineMarkdown = $state('');
  let currentEditorMarkdown = $state('');
  let permittedDestination: string | null = null;
  let titleInput: HTMLInputElement;
  let submittedForValidation = $state(false);
  const validation = $derived(
    createPostSchema.safeParse({
      title: form.input.title,
      body: bodyChanged ? currentEditorMarkdown : form.input.body,
    }),
  );
  const titleError = $derived(
    submittedForValidation &&
      !validation.success &&
      validation.error.issues.some(issue => issue.path[0] === 'title'),
  );
  const bodyError = $derived(
    submittedForValidation &&
      !validation.success &&
      validation.error.issues.some(issue => issue.path[0] === 'body'),
  );
  const supported = $derived(inspectMarkdown(editorSource).supported);
  const creating = $derived(!form.base && !form.created);
  const hasEdits = $derived(
    !form.base ||
      form.input.title !== form.base.title ||
      (bodyChanged &&
        currentEditorMarkdown !==
          (form.base.body === editorBaselineSource
            ? editorBaselineMarkdown
            : form.base.body)),
  );
  const context = $derived(returnContext(page.url.searchParams));
  const list = $derived(
    returnList(page.url.searchParams, !!form.base?.deleted_at),
  );
  const locked = $derived(busy || recovery !== null);
  const processing = useProcessing();
  const notices = useNotices();
  const processingOwner = Symbol();
  $effect(() => {
    processing.update(processingOwner, busy);
    return () => processing.update(processingOwner, false);
  });
  const dirty = $derived(
    form.base
      ? hasEdits
      : form.input.title !== '' || bodyChanged || form.input.body !== '',
  );

  function cancelTimers() {
    clearTimeout(debounce);
    clearTimeout(maximum);
    debounce = undefined;
    maximum = undefined;
  }
  function storage(action: (storage: Storage) => void) {
    if (!client || recordingDisabled) return;
    try {
      action(localStorage);
    } catch {
      storageNotice = true;
      recordingDisabled = true;
    }
  }
  function serialize() {
    if (bodyChanged && controller) {
      form.input.body = controller.getMarkdown();
      form.bodyDirty = true;
    }
  }
  function record() {
    cancelTimers();
    if (discarded) return;
    serialize();
    if (!form.base && !form.created && !recovery && editedAt)
      storage(store => writeRecovery(store, { ...form.input, editedAt }));
  }
  function changed(body = false) {
    discarded = false;
    if (body) {
      bodyChanged = true;
      if (controller) currentEditorMarkdown = controller.getMarkdown(true);
    }
    editedAt = Date.now();
    clearTimeout(debounce);
    debounce = setTimeout(record, 500);
    maximum ??= setTimeout(record, 2000);
  }
  function discardRecovery() {
    cancelTimers();
    discarded = true;
    if (!form.base && !form.created) storage(clearRecovery);
  }
  async function chooseRecovery(restore: boolean) {
    const copy = recovery;
    if (!copy) return;
    if (restore) {
      form.input = { title: copy.title, body: copy.body };
      editorSource = copy.body;
      controller = undefined;
      editorKey++;
      editedAt = copy.editedAt;
    } else discardRecovery();
    recovery = null;
    await tick();
    titleInput.focus();
  }
  beforeNavigate(navigation => {
    // Browser reload/closure is not an application discard. beforeunload owns
    // best-effort recording and its native departure warning.
    if (navigation.type === 'leave') return;
    if (
      navigation.to &&
      navigation.to.url.pathname + navigation.to.url.search ===
        permittedDestination
    )
      return;
    if (locked) {
      navigation.cancel();
      return;
    }
    if (dirty) {
      if (!confirm('저장하지 않은 변경 사항을 버리고 이동할까요?')) {
        navigation.cancel();
        return;
      }
      discardRecovery();
      return;
    }
    record();
  });
  onMount(() => {
    client = true;
    if (!form.base)
      storage(store => {
        recovery = readRecovery(store, Date.now());
      });
    const unload = (event: BeforeUnloadEvent) => {
      record();
      if (!discarded && (busy || dirty)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => {
      cancelTimers();
      client = false;
      window.removeEventListener('beforeunload', unload);
    };
  });

  async function submit(intent: 'save' | 'publish' | 'retry') {
    if (!writable) return;
    if (locked || !supported || !controller) return;
    if (intent === 'save' && !hasEdits) return;
    serialize();
    if (intent !== 'retry') {
      submittedForValidation = true;
      if (!validation.success) {
        await tick();
        if (titleError) titleInput.focus();
        else controller.focus();
        return;
      }
    }
    const warning =
      form.result?.kind === 'unresolved' && form.request?.kind === 'create'
        ? '생성 결과가 불확실합니다. 글 목록을 확인했으며 다시 생성할까요?'
        : intent === 'publish'
          ? '현재 내용을 저장하고 공개할까요?'
          : intent === 'retry'
            ? '원래 저장 요청을 다시 시도할까요?'
            : creating
              ? '현재 내용으로 초안을 생성할까요?'
              : '현재 내용을 저장할까요?';
    if (!confirm(warning)) return;
    record();
    message = '';
    messageDetails = '';
    notices.dismiss();
    const wasNew = !form.base && !form.created;
    const wasArchived = form.base?.status === 'archived';
    submitting = true;
    try {
      await submitAuthoring(form, intent, fetch);
      const completion = () =>
        successMessage(
          form.request?.kind === 'publish'
            ? 'publish'
            : wasNew
              ? 'create'
              : 'save',
          wasArchived,
        );
      if (form.created) {
        cancelTimers();
        storage(store => {
          const copy = readRecovery(store, Date.now());
          if (
            copy &&
            copy.title === form.submitted?.title &&
            copy.body === form.submitted?.body
          )
            clearRecovery(store);
        });
      }
      if (form.result?.kind === 'conflict') {
        message = '다른 화면에서 글이 변경되었습니다.';
      } else if (form.result?.kind === 'rejected') {
        message = '저장하지 못했습니다.';
        messageDetails = form.result.error.message;
      } else if (form.result?.kind === 'observed') {
        message = '최신 상태를 확인했습니다.';
        messageDetails = '요청의 처리 여부는 확인할 수 없습니다.';
      } else if (form.result?.kind === 'unresolved') {
        message =
          form.request?.kind === 'create'
            ? '생성 결과를 확인할 수 없습니다.'
            : '저장 결과를 확인할 수 없습니다.';
        messageDetails =
          form.request?.kind === 'create'
            ? '글 목록에서 생성 여부를 확인하세요.'
            : '최신 글에서 저장 여부를 확인하세요.';
      }
      messageTone =
        form.result?.kind === 'conflict'
          ? 'conflict'
          : form.result?.kind === 'unresolved' ||
              form.result?.kind === 'observed'
            ? 'uncertain'
            : 'error';
      if (form.destination) {
        const destination = withListContext(
          resolve(
            `admin/posts/${form.destination.slice('/admin/posts/'.length)}`,
          ),
          context,
        );
        permittedDestination = destination;
        try {
          await goto(destination);
          if (form.result?.kind === 'confirmed') notices.show(completion());
          else if (form.result?.kind === 'observed') {
            notices.show(message, 'uncertain', messageDetails);
            message = '';
          }
        } catch {
          message = '화면을 이동하지 못했습니다.';
          messageDetails = '저장된 글을 확인하세요.';
          messageTone = 'uncertain';
        } finally {
          permittedDestination = null;
        }
      } else if (
        form.result?.kind === 'confirmed' ||
        form.result?.kind === 'observed'
      ) {
        bodyChanged = form.input.body !== form.base?.body;
        if (form.result?.kind === 'confirmed' && !dirty) {
          notices.show(completion());
        }
      }
    } finally {
      submitting = false;
    }
  }
  async function reloadLatest() {
    if (
      locked ||
      !form.base ||
      !confirm('현재 입력을 버리고 최신 내용을 불러올까요?')
    )
      return;
    loading = true;
    message = '';
    messageDetails = '';
    notices.dismiss();
    try {
      const latest = await readAdminPost(form.base.id, fetch);
      if (latest.id !== form.base.id || latest.deleted_at !== null)
        throw new Error('Unavailable');
      form = createAuthoringState(latest);
      submittedForValidation = false;
      editorSource = latest.body;
      controller = undefined;
      bodyChanged = false;
      editorKey++;
      message = '';
      messageDetails = '';
      notices.show('최신 내용을 불러왔습니다.');
    } catch {
      message = '최신 내용을 불러오지 못했습니다.';
      messageDetails = '';
      messageTone = 'error';
    } finally {
      loading = false;
    }
  }
</script>

<form
  class="post-form flex min-h-0 flex-1 flex-col"
  class:admin-busy={busy}
  onsubmit={event => {
    event.preventDefault();
    void submit('save');
  }}
>
  <div class="admin-heading" inert={busy}>
    <a class="admin-button" href={resolve(list)}>목록</a>
    <div class="post-actions flex flex-wrap items-center gap-3">
      {#if !form.base}<button
          class="admin-button action-publish"
          type="button"
          disabled={locked || !supported || !controller || !writable}
          onclick={() => submit('publish')}>발행</button
        >{/if}
      <button
        class="admin-button"
        class:action-save={!creating}
        type="submit"
        disabled={locked || !supported || !controller || !writable || !hasEdits}
        >{creating ? '초안 생성' : '저장'}</button
      >
      <a
        class="admin-button"
        href={form.base
          ? withListContext(
              resolve('/admin/posts/[id]', { id: form.base.id }),
              context,
            )
          : resolve(list)}>취소</a
      >
    </div>
  </div>
  {#if storageNotice}<ResultNotice
      tone="warning"
      message="브라우저 입력 복구를 사용할 수 없습니다."
      ondismiss={() => (storageNotice = false)}
    />{/if}
  {#if page.url.searchParams.get('publication') === 'unconfirmed' && dismissedPublication !== 'unconfirmed'}<ResultNotice
      tone="uncertain"
      message="발행 결과를 확인할 수 없습니다."
      details="초안은 저장되었습니다.
상세 화면에서 발행 여부를 확인하세요."
      ondismiss={() => (dismissedPublication = 'unconfirmed')}
    />{/if}
  {#if page.url.searchParams.get('publication') === 'failed' && dismissedPublication !== 'failed'}<ResultNotice
      tone="error"
      message="발행하지 못했습니다."
      details="초안은 저장되었습니다."
      ondismiss={() => (dismissedPublication = 'failed')}
    />{/if}
  {#if message}<ResultNotice
      tone={messageTone}
      {message}
      details={messageDetails}
      ondismiss={() => (message = '')}
    />{/if}
  {#if form.result?.kind === 'unresolved' && form.request?.kind === 'create'}
    <a href={resolve('/admin/posts')} target="_blank" rel="noopener noreferrer"
      >글 목록 확인</a
    >
  {/if}
  {#if form.base && ['conflict', 'unresolved'].includes(form.result?.kind ?? '')}
    <div
      class="authoring-feedback my-4 flex flex-wrap items-center gap-3"
      inert={busy}
    >
      <a
        class="admin-button"
        href={withListContext(
          resolve('/admin/posts/[id]', { id: form.base.id }),
          context,
        )}
        target="_blank"
        rel="noopener noreferrer">최신 글 확인</a
      >
      <button
        class="admin-button"
        type="button"
        disabled={locked}
        onclick={reloadLatest}>최신 내용 불러오기</button
      >
      {#if form.result?.kind === 'unresolved'}<button
          class="admin-button"
          type="button"
          disabled={locked || !writable}
          onclick={() => submit('retry')}>원래 요청 다시 시도</button
        >{/if}
    </div>
  {/if}
  <div class="post-inputs relative flex min-h-0 flex-1 flex-col">
    <div class="flex min-h-0 flex-1 flex-col" inert={locked} aria-busy={busy}>
      <div class="post-title my-4 shrink-0">
        <label class="sr-only" for="post-title">제목</label><input
          class="block w-full rounded border p-3 text-base leading-[inherit]"
          id="post-title"
          aria-invalid={titleError ? 'true' : undefined}
          aria-describedby={titleError ? 'post-title-error' : undefined}
          placeholder="제목"
          bind:this={titleInput}
          bind:value={form.input.title}
          disabled={locked}
          oninput={() => changed()}
        />{#if titleError}<span id="post-title-error" class="field-error"
            >제목을 입력하세요.</span
          >{/if}
      </div>
      {#key editorKey}<Editor
          source={editorSource}
          {locked}
          invalid={bodyError}
          describedby={bodyError ? 'post-body-error' : undefined}
          onchange={() => changed(true)}
          onready={mounted => {
            controller = mounted;
            editorBaselineSource = editorSource;
            editorBaselineMarkdown = mounted.getMarkdown(true);
            currentEditorMarkdown = editorBaselineMarkdown;
          }}
        />{/key}
      {#if bodyError}<p id="post-body-error" class="field-error">
          본문을 입력하세요.
        </p>{/if}
    </div>
    <ProcessingIndicator
      active={busy}
      scope="region"
      message={loading
        ? '최신 내용 불러오는 중…'
        : form.request?.kind === 'publish'
          ? '발행 중…'
          : creating
            ? '초안 생성 중…'
            : '저장 중…'}
    />
  </div>
</form>

{#if recovery}
  <RecoveryDialog
    title={recovery.title}
    editedAt={recovery.editedAt}
    onDecision={decision => {
      void chooseRecovery(decision === 'restore');
    }}
  />
{/if}

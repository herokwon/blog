<script lang="ts">
  import { onMount } from 'svelte';
  import Editor from '$lib/editor/Editor.svelte';
  import { inspectMarkdown } from '$lib/editor/policy';
  import type { EditorController } from '$lib/editor/runtime';
  import { beforeNavigate, goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { createAuthoringState, submitAuthoring } from './authoring';
  import { createPostSchema, type AdminPost } from './contracts';
  import { readAdminPost } from './mutations';
  import {
    clearRecovery,
    readRecovery,
    writeRecovery,
    type RecoveryCopy,
  } from './recovery';

  let { post }: { post?: AdminPost } = $props();
  // svelte-ignore state_referenced_locally
  let form = $state(createAuthoringState(post));
  // svelte-ignore state_referenced_locally
  let editorSource = $state(post?.body ?? '');
  let editorKey = $state(0);
  let controller = $state<EditorController>();
  let recovery = $state<RecoveryCopy | null>(null);
  let storageNotice = $state(false);
  let message = $state('');
  let loading = $state(false);
  let client = false;
  let recordingDisabled = false;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let maximum: ReturnType<typeof setTimeout> | undefined;
  let editedAt = 0;
  let bodyChanged = $state(false);
  let permittedDestination: string | null = null;
  const supported = $derived(inspectMarkdown(editorSource).supported);
  const locked = $derived(form.pending || loading || recovery !== null);
  const dirty = $derived(
    form.base
      ? form.input.title !== form.base.title ||
          bodyChanged ||
          form.input.body !== form.base.body
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
    serialize();
    if (!form.base && !form.created && !recovery && editedAt)
      storage(store => writeRecovery(store, { ...form.input, editedAt }));
  }
  function changed(body = false) {
    if (body) bodyChanged = true;
    editedAt = Date.now();
    clearTimeout(debounce);
    debounce = setTimeout(record, 500);
    maximum ??= setTimeout(record, 2000);
  }
  function chooseRecovery(restore: boolean) {
    const copy = recovery;
    if (!copy) return;
    if (restore) {
      form.input = { title: copy.title, body: copy.body };
      editorSource = copy.body;
      controller = undefined;
      editorKey++;
      editedAt = copy.editedAt;
    } else storage(clearRecovery);
    recovery = null;
  }
  beforeNavigate(navigation => {
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
    if (
      dirty &&
      !window.confirm('저장하지 않은 변경 사항을 버리고 이동할까요?')
    ) {
      navigation.cancel();
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
      if (form.pending || loading || dirty) {
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
    if (locked || !supported || !controller) return;
    record();
    message = '';
    if (intent !== 'retry' && !createPostSchema.safeParse(form.input).success) {
      message = '제목과 본문을 입력하세요.';
      return;
    }
    if (
      form.result?.kind === 'unresolved' &&
      form.request?.kind === 'create' &&
      !window.confirm(
        '생성 결과가 불확실합니다. 글 목록을 확인했으며 다시 생성할까요?',
      )
    )
      return;
    await submitAuthoring(form, intent, fetch);
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
    if (form.result?.kind === 'conflict')
      message = '다른 화면에서 글이 변경되었습니다.';
    else if (form.result?.kind === 'rejected')
      message = `저장하지 못했습니다: ${form.result.error.message}`;
    else if (form.result?.kind === 'unresolved')
      message =
        form.request?.kind === 'create'
          ? '생성 결과를 확인할 수 없습니다. 글 목록을 확인한 뒤 다시 시도하세요.'
          : '저장 결과를 확인할 수 없습니다. 입력을 유지합니다. 원래 요청을 다시 시도하거나 최신 글을 확인하세요.';
    if (form.destination) {
      permittedDestination = form.destination;
      try {
        await goto(resolve(form.destination as `/admin/posts/${string}`));
      } catch {
        message = '화면을 이동하지 못했습니다. 저장된 글을 확인하세요.';
      } finally {
        permittedDestination = null;
      }
    } else if (
      form.result?.kind === 'confirmed' ||
      form.result?.kind === 'observed'
    ) {
      bodyChanged = form.input.body !== form.base?.body;
    }
  }
  async function reloadLatest() {
    if (
      locked ||
      !form.base ||
      !window.confirm('현재 입력을 버리고 최신 내용을 불러올까요?')
    )
      return;
    loading = true;
    try {
      const latest = await readAdminPost(form.base.id, fetch);
      if (latest.id !== form.base.id || latest.deleted_at !== null)
        throw new Error('Unavailable');
      form = createAuthoringState(latest);
      editorSource = latest.body;
      controller = undefined;
      bodyChanged = false;
      editorKey++;
      message = '';
    } catch {
      message = '최신 내용을 불러오지 못했습니다. 입력을 유지합니다.';
    } finally {
      loading = false;
    }
  }
</script>

<form
  class="post-form"
  onsubmit={event => {
    event.preventDefault();
    void submit('save');
  }}
>
  <header class="admin-heading">
    <a href={resolve('/admin/posts')}>목록</a>
    <div class="post-actions">
      {#if !form.base}<button
          type="button"
          disabled={locked || !supported || !controller}
          onclick={() => submit('publish')}>발행</button
        >{/if}
      <button type="submit" disabled={locked || !supported || !controller}
        >저장</button
      >
      <a
        href={form.base
          ? resolve('/admin/posts/[id]', { id: form.base.id })
          : resolve('/admin/posts')}>취소</a
      >
    </div>
  </header>
  {#if recovery}
    <aside class="authoring-feedback">
      <p>미저장 작성 내용이 있습니다</p>
      <button type="button" onclick={() => chooseRecovery(true)}>복구</button>
      <button type="button" onclick={() => chooseRecovery(false)}>버리기</button
      >
    </aside>
  {/if}
  {#if storageNotice}<p role="status">
      브라우저 입력 복구를 사용할 수 없습니다.
    </p>{/if}
  {#if page.url.searchParams.get('publication') === 'unconfirmed'}<p
      role="status"
    >
      초안은 저장되었습니다. 발행 결과를 확인할 수 없습니다. 상세 화면을 확인한
      뒤 다시 시도하세요.
    </p>{/if}
  {#if page.url.searchParams.get('publication') === 'failed'}<p role="status">
      초안은 저장되었습니다. 발행하지 못했습니다. 상세 화면에서 발행을 다시
      시도하세요.
    </p>{/if}
  {#if message}<p role="status">{message}</p>{/if}
  {#if form.result?.kind === 'unresolved' && form.request?.kind === 'create'}
    <a href={resolve('/admin/posts')} target="_blank" rel="noopener noreferrer"
      >글 목록 확인</a
    >
  {/if}
  {#if form.base && ['conflict', 'unresolved'].includes(form.result?.kind ?? '')}
    <div class="authoring-feedback">
      <a
        href={resolve('/admin/posts/[id]', { id: form.base.id })}
        target="_blank"
        rel="noopener noreferrer">최신 글 확인</a
      >
      <button type="button" disabled={locked} onclick={reloadLatest}
        >최신 내용 불러오기</button
      >
      {#if form.result?.kind === 'unresolved'}<button
          type="button"
          disabled={locked}
          onclick={() => submit('retry')}>원래 요청 다시 시도</button
        >{/if}
    </div>
  {/if}
  <label class="post-title" for="post-title"
    >제목<input
      id="post-title"
      bind:value={form.input.title}
      disabled={locked}
      oninput={() => changed()}
    /></label
  >
  {#key editorKey}<Editor
      source={editorSource}
      {locked}
      onchange={() => changed(true)}
      onready={mounted => {
        controller = mounted;
      }}
    />{/key}
</form>

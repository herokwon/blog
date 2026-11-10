<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import MarkdownEditor from '#lib/components/MarkdownEditor.svelte';
  import type { EditingTag } from '#lib/components/tag-input.js';
  import TagInput from '#lib/components/TagInput.svelte';
  import { requestFailure } from '#lib/form-feedback.js';
  import type {
    editorOptions,
    getPost,
    PostInput,
  } from '#lib/server/db/posts.js';
  import type { PostFailure } from '#lib/server/posts-form.js';
  import { enhance, type SubmitFunction } from '$app/forms';
  import { beforeNavigate } from '$app/navigation';
  import { resolve } from '$app/paths';

  let {
    post = null,
    options,
    form = null,
    notice = null,
  }: {
    post?: Awaited<ReturnType<typeof getPost>>;
    options: Awaited<ReturnType<typeof editorOptions>>;
    form?: PostFailure | null;
    notice?: string | null;
  } = $props();
  function initialValues(): PostInput {
    const input = form?.input ?? {
      title: post?.title ?? '',
      body: post?.body ?? '',
      slug: post?.slug ?? '',
      categoryId: post?.categoryId ?? '',
      tags: post?.tags ?? [],
    };
    return { ...input, tags: input.tags.filter(tag => tag.trim()) };
  }
  let values = $state(initialValues());
  let appliedPost = $state(
    untrack(() => (post ? post.id + ':' + post.revision : 'new')),
  );
  let alertElement = $state<HTMLParagraphElement>();
  let categorySelect = $state<HTMLSelectElement>();
  async function focusError() {
    await tick();
    alertElement?.focus();
  }
  let newTag = $state('');
  let editingTag = $state<EditingTag | null>(null);
  let tagInput: { commit(): boolean } | undefined = $state();
  let markdownEditor: { read(): string } | undefined = $state();
  let savedNavigation = $state(false);
  let uploadingImages = $state(false);
  let submitError = $state('');
  function snapshot(
    input: PostInput,
    pendingTag = '',
    editing: EditingTag | null = null,
  ) {
    return JSON.stringify([
      input.title,
      input.body,
      input.slug,
      input.categoryId,
      input.tags,
      pendingTag,
      editing,
    ]);
  }
  function baseline() {
    return snapshot({
      title: post?.title ?? '',
      body: post?.body ?? '',
      slug: post?.slug ?? '',
      categoryId: post?.categoryId ?? '',
      tags: post?.tags ?? [],
    });
  }
  const dirty = $derived(
    !post?.deletedAt &&
      (uploadingImages ||
        snapshot(
          values,
          newTag,
          editingTag && editingTag.value !== values.tags[editingTag.index]
            ? editingTag
            : null,
        ) !== baseline()),
  );
  beforeNavigate(navigation => {
    if (
      dirty &&
      !savedNavigation &&
      !navigation.willUnload &&
      !window.confirm('Discard unsaved changes?')
    )
      navigation.cancel();
  });
  $effect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!savedNavigation) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  });
  let busy = $state(false);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
    if (categorySelect) values.categoryId = categorySelect.value;
    if (form) void focusError();
  });
  let slugMessage = $state('');
  const revision = $derived(form?.revision ?? post?.revision ?? '');
  const trashed = $derived(Boolean(post?.deletedAt));
  $effect(() => {
    const initial = initialValues();
    // Failed enhanced submissions keep the current fields and original revision.
    // A native failed submission initializes from the server-returned input.
    // Preserve native input entered before hydration; reset only for a new saved revision.
    const postVersion = post ? post.id + ':' + post.revision : 'new';
    if (!form && postVersion !== appliedPost) {
      values = initial;
      newTag = '';
      editingTag = null;
      appliedPost = postVersion;
      if (categorySelect) categorySelect.value = initial.categoryId;
    }
  });
  $effect(() => {
    const slug = values.slug;
    const id = post?.id;
    if (post?.publishedAt || trashed) {
      slugMessage = '';
      return;
    }
    if (!slug) {
      slugMessage = 'Optional until publication.';
      return;
    }
    slugMessage = 'Checking slug…';
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const query = `slug=${encodeURIComponent(slug)}${id ? `&postId=${encodeURIComponent(id)}` : ''}`;
          const response = await fetch(
            `${resolve('/admin/slug-availability')}?${query}`,
            { signal: controller.signal, cache: 'no-store' },
          );
          if (!response.ok) throw new Error('Availability unavailable');
          const result = await response.json<{
            valid: boolean;
            available: boolean;
          }>();
          if (!controller.signal.aborted)
            slugMessage = !result.valid
              ? 'Use lowercase letters, digits and single separating hyphens (max 120).'
              : result.available
                ? 'Slug is available.'
                : 'Slug is already reserved.';
        } catch {
          if (!controller.signal.aborted)
            slugMessage =
              'Could not check the slug. Saving will still validate it.';
        }
      })();
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  });
  const submit: SubmitFunction = ({ formElement, formData, cancel }) => {
    if (busy || uploadingImages) {
      cancel();
      return;
    }
    const operation = formElement.dataset.operation;
    if (
      (operation === 'archive' || operation === 'trash') &&
      !window.confirm(
        `${operation === 'archive' ? 'Archive this post' : 'Move this post to trash'}? Unsaved changes will not be saved.`,
      )
    ) {
      cancel();
      return;
    }
    if (formElement.dataset.operation === 'content') {
      if (tagInput && !tagInput.commit()) {
        cancel();
        return;
      }
      formData.delete('tags');
      for (const tag of values.tags) formData.append('tags', tag);
      values.body = markdownEditor?.read() ?? values.body;
      formData.set('body', values.body);
    }
    submitError = '';
    busy = true;
    return async ({ result, update }) => {
      const redirectUrl =
        result.type === 'redirect'
          ? new URL(result.location, window.location.href)
          : null;
      const expectedRedirect =
        redirectUrl?.origin === window.location.origin &&
        (post
          ? redirectUrl.pathname ===
            resolve('/admin/posts/[id]', { id: post.id })
          : /^\/admin\/posts\/[0-9a-f-]{36}$/.test(redirectUrl.pathname));
      savedNavigation = result.type === 'redirect' && expectedRedirect;
      try {
        if (result.type === 'redirect' && !expectedRedirect) {
          submitError = requestFailure(401);
          await focusError();
          return;
        }
        if (result.type === 'error') {
          submitError = requestFailure(result.status ?? result.error.status);
          await focusError();
          return;
        }
        await update({ reset: false });
        if (result.type === 'failure') await focusError();
      } finally {
        savedNavigation = false;
        busy = false;
      }
    };
  };
  function exportInput() {
    let url: string | undefined;
    try {
      const data = {
        ...values,
        body: markdownEditor?.read() ?? values.body,
        pendingTag: newTag,
        editingTag,
      };
      url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'unsaved-post.json';

      link.click();
      link.remove();
      submitError = '';
    } catch {
      submitError =
        'Your input could not be exported. It has been kept. Please retry.';
      void focusError();
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000);
    }
  }
  function reloadLatest() {
    if (
      !window.confirm(
        'Discard unsaved changes and reload the latest saved post?',
      )
    )
      return;
    savedNavigation = true;
    window.location.reload();
  }
</script>

<p role="status" aria-label="Save status">
  {busy
    ? 'Saving…'
    : submitError || form
      ? 'Save failed.'
      : dirty
        ? 'Unsaved changes.'
        : (notice ?? 'No changes.')}
</p>
{#if submitError || form}<p role="alert" tabindex="-1" bind:this={alertElement}>
    {submitError || form?.message}
  </p>{/if}
{#if post && form?.code === 'stale_revision'}
  <div class="actions" aria-label="Save conflict recovery">
    <a
      href={resolve('/admin/posts/[id]', { id: post.id })}
      target="_blank"
      rel="noopener noreferrer">Open latest saved post</a
    >
    <button type="button" onclick={exportInput} disabled={busy}
      >Export unsaved input</button
    >
    <button type="button" onclick={reloadLatest} disabled={busy}
      >Reload latest saved post</button
    >
  </div>
{/if}
{#if post}
  <p>Status: {post.status}</p>
  {#if trashed}<p>Trash — read-only</p>{/if}
  <p>
    Created: <time datetime={post.createdAt}>{post.createdAt}</time><br
    />Updated: <time datetime={post.updatedAt}>{post.updatedAt}</time>
    {#if post.publishedAt}<br />First published:
      <time datetime={post.publishedAt}>{post.publishedAt}</time>{/if}
  </p>
{/if}
<form
  method="POST"
  action={post ? '?/save' : '?/create'}
  aria-label="Post content"
  data-operation="content"
  use:enhance={submit}
>
  <input type="hidden" name="revision" value={revision} />
  <fieldset disabled={trashed}>
    <legend>Post content</legend>
    <label
      >Title <input
        name="title"
        bind:value={values.title}
        readonly={busy}
      /></label
    >
    {#if trashed}
      <label
        >Markdown <textarea name="body" rows="16" value={values.body} readonly
        ></textarea></label
      >
    {:else}
      {#key post?.id ?? 'new'}<MarkdownEditor
          bind:this={markdownEditor}
          bind:value={values.body}
          bind:uploading={uploadingImages}
          readonly={busy}
        />{/key}
    {/if}
    <label
      >Slug <input
        name="slug"
        bind:value={values.slug}
        readonly={busy || Boolean(post?.publishedAt)}
        maxlength="120"
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        aria-describedby="slug-help"
      /></label
    >
    <p id="slug-help" role="status" aria-label="Slug availability">
      {post?.publishedAt ? 'Locked after first publication.' : slugMessage}
    </p>
    <label
      >Category <select
        bind:this={categorySelect}
        name="categoryId"
        aria-label="Category"
        defaultValue={values.categoryId}
        onchange={event => {
          values.categoryId = event.currentTarget.value;
        }}
        disabled={busy || uploadingImages}
      >
        <option value="">No category</option>
        {#each options.categories as category (category.id)}<option
            value={category.id}>{category.name}</option
          >{/each}
      </select></label
    >
    <TagInput
      bind:this={tagInput}
      bind:value={values.tags}
      bind:pendingTag={newTag}
      bind:editingTag
      disabled={busy || uploadingImages || trashed}
    />
    {#if post?.status === 'published'}<p>
        Saving immediately updates the public post.
      </p>{/if}
    {#if !trashed}<div class="actions">
        <button disabled={busy || uploadingImages}
          >{post?.status === 'published'
            ? 'Save and update public post'
            : post
              ? 'Save'
              : 'Create draft'}</button
        >
        {#if !post || post.status === 'draft'}<button
            formaction="?/publish"
            disabled={busy || uploadingImages}>Publish</button
          >
        {:else if post.status === 'archived'}<button
            formaction="?/republish"
            disabled={busy || uploadingImages}>Republish</button
          >{/if}
      </div>{/if}
  </fieldset>
</form>
{#if post}
  <div class="actions">
    {#if trashed}<form method="POST" action="?/restore" use:enhance={submit}>
        <input type="hidden" name="revision" value={revision} /><button
          disabled={busy || uploadingImages}>Restore</button
        >
      </form>
    {:else}
      {#if post.status === 'published'}<form
          method="POST"
          action="?/archive"
          data-operation="archive"
          use:enhance={submit}
        >
          <input type="hidden" name="revision" value={revision} /><button
            disabled={busy || uploadingImages || !hydrated}>Archive</button
          >
        </form>{/if}
      <form
        method="POST"
        action="?/trash"
        data-operation="trash"
        use:enhance={submit}
      >
        <input type="hidden" name="revision" value={revision} /><button
          disabled={busy || uploadingImages || !hydrated}>Move to trash</button
        >
      </form>
    {/if}
  </div>
{/if}

<noscript
  ><p>JavaScript is required for archive and trash confirmation.</p></noscript
>

<style>
  fieldset {
    border: 1px solid #ccc;
    padding: 1rem;
    min-width: 0;
    margin-block: 1rem;
  }
  label {
    display: grid;
    gap: 0.3rem;
    margin-block: 0.8rem;
  }
  input,
  select,
  textarea,
  button {
    font: inherit;
    padding: 0.5rem;
  }
  input,
  select,
  textarea {
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
  }
  textarea {
    resize: vertical;
    font-family: ui-monospace, monospace;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.75rem;
  }
  p {
    overflow-wrap: anywhere;
  }
</style>

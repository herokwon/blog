<script lang="ts">
  import { onMount } from 'svelte';
  import MarkdownEditor from '#lib/components/MarkdownEditor.svelte';
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
  }: {
    post?: Awaited<ReturnType<typeof getPost>>;
    options: Awaited<ReturnType<typeof editorOptions>>;
    form?: PostFailure | null;
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
  let newTag = $state('');
  let markdownEditor: { read(): string } | undefined = $state();
  let savedNavigation = $state(false);
  let uploadingImages = $state(false);
  let submitError = $state('');
  function snapshot(input: PostInput, pendingTag = '') {
    return JSON.stringify([
      input.title,
      input.body,
      input.slug,
      input.categoryId,
      input.tags,
      pendingTag,
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
      (uploadingImages || snapshot(values, newTag) !== baseline()),
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
  });
  let slugMessage = $state('');
  const revision = $derived(form?.revision ?? post?.revision ?? '');
  const trashed = $derived(Boolean(post?.deletedAt));
  $effect(() => {
    const initial = initialValues();
    // Failed enhanced submissions keep the current fields and original revision.
    // A native failed submission initializes from the server-returned input.
    if (!form) {
      values = initial;
      newTag = '';
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
      values.body = markdownEditor?.read() ?? values.body;
      formData.set('body', values.body);
    }
    submitError = '';
    busy = true;
    return async ({ result, update }) => {
      savedNavigation = result.type === 'redirect';
      try {
        if (result.type === 'error') {
          submitError =
            'The request could not be completed. Your input has been kept. Please retry.';
          return;
        }
        await update({ reset: false });
      } finally {
        savedNavigation = false;
        busy = false;
      }
    };
  };
  function addTag() {
    const name = newTag.trim();
    if (name && !values.tags.includes(name) && values.tags.length < 20) {
      values.tags.push(name);
      newTag = '';
    }
  }
</script>

{#if submitError || form}<p role="alert">{submitError || form?.message}</p>{/if}
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
        name="categoryId"
        aria-label="Category"
        bind:value={values.categoryId}
        disabled={busy || uploadingImages}
      >
        <option value="">No category</option>
        {#each options.categories as category (category.id)}<option
            value={category.id}>{category.name}</option
          >{/each}
      </select></label
    >
    <fieldset>
      <legend>Tags (up to 20, 40 characters each)</legend>
      {#each values.tags as tag, index (index)}
        <div class="tag">
          <label
            >Tag {index + 1}
            <input
              name="tags"
              bind:value={values.tags[index]}
              list="existing-tags"
              readonly={busy}
            /></label
          >
          <button
            type="button"
            disabled={busy || uploadingImages}
            onclick={() => values.tags.splice(index, 1)}
            >Remove {tag || 'empty tag'}</button
          >
        </div>
      {/each}
      <div class="tag">
        <label
          >Add tag <input
            name="tags"
            bind:value={newTag}
            list="existing-tags"
            readonly={busy}
          /></label
        >
        <button
          type="button"
          disabled={busy || uploadingImages || values.tags.length >= 20}
          onclick={addTag}>Add tag</button
        >
      </div>
      <datalist id="existing-tags"
        >{#each options.tags as name (name)}<option value={name}
          ></option>{/each}</datalist
      >
      <p>
        Select an existing tag or enter a new name. Clear a tag to detach it.
      </p>
    </fieldset>
    {#if !trashed}<div class="actions">
        <button disabled={busy || uploadingImages}
          >{post ? 'Save' : 'Create draft'}</button
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
  .actions,
  .tag {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.75rem;
  }
  .tag label {
    flex: 1;
    min-width: 10rem;
  }
  .tag button {
    margin-bottom: 0.8rem;
  }
  p {
    overflow-wrap: anywhere;
  }
</style>

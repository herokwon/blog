<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { requestFailure } from '#lib/form-feedback.js';
  import { enhance, type SubmitFunction } from '$app/forms';
  import { resolve } from '$app/paths';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
  let createName = $state(
    untrack(() =>
      form?.operation === 'create' && !form.ok && typeof form.name === 'string'
        ? form.name
        : '',
    ),
  );
  let renameInputs = $state<Record<string, string>>({});
  let busy = $state(false);
  let submitError = $state('');
  let alertElement = $state<HTMLParagraphElement>();
  const errorMessage = $derived(
    submitError ||
      (form && !form.ok && typeof form.message === 'string'
        ? form.message
        : ''),
  );
  async function focusError() {
    await tick();
    alertElement?.focus();
  }
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
    if (errorMessage) void focusError();
  });
  const submit: SubmitFunction = ({ formElement, cancel }) => {
    if (busy) {
      cancel();
      return;
    }
    if (
      formElement.dataset.operation === 'delete' &&
      !window.confirm('Delete this category?')
    ) {
      cancel();
      return;
    }
    submitError = '';
    busy = true;
    return async ({ result, update }) => {
      try {
        if (result.type === 'redirect') {
          submitError = requestFailure(401);
          return;
        }
        if (result.type === 'error') {
          submitError = requestFailure(result.status ?? result.error.status);
          return;
        }
        await update({ reset: false });
        if (
          result.type === 'success' &&
          formElement.dataset.operation === 'create'
        )
          createName = '';
        if (
          result.type === 'success' &&
          formElement.dataset.operation !== 'create'
        ) {
          const id = new FormData(formElement).get('id');
          if (typeof id === 'string') delete renameInputs[id];
        }
      } finally {
        busy = false;
        if (submitError || result.type === 'failure') await focusError();
      }
    };
  };
</script>

<svelte:head><title>Categories · Administration</title></svelte:head>
<h1>Categories</h1>
<p>
  Names must be unique and contain 1–20 characters. Surrounding whitespace is
  removed.
</p>
<noscript>
  <p>JavaScript is required for category deletion confirmation.</p>
</noscript>
{#if errorMessage}<p role="alert" tabindex="-1" bind:this={alertElement}>
    {errorMessage}
  </p>{:else if form}
  {#if form.ok}<p role="status">
      Category {form.operation === 'create'
        ? 'created'
        : form.operation === 'rename'
          ? 'renamed'
          : 'deleted'}.
    </p>
  {/if}
{/if}

<form
  method="POST"
  action={`?/create&page=${data.page}`}
  aria-label="Create category"
  data-operation="create"
  use:enhance={submit}
>
  <label
    >Category name <input
      name="name"
      readonly={busy}
      required
      bind:value={createName}
    /></label
  >
  <button disabled={busy}>Create category</button>
</form>

{#if data.categories.length === 0}<p>No categories on this page.</p>{/if}
<ul>
  {#each data.categories as category (category.id)}
    <li>
      <h2>{category.name}</h2>
      <p>
        Used by {category.usage}
        {category.usage === 1 ? 'post' : 'posts'} (all states, including trash).
      </p>
      <form
        method="POST"
        action={`?/rename&page=${data.page}`}
        aria-label={`Rename ${category.name}`}
        use:enhance={submit}
      >
        <input type="hidden" name="id" value={category.id} />
        <label
          >Category name <input
            name="name"
            readonly={busy}
            required
            oninput={event => {
              renameInputs[category.id] = event.currentTarget.value;
            }}
            value={renameInputs[category.id] ??
              (form?.operation === 'rename' &&
              form.id === category.id &&
              !form.ok
                ? form.name
                : category.name)}
          /></label
        >
        <button disabled={busy}>Save name</button>
      </form>
      <form
        method="POST"
        action={`?/delete&page=${data.page}`}
        data-operation="delete"
        aria-label={`Delete ${category.name}`}
        use:enhance={submit}
      >
        <input type="hidden" name="id" value={category.id} />
        <button disabled={busy || !hydrated}>Delete category</button>
      </form>
    </li>
  {/each}
</ul>
<nav aria-label="Category pages">
  {#if data.page > 1}<a
      href={resolve(`/admin/categories?page=${data.page - 1}`)}>Previous</a
    >{/if}
  <span>Page {data.page}</span>
  {#if data.hasNext}<a href={resolve(`/admin/categories?page=${data.page + 1}`)}
      >Next</a
    >{/if}
</nav>

<style>
  form {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.75rem;
    margin-block: 0.75rem;
  }
  label {
    min-width: 0;
    max-width: 100%;
    display: grid;
    gap: 0.25rem;
  }
  input,
  button {
    font: inherit;
    padding: 0.5rem;
  }
  ul {
    list-style: none;
    padding: 0;
  }
  li {
    border-top: 1px solid #ccc;
    padding-block: 1rem;
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
    overflow-wrap: anywhere;
  }
  nav {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }
</style>

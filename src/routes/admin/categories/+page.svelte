<script lang="ts">
  import { onMount } from 'svelte';
  import { enhance, type SubmitFunction } from '$app/forms';
  import { resolve } from '$app/paths';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
  let busy = $state(false);
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
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
    busy = true;
    return async ({ result, update }) => {
      try {
        await update({ reset: false });
        if (
          result.type === 'success' &&
          formElement.dataset.operation === 'create'
        )
          formElement.reset();
      } finally {
        busy = false;
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
{#if form}
  {#if form.ok}<p role="status">
      Category {form.operation === 'create'
        ? 'created'
        : form.operation === 'rename'
          ? 'renamed'
          : 'deleted'}.
    </p>
  {:else}<p role="alert">{form.message}</p>{/if}
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
      value={form?.operation === 'create' && !form.ok ? form.name : ''}
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
            value={form?.operation === 'rename' &&
            form.id === category.id &&
            !form.ok
              ? form.name
              : category.name}
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

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { requestFailure } from '#lib/form-feedback.js';
  import { enhance, type SubmitFunction } from '$app/forms';
  import { resolve } from '$app/paths';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
  let busy = $state(false),
    hydrated = $state(false),
    submitError = $state('');
  let attemptedNames = $state<Record<string, string>>({});
  let alertElement = $state<HTMLParagraphElement>();
  let createButton = $state<HTMLButtonElement>();
  const errorMessage = $derived(
    submitError ||
      (form && !form.ok && typeof form.message === 'string'
        ? form.message
        : ''),
  );
  onMount(() => {
    hydrated = true;
  });
  const submit: SubmitFunction = ({ formElement, formData, cancel }) => {
    if (!hydrated || busy) {
      cancel();
      return;
    }
    const operation = formElement.dataset.operation!;
    const idValue = formData.get('id');
    const id = typeof idValue === 'string' ? idValue : '';
    const key = operation + ':' + id;
    formElement.closest('details')?.removeAttribute('open');
    if (operation === 'delete') {
      if (Number(formElement.dataset.usage) > 0) {
        window.alert(
          'This category is used by posts, including drafts, archived posts or trash. Reassign those posts before deleting it.',
        );
        cancel();
        return;
      }
      if (!window.confirm(`Delete “${formElement.dataset.name}”?`)) {
        cancel();
        return;
      }
    } else {
      const previous =
        attemptedNames[key] ??
        (form && !form.ok && form.operation === operation && form.id === id
          ? form.name
          : (formElement.dataset.name ?? ''));
      const name = window.prompt(
        operation === 'create'
          ? 'Category name (1–20 characters)'
          : 'Rename category (1–20 characters)',
        previous,
      );
      if (name === null) {
        cancel();
        return;
      }
      attemptedNames[key] = name;
      formData.set('name', name);
    }
    busy = true;
    submitError = '';
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
          result.type === 'failure' &&
          result.data?.code === 'category_in_use'
        )
          window.alert(String(result.data.message));
        if (result.type === 'success') delete attemptedNames[key];
      } finally {
        busy = false;
        await tick();
        if (submitError || result.type === 'failure') alertElement?.focus();
        else {
          const menu = document
            .getElementById('category-' + id)
            ?.querySelector('summary');
          (menu ?? createButton)?.focus();
        }
      }
    };
  };
</script>

<svelte:head><title>Categories · Administration</title></svelte:head>
<h1>Categories</h1>
<p>
  Names must be unique and contain 1–20 characters. Usage includes all post
  states and trash.
</p>
<noscript><p>JavaScript is required to manage categories.</p></noscript>
{#if errorMessage}<p role="alert" tabindex="-1" bind:this={alertElement}>
    {errorMessage}
  </p>
{:else if form?.ok}<p role="status">
    Category {form.operation === 'create'
      ? 'created'
      : form.operation === 'rename'
        ? 'renamed'
        : 'deleted'}.
  </p>{/if}
<form
  method="POST"
  action={`?/create&page=${data.page}`}
  aria-label="Create category"
  data-operation="create"
  use:enhance={submit}
>
  <button bind:this={createButton} disabled={!hydrated || busy}
    >Create category</button
  >
</form>
{#if !data.categories.length}<p>No categories on this page.</p>{/if}
<ul>
  {#each data.categories as category (category.id)}
    <li id={`category-${category.id}`} data-category-id={category.id}>
      <h2>{category.name}</h2>
      <span>{category.usage} {category.usage === 1 ? 'post' : 'posts'}</span>
      <details>
        <summary aria-label="Category actions">⋯</summary>
        <form
          method="POST"
          action={`?/rename&page=${data.page}`}
          data-operation="rename"
          data-name={category.name}
          use:enhance={submit}
        >
          <input type="hidden" name="id" value={category.id} />
          <button disabled={!hydrated || busy}>Rename</button>
        </form>
        <form
          method="POST"
          action={`?/delete&page=${data.page}`}
          data-operation="delete"
          data-name={category.name}
          data-usage={category.usage}
          use:enhance={submit}
        >
          <input type="hidden" name="id" value={category.id} />
          <button disabled={!hydrated || busy}>Delete</button>
        </form>
      </details>
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
  ul {
    list-style: none;
    padding: 0;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 1rem;
    padding-block: 0.75rem;
    border-top: 1px solid #ccc;
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
    overflow-wrap: anywhere;
    min-width: 0;
  }
  button {
    font: inherit;
    padding: 0.5rem;
  }
  summary {
    cursor: pointer;
    padding: 0.5rem;
  }
  nav {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }
  p {
    overflow-wrap: anywhere;
  }
</style>

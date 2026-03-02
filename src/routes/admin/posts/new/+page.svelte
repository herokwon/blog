<script lang="ts">
  import { onMount } from 'svelte';

  import type { ApiResponse } from '$lib/types/api';
  import type { CreatePostInput, Post } from '$lib/types/post';

  const STORAGE_KEY = 'draftPost';

  let title = $state('');
  let content = $state('');

  const canSaveDraft = $derived(
    title.trim().length > 0 || content.trim().length > 0,
  );

  onMount(() => {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (!rawData) return;

    const { title: t, content: c } = JSON.parse(rawData) as CreatePostInput;
    title = t;
    content = c;
  });

  let isSubmitting = $state(false);
  let result = $state<
    { type: 'success'; data: Post } | { type: 'error'; message: string } | null
  >(null);

  function handleSaveDraft() {
    if (!canSaveDraft) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ title, content } satisfies CreatePostInput),
    );
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    isSubmitting = true;
    result = null;

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      const apiResponse: ApiResponse<Post> = await res.json();

      result = apiResponse.success
        ? { type: 'success', ...apiResponse }
        : {
            type: 'error',
            ...apiResponse.error,
          };

      if (apiResponse.success) {
        title = '';
        content = '';
      }
    } catch (error) {
      result = {
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while submitting the post.',
      };
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>New post</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-12">
  <h1 class="mb-8 text-2xl font-bold text-gray-900">New post</h1>

  {#if result}
    {#if result.type === 'success'}
      <div class="mb-6 rounded-md border border-green-200 bg-green-50 p-4">
        <p class="text-sm font-medium text-green-800">
          Created a new post successfully!
        </p>
        <p class="mt-1 text-xs text-green-600">ID: {result.data.id}</p>
      </div>
    {:else}
      <div class="mb-6 rounded-md border border-red-200 bg-red-50 p-4">
        <p class="text-sm font-medium text-red-800">{result.message}</p>
      </div>
    {/if}
  {/if}

  <form onsubmit={handleSubmit} class="space-y-5">
    <div class="flex justify-end gap-x-4">
      <button
        type="button"
        disabled={isSubmitting || !canSaveDraft}
        onclick={handleSaveDraft}
        class="mr-2 rounded-md bg-gray-500 px-5 py-2 text-sm font-medium text-white hover:bg-gray-400"
      >
        Save draft
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        class="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </div>

    <div>
      <label for="title" class="mb-1.5 block text-sm font-medium text-gray-700">
        Title
      </label>
      <input
        id="title"
        type="text"
        bind:value={title}
        required
        placeholder="Enter post title."
        class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
      />
    </div>

    <div>
      <label
        for="content"
        class="mb-1.5 block text-sm font-medium text-gray-700"
      >
        Content
      </label>
      <textarea
        id="content"
        bind:value={content}
        required
        placeholder="Enter post content."
        rows={16}
        class="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
      ></textarea>
    </div>
  </form>
</div>

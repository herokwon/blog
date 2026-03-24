<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { Editor } from '$lib/components/editor';
  import {
    clearDraftImages,
    createImageManager,
    loadDraftImages,
    saveDraftImages,
  } from '$lib/services';
  import type { CreatePostApiResponse } from '$lib/types/api';
  import type { PostInput } from '$lib/types/post';

  const STORAGE_KEY = 'DRAFT_POST';

  const imageManager = createImageManager();

  let postData = $state<PostInput>({
    title: '',
    content: '',
  });

  let isSubmitting = $state(false);
  let isDraftLoaded = $state<boolean>(false);
  let imageError = $state<string | null>(null);

  const canSave = $derived(
    postData.title.trim().length > 0 && postData.content.trim().length > 0,
  );
  const canSaveDraft = $derived(
    postData.title.trim().length > 0 || postData.content.trim().length > 0,
  );

  function clearData() {
    postData = {
      title: '',
      content: '',
    };
    imageManager.cleanup();
  }

  async function handleSaveDraft() {
    if (!canSaveDraft) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(postData));

    const pendingImages = imageManager.getPendingImages();
    try {
      if (pendingImages.length > 0) {
        await saveDraftImages(pendingImages);
      } else {
        await clearDraftImages();
      }
    } catch (error) {
      console.warn('Failed to save draft images:', error);
    }
  }

  function handleImageAdd(file: File, blobUrl: string) {
    imageManager.registerImage(file, blobUrl);
    imageError = null;
  }

  function handleImageError(error: string) {
    imageError = error;
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    isSubmitting = true;

    try {
      let finalContent = postData.content;

      if (imageManager.hasPending) {
        const urlMap = await imageManager.uploadAll();

        for (const [blobUrl, r2Url] of urlMap) {
          finalContent = finalContent.replaceAll(blobUrl, r2Url);
        }
      }

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...postData, content: finalContent }),
      });
      const apiResponse: CreatePostApiResponse = await res.json();

      if (apiResponse.success) {
        clearData();
        localStorage.removeItem(STORAGE_KEY);

        try {
          await clearDraftImages();
        } catch (error) {
          console.warn('Failed to clear draft images after submit:', error);
        }

        await goto(resolve(`/posts/${apiResponse.data.id}`));
      }
    } finally {
      isSubmitting = false;
    }
  }

  onMount(async () => {
    try {
      const rawData = localStorage.getItem(STORAGE_KEY);
      if (rawData) {
        const { title, content } = JSON.parse(rawData) satisfies PostInput;
        postData.title = title;
        postData.content = content;
      }

      const savedImages = await loadDraftImages();
      if (savedImages.length > 0) {
        for (const { blobUrl, file } of savedImages) {
          const newBlobUrl = URL.createObjectURL(file);
          imageManager.registerImage(file, newBlobUrl);
          postData.content = postData.content.replaceAll(blobUrl, newBlobUrl);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(postData));

        const pendingImages = imageManager.getPendingImages();
        if (pendingImages.length > 0) {
          await clearDraftImages();
          await saveDraftImages(pendingImages);
        }
      } else {
        await clearDraftImages();
      }
    } catch (error) {
      console.error(
        'Failed to load draft post from localStorage or IndexedDB:',
        error,
      );
    } finally {
      isDraftLoaded = true;
    }
  });

  onDestroy(() => {
    imageManager.cleanup();
  });
</script>

<svelte:head>
  <title>New post</title>
</svelte:head>

<div class="mx-auto flex h-full min-h-screen max-w-5xl flex-col px-4 py-12">
  <h1 class="mb-8 text-2xl font-bold text-gray-900">New post</h1>
  <form onsubmit={handleSubmit} class="flex min-h-0 flex-1 flex-col gap-y-4">
    <div
      class="flex justify-end gap-x-2 **:[button]:rounded-md **:[button]:px-4 **:[button]:py-2 **:[button]:text-sm **:[button]:font-medium"
    >
      <button
        type="button"
        disabled={isSubmitting || !canSaveDraft}
        onclick={handleSaveDraft}
        class="bg-gray-500 text-white not-disabled:hover:bg-gray-600"
      >
        Save draft
      </button>
      <button
        type="submit"
        disabled={isSubmitting || !canSave}
        class="bg-blue-600 text-white not-disabled:hover:bg-blue-700"
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </div>
    {#if imageError}
      <div class="rounded-md bg-red-50 p-3 text-sm text-red-700">
        {imageError}
      </div>
    {/if}
    <div class="space-y-2">
      <label for="title" class="block text-sm font-medium">Title</label>
      <input
        id="title"
        type="text"
        bind:value={postData.title}
        required
        placeholder="Enter the post title"
        class="w-full rounded-md border-0 px-4 py-3 text-gray-900 placeholder-gray-400 ring ring-gray-300 outline-none focus:ring-gray-700"
      />
    </div>
    <div class="flex h-full flex-col gap-y-2">
      <p class="block text-sm font-medium">Content</p>
      {#if isDraftLoaded}
        <Editor
          bind:content={postData.content}
          onImageAdd={handleImageAdd}
          onImageError={handleImageError}
          class="flex-1"
        />
      {:else}
        <div class="milkdown-container flex-1"></div>
      {/if}
    </div>
  </form>
</div>

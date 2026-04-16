<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  import { beforeNavigate, goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { Editor } from '$lib/components/editor';
  import { createImageManager } from '$lib/services';
  import { createVideoManager } from '$lib/services/video-manager';
  import type { UpdatePostByIdApiResponse } from '$lib/types/api';
  import type { PostInput } from '$lib/types/post';

  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const imageManager = createImageManager();
  const videoManager = createVideoManager();

  let postData = $state<PostInput>({
    title: '',
    content: '',
  });
  let currentPostId = $state<unknown | null>(null);
  let imageError = $state<string | null>(null);
  let videoError = $state<string | null>(null);

  $effect(() => {
    if (currentPostId === data.post.id) return;

    postData = {
      title: data.post.title,
      content: data.post.content,
    };
    currentPostId = data.post.id;

    imageManager.cleanup();
    videoManager.cleanup();
  });

  let isSubmitting = $state(false);

  const isChanged = $derived(
    postData.title !== data.post.title ||
      postData.content !== data.post.content,
  );
  const canSave = $derived(
    postData.title.trim().length > 0 &&
      postData.content.trim().length > 0 &&
      isChanged,
  );

  function handleImageAdd(file: File, blobUrl: string) {
    imageManager.registerImage(file, blobUrl);
    imageError = null;
  }

  function handleImageError(error: string) {
    imageError = error;
  }

  function handleVideoAdd(file: File, blobUrl: string) {
    videoManager.queueVideo(file, blobUrl);
    videoError = null;
  }

  function handleVideoError(error: string) {
    videoError = error;
  }

  async function handleCancel() {
    await goto(resolve('/admin/posts'));
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();

    const confirmed = confirm('Update this post?');
    if (!confirmed) return;

    isSubmitting = true;

    try {
      let finalContent = postData.content;

      if (imageManager.hasPending) {
        const urlMap = await imageManager.uploadAll();

        for (const [blobUrl, r2Url] of urlMap) {
          finalContent = finalContent.replaceAll(blobUrl, r2Url);
        }
      }

      if (videoManager.hasPending) {
        const urlMap = await videoManager.uploadAll();

        for (const [blobUrl, r2Url] of urlMap) {
          finalContent = finalContent.replaceAll(blobUrl, r2Url);
        }
      }

      const res = await fetch(`/api/posts/${data.post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...postData, content: finalContent }),
      });
      const apiResponse: UpdatePostByIdApiResponse = await res.json();

      if (apiResponse.success) {
        imageManager.cleanup();
        videoManager.cleanup();

        await goto(resolve(`/posts/${apiResponse.data.id}`));
      }
    } finally {
      isSubmitting = false;
    }
  }

  beforeNavigate(navigation => {
    if (!navigation.to || !isChanged || isSubmitting) return;

    const confirmed = confirm('You have unsaved changes. Leave this page?');
    if (!confirmed) navigation.cancel();
  });

  onMount(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isChanged || isSubmitting) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });

  onDestroy(() => {
    imageManager.cleanup();
    videoManager.cleanup();
  });
</script>

<svelte:head>
  <title>Edit post</title>
</svelte:head>

<div class="mx-auto flex h-full min-h-screen max-w-5xl flex-col px-4 py-12">
  <a
    href={resolve('/admin/posts')}
    class="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-900"
  >
    ← Back to posts
  </a>
  <h1 class="mb-8 text-2xl font-bold text-gray-900">Edit post</h1>
  <form onsubmit={handleSubmit} class="flex min-h-0 flex-1 flex-col gap-y-4">
    <div
      class="flex justify-end gap-x-2 **:[button]:rounded-md **:[button]:px-4 **:[button]:py-2 **:[button]:text-sm **:[button]:font-medium"
    >
      <button
        type="button"
        onclick={handleCancel}
        class="bg-white text-gray-700 ring ring-gray-300 not-disabled:hover:bg-gray-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitting || !canSave}
        class="bg-blue-600 text-white not-disabled:hover:bg-blue-700"
      >
        {isSubmitting ? 'Updating...' : 'Update'}
      </button>
    </div>
    {#if imageError}
      <div class="rounded-md bg-red-50 p-3 text-sm text-red-700">
        {imageError}
      </div>
    {/if}
    {#if videoError}
      <div class="rounded-md bg-red-50 p-3 text-sm text-red-700">
        {videoError}
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
      {#if currentPostId === data.post.id}
        <Editor
          bind:content={postData.content}
          onImageAdd={handleImageAdd}
          onImageError={handleImageError}
          onVideoAdd={handleVideoAdd}
          onVideoError={handleVideoError}
          class="flex-1"
        />
      {:else}
        <div class="milkdown-container flex-1"></div>
      {/if}
    </div>
  </form>
</div>

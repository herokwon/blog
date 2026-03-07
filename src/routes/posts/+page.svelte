<script lang="ts">
  import { resolve } from '$app/paths';

  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function getExcerpt(markdown: string, max = 200) {
    const text = markdown
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
      .replace(/[#*`_>~-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > max ? text.slice(0, max) + '…' : text;
  }
</script>

<svelte:head>
  <title>Posts</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-12">
  <h1 class="mb-10 text-3xl font-bold tracking-tight text-gray-900">Posts</h1>

  {#if data.loadError}
    <div class="rounded-md border border-red-200 bg-red-50 p-4">
      <p class="text-sm text-red-700">{data.loadError}</p>
    </div>
  {:else if data.posts.length === 0}
    <p class="text-gray-500">No posts yet.</p>
  {:else}
    <ul class="divide-y divide-gray-100">
      {#each data.posts as post (post.id)}
        <li class="py-8">
          <a href={resolve(`/posts/${post.id}`)} class="group block space-y-2">
            <div class="flex justify-between">
              <h2
                class="text-xl font-semibold text-gray-900 transition-colors group-hover:text-blue-600"
              >
                {post.title}
              </h2>
              <time
                class="block text-sm text-gray-400"
                datetime={post.createdAt}
              >
                {formatDate(post.createdAt)}
              </time>
            </div>
            <p class="line-clamp-3 leading-relaxed text-gray-600">
              {getExcerpt(post.content)}
            </p>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

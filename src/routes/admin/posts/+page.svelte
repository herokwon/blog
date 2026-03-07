<script lang="ts">
  import { resolve } from '$app/paths';

  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
</script>

<svelte:head>
  <title>Posts — Admin</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-12">
  <div class="mb-8 flex items-center justify-between">
    <h1 class="text-2xl font-bold text-gray-900">Posts</h1>
    <a
      href={resolve('/admin/posts/new')}
      class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
    >
      New post
    </a>
  </div>

  {#if data.loadError}
    <div class="rounded-md border border-red-200 bg-red-50 p-4">
      <p class="text-sm text-red-700">{data.loadError}</p>
    </div>
  {:else if data.posts.length === 0}
    <div
      class="rounded-lg border-2 border-dashed border-gray-200 py-16 text-center"
    >
      <p class="text-gray-400">No posts yet.</p>
      <a
        href={resolve('/admin/posts/new')}
        class="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
      >
        Write the first post →
      </a>
    </div>
  {:else}
    <div class="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-left">
          <tr>
            <th class="px-4 py-3 font-medium text-gray-500">Title</th>
            <th class="hidden px-4 py-3 font-medium text-gray-500 md:table-cell"
              >Created</th
            >
            <th class="hidden px-4 py-3 font-medium text-gray-500 lg:table-cell"
              >Updated</th
            >
            <th class="px-4 py-3 text-right font-medium text-gray-500"
              >Actions</th
            >
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          {#each data.posts as post (post.id)}
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3">
                <a href={resolve(`/posts/${post.id}`)} class="group">
                  <strong
                    class="font-medium text-gray-900 group-hover:text-blue-600 group-hover:underline"
                  >
                    {post.title}
                  </strong>
                  <p class="mt-0.5 font-mono text-xs text-gray-400">
                    {post.id}
                  </p>
                </a>
              </td>
              <td class="hidden px-4 py-3 text-gray-500 md:table-cell">
                {formatDate(post.createdAt)}
              </td>
              <td class="hidden px-4 py-3 text-gray-500 lg:table-cell">
                {formatDate(post.updatedAt)}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-4">
                  <a
                    href={resolve(`/admin/posts/${post.id}/edit`)}
                    class="text-gray-500 hover:text-blue-600"
                  >
                    Edit
                  </a>
                  <a
                    href={resolve(`/posts/${post.id}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-gray-500 hover:text-blue-600"
                  >
                    View ↗
                  </a>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-right text-xs text-gray-400">
      {data.posts.length} post{data.posts.length !== 1 ? 's' : ''}
    </p>
  {/if}
</div>

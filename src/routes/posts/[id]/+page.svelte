<script lang="ts">
  import { resolve } from '$app/paths';
  import { Editor } from '$lib/components/editor';

  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
</script>

<svelte:head>
  <title>{data.post.title}</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-12">
  <a
    href={resolve('/posts')}
    class="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-900"
  >
    ← All posts
  </a>
  <article class="space-y-8 py-8">
    <header class="space-y-2 text-center">
      <h1 class="text-3xl font-bold tracking-tight text-gray-900">
        {data.post.title}
      </h1>
      <time class="block text-sm text-gray-400" datetime={data.post.createdAt}>
        {formatDate(data.post.createdAt)}
      </time>
    </header>
    <Editor content={data.post.content} readOnly />
  </article>
</div>

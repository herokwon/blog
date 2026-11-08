<script lang="ts">
  import ReaderLayout from '#lib/components/ReaderLayout.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<svelte:head><title>{data.post.title} · Personal Blog</title></svelte:head>
<ReaderLayout>
  <article>
    <h1>{data.post.title}</h1>
    <p>
      <time datetime={data.post.publishedAt}
        >{data.post.publishedAt.slice(0, 10)}</time
      >
      · {data.post.category}
    </p>
    {#if data.post.tags.length}<ul aria-label="Tags">
        {#each data.post.tags as tag (tag)}<li>{tag}</li>{/each}
      </ul>{/if}
    <div class="content">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- Only the server-side sanitized Markdown pipeline supplies this HTML. -->
      {@html data.post.html}
    </div>
  </article>
</ReaderLayout>

<style>
  h1 {
    line-height: 1.3;
  }
  article {
    min-width: 0;
  }
  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    list-style: none;
    padding: 0;
  }
  li {
    background: #f4f4f4;
    border-radius: 0.25rem;
    padding: 0.1rem 0.6rem;
  }
  .content {
    margin-top: 2rem;
    overflow-x: auto;
  }
</style>

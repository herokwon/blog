<script lang="ts">
  import ReaderLayout from '#lib/components/ReaderLayout.svelte';
  import { SITE_ORIGIN } from '#lib/site.js';
  import { resolve } from '$app/paths';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const canonical = $derived(SITE_ORIGIN + '/posts/' + data.post.slug);
</script>

<svelte:head
  ><title>{data.post.title} · Personal Blog</title>
  <meta name="description" content={data.post.description} /><link
    rel="canonical"
    href={canonical}
  />
  <meta property="og:title" content={data.post.title} /><meta
    property="og:description"
    content={data.post.description}
  />
  <meta property="og:url" content={canonical} /><meta
    property="og:type"
    content="article"
  />
</svelte:head>
<ReaderLayout>
  <article>
    <h1>{data.post.title}</h1>
    <p>
      <time datetime={data.post.publishedAt}
        >{data.post.publishedAt.slice(0, 10)}</time
      >
      ·
      <a
        href={resolve(`/?category=${encodeURIComponent(data.post.categoryId)}`)}
        >{data.post.category}</a
      >
    </p>
    {#if data.post.tags.length}<ul aria-label="Tags">
        {#each data.post.tags as tag (tag)}<li>
            <a href={resolve(`/?tag=${encodeURIComponent(tag)}`)}>{tag}</a>
          </li>{/each}
      </ul>{/if}
    {#if data.post.toc.length}
      <nav class="toc" aria-label="Table of contents">
        <h2>Contents</h2>
        <ol>
          {#each data.post.toc as entry (entry.id)}<li>
              <a href={'#' + entry.id}>{entry.title || 'Section'}</a>
            </li>{/each}
        </ol>
      </nav>
    {/if}
    <div class="content reader-prose">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- Only the server-side sanitized Markdown pipeline supplies this HTML. -->
      {@html data.post.html}
    </div>
  </article>
</ReaderLayout>

<style>
  .toc {
    margin-block: 1.5rem;
  }
  .toc h2 {
    font-size: 1.15rem;
  }
  .toc ol {
    padding-inline-start: 1.5rem;
  }
  .toc li {
    background: none;
    padding: 0;
  }
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
  }
</style>

<script lang="ts">
  import ReaderLayout from '#lib/components/ReaderLayout.svelte';
  import { resolve } from '$app/paths';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<svelte:head><title>Personal Blog</title></svelte:head>
<ReaderLayout>
  <h1>Personal Blog</h1>
  {#if data.posts.length === 0}<p>No published posts yet.</p>{/if}
  <ul class="posts">
    {#each data.posts as post (post.slug)}<li>
        <h2>
          <a href={resolve('/posts/[slug]', { slug: post.slug })}
            >{post.title}</a
          >
        </h2>
        <p>
          <time datetime={post.publishedAt}
            >{post.publishedAt.slice(0, 10)}</time
          >
          · {post.category}
        </p>
      </li>{/each}
  </ul>
  <nav aria-label="Post pages">
    {#if data.page > 1}<a href={resolve(`/?page=${data.page - 1}`)}>Previous</a
      >{/if}
    <span>Page {data.page}</span>
    {#if data.hasNext}<a href={resolve(`/?page=${data.page + 1}`)}>Next</a>{/if}
  </nav>
</ReaderLayout>

<style>
  .posts {
    list-style: none;
    padding: 0;
  }
  li {
    padding-block: 1.25rem;
    border-bottom: 1px solid #ddd;
  }
  h2 {
    font-size: 1.35rem;
    margin-block: 0 0.4rem;
  }
  p {
    margin: 0;
  }
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 2rem;
  }
</style>

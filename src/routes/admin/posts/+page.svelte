<script lang="ts">
  import { resolve } from '$app/paths';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<svelte:head><title>Posts · Administration</title></svelte:head>
<h1>Posts</h1>
<a href={resolve('/admin/posts/new')}>New post</a>
<form method="GET" action={resolve('/admin/posts')}>
  <label
    >Status filter <select
      name="status"
      aria-label="Status filter"
      value={data.filter}
    >
      <option value="all">All active posts</option><option value="draft"
        >Draft</option
      ><option value="published">Published</option><option value="archived"
        >Archived</option
      ><option value="trash">Trash</option>
    </select></label
  >
  <button>Filter</button>
</form>
{#if data.posts.length === 0}<p>No posts on this page.</p>{/if}
<ul>
  {#each data.posts as post (post.id)}<li>
      <a href={resolve('/admin/posts/[id]', { id: post.id })}
        >{post.title || 'Untitled draft'}</a
      >
      <p>
        {post.deletedAt ? 'Trash' : post.status} · {post.category ??
          'No category'} ·
        <time datetime={post.updatedAt}>{post.updatedAt}</time>
      </p>
    </li>{/each}
</ul>
<nav aria-label="Post pages">
  {#if data.page > 1}<a
      href={resolve(`/admin/posts?status=${data.filter}&page=${data.page - 1}`)}
      >Previous</a
    >{/if}
  <span>Page {data.page}</span>
  {#if data.hasNext}<a
      href={resolve(`/admin/posts?status=${data.filter}&page=${data.page + 1}`)}
      >Next</a
    >{/if}
</nav>

<style>
  form,
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-block: 1.5rem;
  }
  select,
  button {
    font: inherit;
    padding: 0.5rem;
  }
  ul {
    padding-left: 1.25rem;
  }
  li {
    margin-block: 1.25rem;
  }
  a {
    overflow-wrap: anywhere;
  }
  p {
    margin-block: 0.25rem;
  }
  time {
    font-size: 0.875rem;
  }
</style>

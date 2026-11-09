<script lang="ts">
  import { resolve } from '$app/paths';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  function pageUrl(page: number) {
    return new URLSearchParams({
      status: data.filter,
      q: data.q,
      categoryId: data.categoryId,
      page: String(page),
    }).toString();
  }
</script>

<svelte:head><title>Posts · Administration</title></svelte:head>
<h1>Posts</h1>
<a href={resolve('/admin/posts/new')}>New post</a>
<form method="GET" action={resolve('/admin/posts')}>
  <label>Search titles <input name="q" value={data.q} maxlength="400" /></label>
  <label
    >Category filter <select
      name="categoryId"
      aria-label="Category filter"
      value={data.categoryId}
    >
      <option value="">All categories</option>
      {#each data.categories as category (category.id)}<option
          value={category.id}>{category.name}</option
        >{/each}
    </select></label
  >
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
  <a href={resolve('/admin/posts')}>Reset filters</a>
</form>
{#if data.posts.length === 0}<p>
    {data.q || data.categoryId || data.filter !== 'all'
      ? 'No posts match these filters.'
      : 'No posts on this page.'}
  </p>{/if}
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
  {#if data.page > 1}<a href={resolve(`/admin/posts?${pageUrl(data.page - 1)}`)}
      >Previous</a
    >{/if}
  <span>Page {data.page}</span>
  {#if data.hasNext}<a href={resolve(`/admin/posts?${pageUrl(data.page + 1)}`)}
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
  input,
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

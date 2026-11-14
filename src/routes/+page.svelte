<script lang="ts">
  import ReaderLayout from '#lib/components/ReaderLayout.svelte';
  import { SITE_ORIGIN } from '#lib/site.js';
  import { resolve } from '$app/paths';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  function pageUrl(page: number) {
    return new URLSearchParams({
      ...data.filters,
      page: String(page),
    }).toString();
  }
  const filtered = $derived(
    Boolean(data.filters.q || data.filters.category || data.filters.tag),
  );
  const canonical = $derived(
    SITE_ORIGIN + (!filtered && data.page > 1 ? '/?page=' + data.page : '/'),
  );
  const title = $derived(
    filtered
      ? 'Filtered posts · Personal Blog'
      : data.page > 1
        ? 'Page ' + data.page + ' · Personal Blog'
        : 'Personal Blog',
  );
</script>

<svelte:head>
  <title>{title}</title><meta
    name="description"
    content="Read the latest published posts on Personal Blog."
  />
  <link rel="canonical" href={canonical} />
  <meta property="og:title" content={title} /><meta
    property="og:description"
    content="Read the latest published posts on Personal Blog."
  />
  <meta property="og:url" content={canonical} /><meta
    property="og:type"
    content="website"
  />
</svelte:head>
<ReaderLayout>
  <h1>Personal Blog</h1>
  {#key data}
    <search>
      <form method="GET" action={resolve('/')}>
        <div>
          <label for="reader-q">Search titles</label><input
            id="reader-q"
            type="search"
            name="q"
            defaultValue={data.filters.q}
            maxlength="400"
            autocorrect="off"
            autocapitalize="none"
            spellcheck="false"
            enterkeyhint="search"
          />
        </div>
        <div>
          <label for="reader-category">Category filter</label><select
            id="reader-category"
            name="category"
            defaultValue={data.filters.category}
          >
            <option value="">All categories</option>
            {#if data.filters.category && !data.categories.some(category => category.id === data.filters.category)}<option
                value={data.filters.category}>Unavailable category</option
              >{/if}
            {#each data.categories as category (category.id)}<option
                value={category.id}>{category.name}</option
              >{/each}
          </select>
        </div>
        <div>
          <label for="reader-tag">Tag filter</label><select
            id="reader-tag"
            name="tag"
            defaultValue={data.filters.tag}
          >
            <option value="">All tags</option>
            {#if data.filters.tag && !data.tags.some(tag => tag.name === data.filters.tag)}<option
                value={data.filters.tag}>Unavailable tag</option
              >{/if}
            {#each data.tags as tag (tag.name)}<option value={tag.name}
                >{tag.name}</option
              >{/each}
          </select>
        </div>
        <button type="submit">Search</button><a href={resolve('/')}
          >Reset filters</a
        >
      </form>
    </search>
  {/key}
  {#if data.posts.length === 0}<p>
      {data.filters.q || data.filters.category || data.filters.tag
        ? 'No posts match these filters.'
        : data.page > 1
          ? 'No posts on this page.'
          : 'No published posts yet.'}
    </p>{/if}
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
          ·
          <a href={resolve(`/?category=${encodeURIComponent(post.categoryId)}`)}
            >{post.category}</a
          >
        </p>
      </li>{/each}
  </ul>
  <nav aria-label="Post pages">
    {#if data.page > 1}<a href={resolve(`/?${pageUrl(data.page - 1)}`)}
        >Previous</a
      >{/if}
    <span>Page {data.page}</span>
    {#if data.hasNext}<a href={resolve(`/?${pageUrl(data.page + 1)}`)}>Next</a
      >{/if}
  </nav>
</ReaderLayout>

<style>
  form {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: end;
    margin-block: 1.5rem;
  }
  form div {
    display: grid;
    gap: 0.3rem;
    min-width: 0;
    max-width: 100%;
  }
  input,
  select,
  button {
    font: inherit;
    font-size: max(1rem, 1em);
    padding: 0.6rem;
    min-height: 3rem;
    box-sizing: border-box;
    max-width: 100%;
    min-width: 0;
  }
  form > a {
    padding-block: 0.6rem;
  }
  @media (width < 30rem) {
    form div {
      width: 100%;
    }
  }
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

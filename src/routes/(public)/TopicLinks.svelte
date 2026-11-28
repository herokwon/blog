<script lang="ts">
  import { resolve } from '$app/paths';

  let {
    categories,
    tags,
  }: {
    categories: { id: number; name: string }[];
    tags: string[];
  } = $props();
</script>

{#each categories as category (category.id)}
  <a
    href={resolve('/(public)/categories/[id]', { id: String(category.id) })}
    data-sveltekit-preload-data="false"
  >
    {category.name}
  </a>
{/each}
{#each tags as tag (tag)}
  <a
    href={resolve('/(public)/tags/[name]', { name: tag })}
    data-sveltekit-preload-data="false"
  >
    #{tag}
  </a>
{/each}

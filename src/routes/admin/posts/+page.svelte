<script lang="ts">
  import PostList from '#lib/admin/PostList.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<PostList posts={data.posts} status={data.status} />

<script lang="ts">
  import PostForm from '#lib/components/PostForm.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>New post · Administration</title></svelte:head>
<h1>New post</h1>
<PostForm options={data.options} {form} />

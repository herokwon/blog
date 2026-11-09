<script lang="ts">
  import PostForm from '#lib/components/PostForm.svelte';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Edit post · Administration</title></svelte:head>
<h1>Edit post</h1>
<PostForm
  post={data.post}
  options={data.options}
  notice={data.notice}
  form={form && !('operation' in form) ? form : null}
/>

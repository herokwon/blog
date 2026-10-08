<script lang="ts">
  import PostForm from '$lib/admin/PostForm.svelte';

  let { data } = $props();
</script>

<svelte:head><title>글 편집</title></svelte:head>
{#key data.post.id}<PostForm post={data.post} />{/key}

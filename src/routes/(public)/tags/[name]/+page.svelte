<script lang="ts">
  import { resolve } from '$app/paths';

  import Archive from '../../Archive.svelte';
  import type { PageProps } from './$types';

  let { data, params }: PageProps = $props();
</script>

<Archive {...data} collectionHref={resolve('/(public)/tags/[name]', params)} />

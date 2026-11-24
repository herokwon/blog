<script lang="ts">
  import favicon from '#lib/assets/favicon.svg';

  import type { LayoutProps } from './$types';
  import DemoLinks from './demo/DemoLinks.svelte';
  import SessionHeader from './SessionHeader.svelte';

  let { children, data }: LayoutProps = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<SessionHeader signedIn={data.signedIn} returnTo={data.returnTo} />
{@render children()}
<DemoLinks />

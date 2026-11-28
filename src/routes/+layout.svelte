<script lang="ts">
  import { page } from '$app/state';

  import favicon from '#lib/assets/favicon.svg';

  import type { LayoutProps } from './$types';
  import DemoLinks from './demo/DemoLinks.svelte';
  import SessionHeader from './SessionHeader.svelte';

  let { children, data }: LayoutProps = $props();
  const path = $derived(page.route.id ?? page.url.pathname);
  const onAdminPage = $derived(path === '/admin' || path.startsWith('/admin/'));
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<SessionHeader
  signedIn={data.signedIn}
  {onAdminPage}
  returnTo={data.returnTo}
/>
{@render children()}
{#if path.startsWith('/demo/')}
  <DemoLinks />
{/if}

<script lang="ts">
  import { resolve } from '$app/paths';

  let { signedIn, returnTo }: { signedIn: boolean; returnTo: string } =
    $props();
</script>

<header>
  {#if signedIn}
    <form method="GET" action="/cdn-cgi/access/logout" data-sveltekit-reload>
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit">로그아웃</button>
    </form>
  {:else}
    <a
      href={resolve('/admin')}
      data-sveltekit-reload
      data-sveltekit-preload-data="off">로그인</a
    >
  {/if}
</header>

<style>
  header {
    display: flex;
    justify-content: flex-end;
    padding-block: 0.5rem;
  }

  button,
  a {
    min-block-size: 2.75rem;
  }

  a {
    display: inline-flex;
    align-items: center;
    padding-inline: 0.5rem;
  }
</style>

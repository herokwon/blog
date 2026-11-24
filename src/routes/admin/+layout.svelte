<script lang="ts">
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();
</script>

<header lang="ko">
  <form method="GET" action="/cdn-cgi/access/logout" data-sveltekit-reload>
    <button type="submit">로그아웃</button>
  </form>
</header>
{@render children()}

<style>
  header {
    display: flex;
    justify-content: flex-end;
    padding-block: 0.5rem;
  }

  button {
    min-block-size: 2.75rem;
  }
</style>

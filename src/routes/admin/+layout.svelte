<script lang="ts">
  import { resolve } from '$app/paths';

  let { children } = $props();
</script>

<main class="admin-shell" lang="ko">
  <nav class="admin-session">
    <a href={resolve('/admin/logout')}>로그아웃</a>
  </nav>
  {@render children()}
</main>

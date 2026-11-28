<script lang="ts">
  import { resolve } from '$app/paths';

  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();
</script>

<div class="public-layout">
  <nav aria-label="블로그">
    <a href={resolve('/(public)')}>블로그 홈</a>
  </nav>
  {@render children()}
</div>

<style>
  .public-layout {
    box-sizing: border-box;
    max-inline-size: 76ch;
    margin-inline: auto;
    padding: 1rem clamp(0.75rem, 4vw, 2rem) 3rem;
    overflow-wrap: anywhere;
  }
</style>

<script lang="ts">
  import { resolve } from '$app/paths';

  let { children, data } = $props();
</script>

<main class="admin-shell" lang="ko">
  <nav class="admin-session">
    {#if data.adminContext.environment !== 'production'}
      <span class="admin-environment"
        >{data.adminContext.environment === 'local' ? 'Local' : 'Preview'}</span
      >
    {/if}
    <a href={resolve('/admin/logout')}>로그아웃</a>
  </nav>
  {#if !data.adminContext.writable}
    <aside class="admin-read-only" aria-label="환경 안내">
      <p>읽기 전용 환경입니다.</p>
      {#if data.adminContext.previewAdminUrl}<a
          href={data.adminContext.previewAdminUrl}>Preview에서 작성하기</a
        >{/if}
    </aside>
  {/if}
  {@render children()}
</main>

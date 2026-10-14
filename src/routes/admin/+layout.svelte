<script lang="ts">
  import { provideProcessing } from '#lib/admin/processing.svelte.ts';
  import { beforeNavigate } from '$app/navigation';
  import { resolve } from '$app/paths';

  let { children, data } = $props();
  const processing = provideProcessing();
  beforeNavigate(navigation => {
    if (processing.exclusive) navigation.cancel();
  });
</script>

<main class="admin-shell" lang="ko">
  <div class="admin-workspace" inert={processing.exclusive}>
    <nav class="admin-session">
      {#if data.adminContext.environment !== 'production'}
        <span class="admin-environment"
          >{data.adminContext.environment === 'local'
            ? 'Local'
            : 'Preview'}</span
        >
      {/if}
      <a
        href={resolve('/admin/logout')}
        aria-disabled={processing.busy}
        tabindex={processing.busy ? -1 : undefined}
        onclick={event => {
          if (processing.busy) event.preventDefault();
        }}>로그아웃</a
      >
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
  </div>
  {#if processing.exclusive}<p class="admin-processing" role="status">
      로그아웃 중입니다.
    </p>{/if}
</main>

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
  <div class="admin-workspace contents" inert={processing.exclusive}>
    <nav class="admin-session items-center gap-3">
      {#if data.adminContext.environment !== 'production' || !data.adminContext.writable}
        <div class="flex items-center gap-1">
          <span
            class="admin-environment rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600"
            >{data.adminContext.environment === 'local'
              ? 'Local'
              : data.adminContext.environment === 'preview'
                ? 'Preview'
                : 'Production'}</span
          >
          {#if !data.adminContext.writable}<span
              class="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800"
              >Read Only</span
            >{/if}
        </div>
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
      <aside
        class="admin-read-only mb-4 flex items-start gap-3 rounded-md bg-gray-100 px-4 py-3 text-sm"
        aria-label="환경 안내"
      >
        <svg
          class="mt-[calc((1lh-1em)/2)] h-[1em] w-[1em] shrink-0 text-blue-800"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
          ><circle cx="12" cy="12" r="11" /><path
            d="M12 10v7 M12 6.5h.01"
            fill="none"
            stroke="white"
            stroke-width="2.5"
            stroke-linecap="round"
          /></svg
        >
        <div class="min-w-0">
          <p class="font-semibold text-gray-800">
            읽기 전용으로 접속 중입니다.
          </p>
          {#if data.adminContext.previewAdminUrl}<a
              class="mt-1 inline-block text-blue-800 hover:underline focus-visible:underline"
              href={data.adminContext.previewAdminUrl}
              >작성 가능한 Preview로 이동</a
            >{/if}
        </div>
      </aside>
    {/if}
    {@render children()}
  </div>
  {#if processing.exclusive}<p class="admin-processing" role="status">
      로그아웃 중입니다.
    </p>{/if}
</main>

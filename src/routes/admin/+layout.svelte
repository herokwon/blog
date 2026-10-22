<script lang="ts">
  import { provideNotices } from '#lib/admin/notices.svelte.ts';
  import { provideProcessing } from '#lib/admin/processing.svelte.ts';
  import ProcessingIndicator from '#lib/admin/ProcessingIndicator.svelte';
  import ResultNotice from '#lib/admin/ResultNotice.svelte';
  import { beforeNavigate } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { navigating } from '$app/state';

  let { children, data } = $props();
  const processing = provideProcessing();
  const notices = provideNotices();
  const routePending = $derived(
    Boolean(navigating.to?.url.pathname.startsWith('/admin/')) &&
      navigating.type !== 'leave' &&
      !processing.busy,
  );
  beforeNavigate(navigation => {
    if (
      processing.exclusive &&
      !(navigation.type === 'leave' && processing.leaving)
    )
      navigation.cancel();
    // Successful mutations show their notice after their permitted navigation.
    // Other navigation consumes the previous result rather than replaying it.
    else notices.dismiss();
  });
</script>

<div
  class="admin-page flex min-h-screen flex-col text-admin-ink has-[.post-form]:h-dvh has-[.post-form]:min-h-128 supports-[height:100dvh]:min-h-dvh"
  class:admin-busy={processing.exclusive}
  class:admin-session-busy={processing.busy || routePending}
>
  <header class="shrink-0" inert={processing.busy || routePending}>
    <nav
      class="admin-session mx-auto flex w-full max-w-5xl items-center justify-end gap-3 px-4 py-4 md:px-5"
      aria-label="세션"
    >
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
        class="admin-button"
        href={resolve('/admin/logout')}
        aria-disabled={processing.busy || routePending}
        tabindex={processing.busy || routePending ? -1 : undefined}
        onclick={event => {
          if (processing.busy || routePending) event.preventDefault();
        }}>로그아웃</a
      >
    </nav>
  </header>
  <main
    class="admin-shell relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 cursor-auto flex-col px-4 py-8 md:px-5 md:py-12"
    class:admin-busy={routePending}
    data-sveltekit-preload-data="off"
  >
    <div
      class="admin-workspace contents"
      inert={processing.exclusive || routePending}
      aria-busy={routePending}
    >
      {#if !data.adminContext.writable}
        <aside
          inert={processing.busy}
          class="admin-read-only mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-gray-100 px-4 py-3 text-sm"
          aria-label="환경 안내"
        >
          <div class="flex min-w-0 flex-1 basis-80 items-start gap-3">
            <svg
              class="mt-[calc((1lh_-_1.25em)_/_2)] size-[1.25em] shrink-0 text-amber-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
              ><rect x="5" y="10" width="14" height="11" rx="2" /><path
                d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"
              /></svg
            >
            <p class="min-w-0 font-semibold text-gray-800">
              읽기 전용으로 접속 중입니다.
            </p>
          </div>
          {#if data.adminContext.previewAdminUrl}<a
              class="admin-button ml-[calc(1.25em_+_0.75rem)] shrink-0"
              href={data.adminContext.previewAdminUrl}>작성 화면으로 이동</a
            >{/if}
        </aside>
      {/if}
      {#if notices.current}
        {#key notices.current.id}
          {@const notice = notices.current}
          <div class="mb-4 shrink-0">
            <ResultNotice
              tone={notice.tone}
              message={notice.message}
              details={notice.details}
              ondismiss={() => notices.dismiss(notice.id)}
            />
          </div>
        {/key}
      {/if}
      {@render children()}
    </div>
    <ProcessingIndicator
      active={routePending}
      scope="region"
      message="화면 불러오는 중…"
    />
  </main>
  <ProcessingIndicator
    active={processing.exclusive}
    scope="global"
    message="로그아웃 중입니다."
  />
</div>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { completeLogout } from '#lib/admin/logout.ts';
  import { useProcessing } from '#lib/admin/processing.svelte.ts';
  import { clearRecovery } from '#lib/admin/recovery.ts';
  import ResultNotice from '#lib/admin/ResultNotice.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let busy = $state(false);
  const processing = useProcessing();
  const owner = Symbol();
  let retryButton = $state<HTMLButtonElement>();

  let failed = $state(false);
  async function logout() {
    if (busy) return;
    busy = true;
    processing.update(owner, true, true);
    failed = false;
    let completed = false;
    try {
      clearRecovery(localStorage);
      await completeLogout(data.adminContext.environment === 'local');
      processing.allowLeave(owner);
      window.location.replace('/');
      completed = true;
    } catch {
      failed = true;
    } finally {
      if (!completed) {
        busy = false;
        processing.update(owner, false);
        await tick();
        retryButton?.focus();
      }
    }
  }
  onMount(() => {
    void logout();
    return () => processing.update(owner, false);
  });
</script>

{#if failed}<ResultNotice
    tone="uncertain"
    message="로그아웃 완료를 확인하지 못했습니다."
    details="브라우저 입력 복구 삭제에 실패했다면 사이트 데이터를 확인하세요."
  />{/if}
{#if data.adminContext.environment === 'local'}
  <p>
    Local 환경에는 Cloudflare Access 세션이 없습니다. 입력 복구를 정리하고
    홈으로 이동합니다.
  </p>
{/if}
{#if failed}<button
    bind:this={retryButton}
    type="button"
    onclick={logout}
    disabled={busy}>다시 시도</button
  >{/if}

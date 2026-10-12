<script lang="ts">
  import { onMount } from 'svelte';
  import { completeLogout } from '#lib/admin/logout.ts';
  import { clearRecovery } from '#lib/admin/recovery.ts';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let busy = $state(false);

  let failed = $state(false);
  async function logout() {
    if (busy) return;
    busy = true;
    failed = false;
    try {
      clearRecovery(localStorage);
      await completeLogout(data.adminContext.environment === 'local');
      window.location.replace('/');
    } catch {
      failed = true;
    } finally {
      busy = false;
    }
  }
  onMount(() => {
    void logout();
  });
</script>

<p role="status">
  {failed
    ? '로그아웃 완료를 확인하지 못했습니다. 다시 시도하세요. 브라우저 입력 복구 삭제에 실패했다면 사이트 데이터를 확인하세요.'
    : '로그아웃 중입니다.'}
</p>
{#if data.adminContext.environment === 'local'}
  <p>
    Local 환경에는 Cloudflare Access 세션이 없습니다. 입력 복구를 정리하고
    홈으로 이동합니다.
  </p>
{/if}
{#if failed}<button type="button" onclick={logout} disabled={busy}
    >다시 시도</button
  >{/if}

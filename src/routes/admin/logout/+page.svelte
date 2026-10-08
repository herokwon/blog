<script lang="ts">
  import { onMount } from 'svelte';
  import { clearRecovery } from '#lib/admin/recovery.ts';

  let failed = $state(false);
  onMount(() => {
    try {
      clearRecovery(localStorage);
    } catch {
      failed = true;
      return;
    }
    window.location.replace('/cdn-cgi/access/logout');
  });
</script>

<p role="status">
  {failed
    ? '브라우저 입력 복구를 지우지 못했습니다. 브라우저의 사이트 데이터를 삭제한 뒤 로그아웃하세요.'
    : '로그아웃 중입니다.'}
</p>

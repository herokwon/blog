<script lang="ts">
  let {
    active,
    message,
    scope = 'local',
  }: {
    active: boolean;
    message: string;
    scope?: 'global' | 'region' | 'local';
  } = $props();
  let visible = $state(false);
  const pending = $derived(Boolean(active));
  $effect(() => {
    visible = false;
    if (!pending) return;
    const timer = setTimeout(() => (visible = true), 200);
    return () => clearTimeout(timer);
  });
</script>

{#snippet spinner()}
  <svg
    class="shrink-0 animate-spin motion-reduce:animate-none {scope === 'local'
      ? 'size-5'
      : 'size-12'}"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    aria-hidden="true"
    focusable="false"
    ><circle cx="12" cy="12" r="9" opacity="0.25" /><path
      d="M12 3a9 9 0 0 1 9 9"
      stroke-linecap="round"
    /></svg
  >
{/snippet}

{#if active && visible}
  <div
    class:admin-busy={active}
    data-processing={scope}
    class={scope === 'global'
      ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/65 text-white'
      : scope === 'region'
        ? 'absolute inset-0 z-20 flex items-start justify-center rounded-md bg-white/80 text-admin-ink'
        : 'admin-processing flex items-center gap-3'}
  >
    <div
      class={scope === 'local'
        ? 'contents'
        : scope === 'region'
          ? 'sticky top-[calc(50dvh_-_4rem)] flex flex-col items-center gap-4 p-4 text-center'
          : 'flex flex-col items-center gap-4 p-4 text-center'}
    >
      {@render spinner()}
      <p role="status">{message}</p>
    </div>
  </div>
{/if}

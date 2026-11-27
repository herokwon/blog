<script lang="ts">
  import {
    categoryNameLength,
    categoryNameLimit,
  } from '../../../lib/admin-input';

  let {
    id,
    value = '',
    errorId,
  }: { id: string; value?: string; errorId?: string } = $props();
  let edited = $state<string>();
  const name = $derived(edited ?? value);
</script>

<label for={id}>이름</label>
<input
  {id}
  name="name"
  value={name}
  oninput={event => (edited = event.currentTarget.value)}
  required
  aria-invalid={!!errorId || undefined}
  aria-describedby={errorId ? `${id}-limit ${errorId}` : `${id}-limit`}
/>
<small id={`${id}-limit`}
  >{categoryNameLength(name)}/{categoryNameLimit}자</small
>

<script lang="ts">
  import {
    categoryNameLength,
    categoryNameLimit,
  } from '../../../lib/admin-input';

  let {
    id,
    value = '',
    invalid = false,
  }: { id: string; value?: string; invalid?: boolean } = $props();
  let edited = $state<string>();
  const name = $derived(edited ?? value);
</script>

<label for={id}>카테고리 이름 (필수)</label>
<input
  {id}
  name="name"
  value={name}
  oninput={event => (edited = event.currentTarget.value)}
  required
  aria-invalid={invalid || undefined}
  aria-describedby={invalid ? `${id}-limit category-error` : `${id}-limit`}
/>
<small id={`${id}-limit`}
  >{categoryNameLength(name)}/{categoryNameLimit}자</small
>

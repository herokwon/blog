<script lang="ts">
  import { onMount } from 'svelte';

  import {
    normalizeTag,
    postTagLimit,
    splitTags,
    tagErrorMessages,
    validateTags,
  } from '../../../lib/admin-input';

  let {
    value,
    existingTags = [],
    invalid = false,
  }: {
    value: string;
    existingTags?: string[];
    invalid?: boolean;
  } = $props();
  let root: HTMLDivElement;
  let input = $state<HTMLInputElement>();
  let enhanced = $state(false);
  let tags = $state<string[]>([]);
  let message = $state('');
  let composing = false;

  function commit() {
    if (!input) return false;
    const tag = normalizeTag(input.value);
    if (!tag) return true;

    const next = [...tags, tag];
    const error = validateTags(next, existingTags);
    if (error) {
      message = tagErrorMessages[error];
      input.focus();
      return false;
    }

    tags = next;
    input.value = '';
    message = '';
    input.focus();
    return true;
  }

  function handleKey(event: KeyboardEvent) {
    if (event.isComposing || composing) return;
    if (event.keyCode === 229) {
      if (event.key === 'Enter') event.preventDefault();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) commit();
    } else if (
      event.key === 'Backspace' &&
      !input?.value &&
      tags.length &&
      !event.repeat
    ) {
      event.preventDefault();
      root.querySelector<HTMLButtonElement>('li:last-child button')?.focus();
    }
  }

  function remove(index: number) {
    tags = tags.filter((_, position) => position !== index);
    message = '';
    input?.focus();
  }

  function handleChipKey(event: KeyboardEvent, index: number) {
    if (event.key !== 'Backspace' || event.repeat) return;
    event.preventDefault();
    remove(index);
  }

  onMount(() => {
    tags = splitTags(input?.value ?? value);
    const form = root.closest('form');
    if (!form) return;

    function validatePending(event: SubmitEvent) {
      if (composing || !commit()) event.preventDefault();
    }

    function serialize(event: FormDataEvent) {
      event.formData.set('tags', tags.join(','));
    }

    form.addEventListener('submit', validatePending);
    form.addEventListener('formdata', serialize);
    enhanced = true;
    return () => {
      form.removeEventListener('submit', validatePending);
      form.removeEventListener('formdata', serialize);
    };
  });
</script>

<div bind:this={root}>
  <label for="tags">태그</label>
  {#if enhanced}
    <div class="entry">
      {#if tags.length}
        <ul aria-label="확정한 태그">
          {#each tags as tag, index (`${index}:${tag}`)}
            <li>
              <button
                type="button"
                aria-label={`태그 ${tag} 제거`}
                onclick={() => remove(index)}
                onkeydown={event => handleChipKey(event, index)}
              >
                {tag} ×
              </button>
            </li>
          {/each}
        </ul>
      {/if}
      <input
        id="tags"
        bind:this={input}
        placeholder={tags.length
          ? undefined
          : `태그를 입력해 주세요. (최대 ${postTagLimit}개)`}
        onkeydown={handleKey}
        oninput={() => (message = '')}
        oncompositionstart={() => (composing = true)}
        oncompositionend={() => (composing = false)}
        aria-invalid={!!message || invalid || undefined}
        aria-describedby={message
          ? 'tag-help tag-error'
          : invalid
            ? 'tag-help post-errors'
            : 'tag-help'}
      />
      <button type="button" onclick={commit}>태그 추가</button>
    </div>
    <small id="tag-help"
      >{tags.length}/{postTagLimit}개 · Space 또는 Enter로 추가</small
    >
    {#if message}
      <p role="alert" id="tag-error">{message}</p>
    {/if}
  {:else}
    <input
      id="tags"
      name="tags"
      bind:this={input}
      {value}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? 'tag-help post-errors' : 'tag-help'}
    />
    <small id="tag-help">쉼표로 구분해 입력하세요. 최대 {postTagLimit}개</small>
  {/if}
</div>

<style>
  .entry,
  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  input {
    max-inline-size: 100%;
    font: inherit;
  }

  li button {
    overflow-wrap: anywhere;
  }
</style>

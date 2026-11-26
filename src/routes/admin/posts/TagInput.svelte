<script lang="ts">
  import { flushSync, onMount } from 'svelte';

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
  let prompt = $state<HTMLButtonElement>();
  let enhanced = $state(false);
  let editing = $state(false);
  let tags = $state<string[]>([]);
  let message = $state('');
  let composing = false;

  function commit() {
    if (!input) return true;
    const tag = normalizeTag(input.value);
    if (!tag) return true;

    const next = [...tags, tag];
    const error = validateTags(next, existingTags);
    if (error) {
      message = tagErrorMessages[error];
      return false;
    }

    tags = next;
    input.value = '';
    message = '';
    return true;
  }

  function openInput() {
    flushSync(() => (editing = true));
    input?.focus();
  }

  function finishEditing(event: FocusEvent) {
    if (!editing || composing) return;
    if (
      event.relatedTarget instanceof Node &&
      root.contains(event.relatedTarget)
    )
      return;
    if (commit()) editing = false;
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
    (input ?? prompt)?.focus();
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
      if (composing || !commit()) {
        event.preventDefault();
        input?.focus();
      }
    }

    function serialize(event: FormDataEvent) {
      event.formData.set('tags', tags.join(','));
    }

    form.addEventListener('submit', validatePending);
    form.addEventListener('formdata', serialize);
    editing = invalid;
    enhanced = true;
    return () => {
      form.removeEventListener('submit', validatePending);
      form.removeEventListener('formdata', serialize);
    };
  });
</script>

<div bind:this={root}>
  {#if enhanced && !editing}
    <span>태그</span>
  {:else}
    <label for="tags">태그</label>
  {/if}
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
                onblur={finishEditing}
                onkeydown={event => handleChipKey(event, index)}
              >
                {tag} ×
              </button>
            </li>
          {/each}
        </ul>
      {/if}
      {#if editing}
        <div class="tag-field">
          <span aria-hidden="true">#</span>
          <input
            id="tags"
            bind:this={input}
            onblur={finishEditing}
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
            enterkeyhint="done"
          />
        </div>
      {:else}
        <button
          type="button"
          class="tag-prompt"
          bind:this={prompt}
          onclick={openInput}
          aria-describedby="tag-help"
        >
          태그를 입력해 주세요. (최대 {postTagLimit}개)
        </button>
      {/if}
    </div>
    <small id="tag-help">{tags.length}/{postTagLimit}개</small>
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

  .entry {
    align-items: center;
    border-block-start: 1px solid #ddd;
    padding-block: 0.4rem;
  }

  .tag-prompt {
    flex: 1 1 auto;
    padding: 0.4rem;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  .tag-field {
    display: inline-flex;
    align-items: center;
    max-inline-size: 100%;
    box-sizing: border-box;
    border-radius: 0.25rem;
    padding: 0.3rem 0.45rem;
    background: ButtonFace;
    color: ButtonText;
  }

  .tag-field:focus-within {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .tag-field input {
    field-sizing: content;
    min-inline-size: 1ch;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    outline: none;
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

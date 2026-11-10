<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { EditingTag } from './tag-input.js';

  let {
    value = $bindable(),
    pendingTag = $bindable(''),
    editingTag = $bindable<EditingTag | null>(null),
    disabled = false,
  }: {
    value: string[];
    pendingTag?: string;
    editingTag?: EditingTag | null;
    disabled?: boolean;
  } = $props();

  const id = $props.id();
  let hydrated = $state(false);
  let newVisible = $state(false);
  let editVisible = $state(false);
  let composing = false;
  let compositionFinished = false;
  let error = $state('');
  let area = $state<HTMLDivElement>();
  let newInput = $state<HTMLInputElement>();
  let editInput = $state<HTMLInputElement>();
  onMount(() => {
    hydrated = true;
  });

  const split = (text: string) => text.trim().split(/\s+/u).filter(Boolean);
  function validate(names: string[], index?: number) {
    const others = value.filter((_, i) => i !== index);
    if (others.length + names.length > 20) return 'Use at most 20 tags.';
    if (names.some(name => [...name].length > 40 || name.includes('\0')))
      return 'Use tag names of 1–40 characters.';
    if (new Set([...others, ...names]).size !== others.length + names.length)
      return 'This post already has a tag with that name.';
    return '';
  }
  function finishEdit() {
    if (!editingTag) return true;
    const { index, value: text } = editingTag;
    if (text.trim() && text !== value[index]) {
      const names = split(text);
      error = validate(names, index);
      if (error) return false;
      value = [...value.slice(0, index), ...names, ...value.slice(index + 1)];
    }
    editingTag = null;
    editVisible = false;
    error = '';
    return true;
  }
  function finishNew() {
    const names = split(pendingTag);
    error = validate(names);
    if (error) return false;
    value = [...value, ...names];
    pendingTag = '';
    error = '';
    return true;
  }
  async function focusBuffer() {
    if (editingTag) editVisible = true;
    else newVisible = true;
    await tick();
    (editingTag ? editInput : newInput)?.focus();
  }
  export function commit() {
    const valid = finishEdit() && finishNew();
    if (!valid) void focusBuffer();
    return valid;
  }
  async function openNew() {
    if (disabled || !hydrated) return;
    if (!finishEdit()) {
      await focusBuffer();
      return;
    }
    newVisible = true;
    await tick();
    newInput?.focus();
  }
  async function edit(index: number) {
    if (!finishEdit() || !finishNew()) {
      await focusBuffer();
      return;
    }
    newVisible = false;
    editingTag = { index, value: value[index] };
    editVisible = true;
    await tick();
    editInput?.focus();
    editInput?.setSelectionRange(
      editInput.value.length,
      editInput.value.length,
    );
  }
  async function focusChip(index: number) {
    await tick();
    const chip = area?.querySelectorAll<HTMLButtonElement>('[data-tag]')[index];
    (chip ?? area)?.focus();
  }
  async function remove(index: number) {
    value = value.filter((_, i) => i !== index);
    editingTag = null;
    editVisible = false;
    newVisible = false;
    error = '';
    await focusChip(index - 1);
  }
  function inputKey(event: KeyboardEvent, index?: number) {
    if (
      disabled ||
      composing ||
      event.isComposing ||
      event.keyCode === 229 ||
      event.repeat
    )
      return;
    if (compositionFinished && event.key === 'Enter') {
      event.preventDefault();
      return;
    }
    const input = event.currentTarget as HTMLInputElement;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (commit()) void openNew();
    } else if (event.key === 'Backspace' && !input.value) {
      event.preventDefault();
      if (index !== undefined) void remove(index);
      else if (value.length) {
        newVisible = false;
        void focusChip(value.length - 1);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (index !== undefined) {
        editingTag = null;
        editVisible = false;
        void focusChip(index);
      } else {
        pendingTag = '';
        newVisible = false;
        area?.focus();
      }
      error = '';
    }
  }
  function chipKey(event: KeyboardEvent, index: number) {
    if (disabled || event.isComposing || event.repeat) return;
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      void remove(index);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const next = index + (event.key === 'ArrowLeft' ? -1 : 1);
      if (next >= value.length) void openNew();
      else void focusChip(next);
    }
  }
  function blurEdit() {
    const active = editingTag;
    // Wait for a clicked chip's handler before closing the old editor.
    setTimeout(() => {
      if (editingTag === active) {
        finishEdit();
        editVisible = false;
      }
    }, 0);
  }
  function compositionEnd() {
    composing = false;
    compositionFinished = true;
    setTimeout(() => {
      compositionFinished = false;
    }, 0);
  }
  function paste(event: ClipboardEvent, index?: number) {
    const text = event.clipboardData?.getData('text') ?? '';
    if (!/\s/u.test(text)) return;
    event.preventDefault();
    const input = event.currentTarget as HTMLInputElement;
    const combined =
      input.value.slice(0, input.selectionStart ?? 0) +
      text +
      input.value.slice(input.selectionEnd ?? input.value.length);
    if (index === undefined) pendingTag = combined;
    else editingTag = { index, value: combined };
    if (commit()) void openNew();
  }
</script>

<fieldset {disabled} aria-label="Tags">
  <legend>Tags</legend>
  <div
    bind:this={area}
    class="tag-area"
    role="toolbar"
    aria-label="Tag entry area"
    aria-describedby={`${id}-help`}
    tabindex={disabled ? -1 : 0}
    onclick={event => {
      if (event.target === event.currentTarget) void openNew();
    }}
    onkeydown={event => {
      if (
        event.target === event.currentTarget &&
        (event.key === 'Enter' || event.key === ' ')
      ) {
        event.preventDefault();
        void openNew();
      }
    }}
  >
    {#each value as tag, index (tag)}
      <input type="hidden" name="tags" value={tag} />
      {#if editingTag?.index === index && editVisible}
        <span class="tag-edit"
          >#<input
            bind:this={editInput}
            aria-label={`Edit tag ${tag}`}
            bind:value={editingTag.value}
            size={Math.min(40, Math.max(3, editingTag.value.length + 1))}
            onkeydown={event => inputKey(event, index)}
            onblur={blurEdit}
            oncompositionstart={() => {
              composing = true;
            }}
            oncompositionend={compositionEnd}
            onpaste={event => paste(event, index)}
          /></span
        >
      {:else}
        <button
          data-tag
          type="button"
          aria-label={`Edit tag ${tag}`}
          disabled={disabled || !hydrated}
          onclick={() => edit(index)}
          onkeydown={event => chipKey(event, index)}>#{tag}</button
        >
      {/if}
    {/each}
    {#if newVisible}
      <span class="tag-edit"
        >#<input
          bind:this={newInput}
          aria-label="Add tag"
          bind:value={pendingTag}
          size={Math.min(40, Math.max(3, pendingTag.length + 1))}
          onkeydown={event => inputKey(event)}
          onblur={() => {
            finishNew();
            newVisible = false;
          }}
          oncompositionstart={() => {
            composing = true;
          }}
          oncompositionend={compositionEnd}
          onpaste={event => paste(event)}
        /></span
      >
    {:else if !value.length && !editVisible}
      <button
        class="placeholder"
        type="button"
        disabled={disabled || !hydrated}
        onclick={openNew}>Enter tags (up to 20).</button
      >
    {/if}
  </div>
  <p id={`${id}-help`}>
    Space or Enter adds a tag. Click a tag to edit. Backspace removes a focused
    tag or an empty tag editor. Up to 20 tags, 40 characters each.
  </p>
  {#if error}<p role="alert">
      {error} Click the tag area to correct your input.
    </p>{/if}
  <noscript
    >JavaScript is required to edit tags. Existing tags are retained when
    saving.</noscript
  >
</fieldset>

<style>
  fieldset {
    min-width: 0;
    margin-block: 1rem;
    border: 1px solid #ccc;
    padding: 1rem;
  }
  .tag-area {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.5rem;
    padding: 0.5rem;
    border: 1px solid #ccc;
  }
  .tag-edit {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    max-width: 100%;
  }
  button,
  input {
    font: inherit;
    padding: 0.4rem;
    min-width: 0;
    max-width: 100%;
  }
  button {
    overflow-wrap: anywhere;
  }
  .placeholder {
    border: 0;
    background: none;
    padding: 0;
    color: inherit;
  }
  p {
    overflow-wrap: anywhere;
  }
</style>

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Editor as MilkdownEditor } from '@milkdown/core';
import { render } from 'vitest-browser-svelte';

import Editor from './Editor.svelte';

interface MilkdownEditorOptions {
  root: HTMLElement;
  defaultValue: string;
  onChange?: (markdown: string) => void;
  readOnly?: boolean;
}

const { createMilkdownEditorMock, onMountControl } = vi.hoisted(() => {
  const state = {
    capturing: false,
    fn: null as (() => Promise<void>) | null,
  };
  return {
    createMilkdownEditorMock: vi.fn(
      async (options: MilkdownEditorOptions): Promise<MilkdownEditor> => {
        const { root, onChange } = options;
        const editable = document.createElement('div');
        editable.setAttribute('contenteditable', 'true');
        root.appendChild(editable);

        onChange?.('updated content from mock');
        return {} as MilkdownEditor;
      },
    ),
    onMountControl: state,
  };
});

vi.mock('./config', () => ({
  createMilkdownEditor: createMilkdownEditorMock,
}));

vi.mock('svelte', async importOriginal => {
  const actual = await importOriginal<typeof import('svelte')>();
  return {
    ...actual,
    onMount: (fn: () => void) => {
      if (onMountControl.capturing) {
        onMountControl.fn = fn as () => Promise<void>;
        return () => {};
      }
      return actual.onMount(fn);
    },
  };
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('[Components] Editor', () => {
  it('should create milkdown editor with initial content', async () => {
    render(Editor, { content: 'hello world' });

    await expect
      .poll(() => createMilkdownEditorMock.mock.calls)
      .toHaveLength(1);

    const options = createMilkdownEditorMock.mock.calls[0][0];
    expect(options.defaultValue).toBe('hello world');
    expect(options.readOnly).toBe(false);
    expect(options.root).toBeInstanceOf(HTMLElement);
    expect(typeof options.onChange).toBe('function');
  });

  it('should set aria-label on editable element when not readonly', async () => {
    render(Editor, { content: 'hello world' });

    await expect
      .poll(() => document.querySelector('[aria-label="content"]'))
      .not.toBeNull();
  });

  it('should not set aria-label when readonly', async () => {
    render(Editor, { content: 'hello world', readOnly: true });

    await expect
      .poll(() => createMilkdownEditorMock.mock.calls)
      .toHaveLength(1);

    expect(document.querySelector('[aria-label="content"]')).toBeNull();
  });

  it('should focus editable on container mousedown when target is outside editable', async () => {
    render(Editor, { content: 'hello' });

    await expect
      .poll(() => createMilkdownEditorMock.mock.calls)
      .toHaveLength(1);

    const editable = document.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    )!;
    const container = document.querySelector<HTMLElement>(
      '.milkdown-container',
    )!;

    const focusSpy = vi.spyOn(editable, 'focus').mockImplementation(() => {});
    const event = new MouseEvent('mousedown', { bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    container.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(focusSpy).toHaveBeenCalled();
  });

  it('should not focus editable when mousedown target is inside editable', async () => {
    render(Editor, { content: 'hello' });

    await expect
      .poll(() => createMilkdownEditorMock.mock.calls)
      .toHaveLength(1);

    const editable = document.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    )!;

    const focusSpy = vi.spyOn(editable, 'focus').mockImplementation(() => {});

    editable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('should not focus editable on mousedown when readOnly', async () => {
    render(Editor, { content: 'hello', readOnly: true });

    await expect
      .poll(() => createMilkdownEditorMock.mock.calls)
      .toHaveLength(1);

    const editable = document.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    )!;
    const container = document.querySelector<HTMLElement>(
      '.milkdown-container',
    )!;

    const focusSpy = vi.spyOn(editable, 'focus').mockImplementation(() => {});

    container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('should return early when event target is not a Node', async () => {
    render(Editor, { content: 'hello' });
    await expect
      .poll(() => createMilkdownEditorMock.mock.calls)
      .toHaveLength(1);

    const container = document.querySelector<HTMLElement>(
      '.milkdown-container',
    )!;
    const event = new MouseEvent('mousedown', { bubbles: true });

    Object.defineProperty(event, 'target', {
      get: () => null,
      configurable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    container.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('should update content via onChange callback', async () => {
    render(Editor, { content: 'initial' });

    await expect
      .poll(() => createMilkdownEditorMock.mock.calls)
      .toHaveLength(1);

    const options = createMilkdownEditorMock.mock.calls[0][0];
    expect(() => options.onChange?.('updated content')).not.toThrow();
  });

  it('should skip editor initialization when editorElement is null on mount', async () => {
    // Svelte 5 always sets editorElement via bind:this before onMount fires,
    // making if (editorElement) { ... } false branch structurally unreachable normally.
    // We intercept onMount via vi.mock('svelte') to capture the callback,
    // then unmount (which clears editorElement via bind:this cleanup),
    // and finally call the callback manually to exercise the false branch.
    onMountControl.capturing = true;
    const view = render(Editor, { content: 'hello' });
    onMountControl.capturing = false;

    // editorElement is set by bind:this, but onMount hasn't run yet
    await view.unmount();

    // After unmount: bind:this cleanup sets editorElement = undefined
    await onMountControl.fn?.();
    onMountControl.fn = null;

    expect(createMilkdownEditorMock).not.toHaveBeenCalled();
  });
});

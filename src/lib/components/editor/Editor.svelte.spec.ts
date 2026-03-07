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

const { createMilkdownEditorMock } = vi.hoisted(() => ({
  createMilkdownEditorMock: vi.fn(
    async ({ root }: MilkdownEditorOptions): Promise<MilkdownEditor> => {
      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      root.appendChild(editable);
      return {} as MilkdownEditor;
    },
  ),
}));

vi.mock('./config', () => ({
  createMilkdownEditor: createMilkdownEditorMock,
}));

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('[Components] Editor', () => {
  it('should create milkdown editor with initial content', async () => {
    render(Editor, { content: 'hello world' });

    await expect.poll(() => createMilkdownEditorMock.mock.calls.length).toBe(1);

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

    await expect.poll(() => createMilkdownEditorMock.mock.calls.length).toBe(1);

    expect(document.querySelector('[aria-label="content"]')).toBeNull();
  });
});

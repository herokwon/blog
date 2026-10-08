import { EditorView as CodeView } from '@codemirror/view';
import type { Crepe } from '@milkdown/crepe';
import { editorViewCtx } from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import Editor from './Editor.svelte';
import PostBody from './PostBody.svelte';
import '../../routes/layout.css';
import {
  documentStyleNonce,
  mountEditor,
  type EditorController,
} from './runtime';

let root: HTMLElement;
const captured = vi.hoisted(() => ({ editors: [] as Crepe[] }));
vi.mock('@milkdown/crepe', async importOriginal => {
  const actual = await importOriginal<typeof import('@milkdown/crepe')>();
  return {
    ...actual,
    Crepe: class extends actual.Crepe {
      constructor(options: ConstructorParameters<typeof actual.Crepe>[0]) {
        super(options);
        captured.editors.push(this);
      }
    },
  };
});
let nonceMeta: HTMLMetaElement;
beforeAll(() => {
  nonceMeta = document.createElement('meta');
  nonceMeta.name = 'admin-style-nonce';
  nonceMeta.content = 'initialDocumentNonce';
  document.head.appendChild(nonceMeta);
});
afterAll(() => nonceMeta.remove());
let controller: EditorController | undefined;
afterEach(async () => {
  await controller?.destroy();
  controller = undefined;
  root?.remove();
});
async function mount(body = 'original', readonly = false, change = vi.fn()) {
  root = document.createElement('div');
  document.body.appendChild(root);
  controller = await mountEditor({
    element: root,
    body,
    readonly,
    styleNonce: 'browserTestNonce',
    onDocumentChange: change,
  });
  if (body.includes('```'))
    await vi.waitFor(() =>
      expect(root.querySelector('.cm-content')).not.toBeNull(),
    );
  return controller;
}
function view(): EditorView {
  return captured.editors.at(-1)!.editor.action(ctx => ctx.get(editorViewCtx));
}
describe('real Crepe integration', () => {
  it('ignores a delayed selection transaction after newer typing without losing input', async () => {
    const editor = await mount('original');
    const stale = view().state.tr.setSelection(view().state.selection);
    view().dispatch(view().state.tr.insertText('newer ', 1));
    expect(() => view().dispatch(stale)).not.toThrow();
    expect(editor.getMarkdown()).toBe('newer original\n');
  });
  it.each([1024, 350])(
    'measures real changed-Markdown serialization for a long post at %spx content width',
    async width => {
      const source =
        'Representative paragraph with Unicode 한글 and long-post input. '.repeat(
          1500,
        );
      const editor = await mount(source);
      root.style.width = `${width}px`;
      view().dispatch(view().state.tr.insertText('Edited ', 1));
      const start = performance.now();
      const markdown = editor.getMarkdown();
      const markdownMs = performance.now() - start;
      const copy = { title: 'Benchmark', body: markdown, editedAt: Date.now() };
      const encoding = performance.now();
      const raw = JSON.stringify(copy);
      const jsonMs = performance.now() - encoding;
      const writing = performance.now();
      localStorage.setItem('task10-benchmark', raw);
      const storageMs = performance.now() - writing;
      localStorage.removeItem('task10-benchmark');
      console.info(
        'Task10 real serialization measurement',
        JSON.stringify({
          width,
          bytes: raw.length,
          markdownMs,
          jsonMs,
          storageMs,
        }),
      );
      expect(markdown).toContain('Edited Representative paragraph');
      expect(raw.length).toBeGreaterThan(90000);
    },
  );
  it('selects a code language and highlights it without changing code text', async () => {
    const code = 'const answer = 42;';
    const editor = await mount(`\`\`\`unknown-code\n${code}\n\`\`\``);
    await page
      .getByRole('button', { name: 'unknown-code', exact: true })
      .click();
    await page.getByPlaceholder('Search language').fill('TypeScript');
    await page.getByText('TypeScript', { exact: true }).click();
    await vi.waitFor(() =>
      expect(root.querySelector('.cm-line span[class]')).not.toBeNull(),
    );
    expect(editor.getMarkdown()).toMatch(/```typescript/i);
    expect(root.querySelector('.cm-content')?.textContent).toBe(code);
  });
  it('operates fixed formatting, heading menu and table insertion from accessible buttons', async () => {
    await mount('original');
    await expect
      .element(page.getByRole('button', { name: 'bold', exact: true }))
      .toBeInTheDocument();
    page.getByRole('button', { name: 'bold', exact: true }).element().focus();
    await userEvent.keyboard('{Enter}');
    view().dispatch(view().state.tr.insertText('bold ', 1));
    expect(root.querySelector('strong')?.textContent).toContain('bold');
    await page.getByRole('button', { name: 'Paragraph', exact: true }).click();
    await page.getByRole('button', { name: 'Heading 2', exact: true }).click();
    expect(root.querySelector('h2')).not.toBeNull();
    await page.getByRole('button', { name: 'table', exact: true }).click();
    expect(root.querySelector('table')).not.toBeNull();
    expect(root.querySelector('button[aria-label="image"]')).toBeNull();
  });
  it('accepts safe formatted paste and safe dropped text', async () => {
    const editor = await mount();
    const paste = new DataTransfer();
    paste.setData(
      'text/html',
      '<p><strong>safe</strong> <a href="/posts">link</a></p>',
    );
    view().dom.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: paste,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(editor.getMarkdown()).toContain('**safe**');
    expect(root.querySelector('a[href="/posts"]')).not.toBeNull();
    const drop = new DataTransfer();
    drop.setData('text/plain', '![image](/x)');
    const before = editor.getMarkdown();
    const event = new DragEvent('drop', {
      dataTransfer: drop,
      bubbles: true,
      cancelable: true,
    });
    view().dom.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(editor.getMarkdown()).toBe(before);
  });
  it('preserves a lazy code block created while locked and gives its style the document nonce', async () => {
    root = document.createElement('div');
    document.body.appendChild(root);
    const source = '```unknown\nexact code\n```';
    controller = await mountEditor({
      element: root,
      body: source,
      readonly: false,
      styleNonce: 'browserTestNonce',
      onDocumentChange: () => {},
    });
    controller.setReadonly(true);
    await vi.waitFor(() =>
      expect(root.querySelector('.cm-content')).not.toBeNull(),
    );
    expect(
      CodeView.findFromDOM(root.querySelector('.cm-editor')!)?.state.readOnly,
    ).toBe(true);
    expect(
      root.querySelector('.cm-content')?.getAttribute('contenteditable'),
    ).toBe('false');
    expect(
      document.head.querySelector('style[nonce="browserTestNonce"]'),
    ).not.toBeNull();
    expect(controller.getMarkdown()).toBe(source);
  });
  it('retains unedited source byte-for-byte and only signals document changes', async () => {
    const source =
      '* item\n\n***\n\n```made-up\n<script>literal</script>\n```\n';
    const change = vi.fn();
    const editor = await mount(source, false, change);
    expect(editor.getMarkdown()).toBe(source);
    expect(change).not.toHaveBeenCalled();
    view().dispatch(view().state.tr.setSelection(view().state.selection));
    expect(change).not.toHaveBeenCalled();
    view().dispatch(view().state.tr.insertText('edited ', 1));
    expect(change).toHaveBeenCalledOnce();
    expect(editor.getMarkdown()).toContain('edited');
    expect(root.querySelector('.cm-content')?.textContent).toContain(
      '<script>literal</script>',
    );
  });
  it('blocks unsupported transactions and disallowed stored links without losing source', async () => {
    const editor = await mount();
    const pm = view();
    for (const name of ['image', 'html', 'footnote_definition']) {
      const type = pm.state.schema.nodes[name];
      if (!type) continue;
      pm.dispatch(
        pm.state.tr.insert(
          1,
          type.create({ src: '/x', value: '<script>bad</script>' }),
        ),
      );
      expect(editor.getMarkdown()).toBe('original');
    }
    pm.dispatch(
      pm.state.tr.addMark(
        1,
        5,
        pm.state.schema.marks.link.create({ href: '//evil.test' }),
      ),
    );
    expect(editor.getMarkdown()).toBe('original');
    pm.dispatch(
      pm.state.tr.addStoredMark(
        pm.state.schema.marks.link.create({ href: 'javascript:alert(1)' }),
      ),
    );
    expect(pm.state.storedMarks ?? []).toHaveLength(0);
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('지원');
  });
  it.each([
    ['text/plain', 'paragraph ![image](/x)'],
    ['text/plain', 'text[^f]\n\n[^f]: note'],
    ['text/html', '<p>good<img src=x></p>'],
    ['text/html', '<p><a href="//evil.test">bad</a></p>'],
    ['text/html', '<p onclick="alert(1)">bad</p>'],
  ])('rejects unsafe paste %s', async (format, content) => {
    const editor = await mount();
    const transfer = new DataTransfer();
    transfer.setData(format, content);
    const event = new ClipboardEvent('paste', {
      clipboardData: transfer,
      bubbles: true,
      cancelable: true,
    });
    view().dom.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(editor.getMarkdown()).toBe('original');
  });
  it('blocks file drops before upload and preserves input', async () => {
    const editor = await mount();
    const transfer = new DataTransfer();
    transfer.items.add(new File(['image'], 'x.png', { type: 'image/png' }));
    const event = new DragEvent('drop', {
      dataTransfer: transfer,
      bubbles: true,
      cancelable: true,
    });
    view().dom.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(editor.getMarkdown()).toBe('original');
    expect(root.querySelector('img')).toBeNull();
  });
  it('locks outer and nested editors and unlocks without losing code', async () => {
    const source = '```typescript\nconst answer = 42;\n```';
    const editor = await mount(source);
    editor.setReadonly(true);
    expect(view().editable).toBe(false);
    const code = CodeView.findFromDOM(root.querySelector('.cm-editor')!);
    expect(code?.state.readOnly).toBe(true);
    expect(
      root.querySelector('.cm-content')?.getAttribute('contenteditable'),
    ).toBe('false');
    code?.dispatch({ changes: { from: 0, insert: 'blocked' } });
    expect(editor.getMarkdown()).toBe(source);
    editor.setReadonly(false);
    expect(
      CodeView.findFromDOM(root.querySelector('.cm-editor')!)?.state.readOnly,
    ).toBe(false);
    expect(
      root.querySelector('.cm-content')?.getAttribute('contenteditable'),
    ).toBe('true');
  });
  it('renders supported reading content without authoring controls and strips unsafe content', async () => {
    await mount(
      '# Heading\n\n**bold** ~~strike~~\n\n- [x] task\n\n| A | B |\n| --- | --- |\n| a | b |\n\n[bad](//evil.test) [good](/posts)\n\n<img src=x>\n\n![image](/x)',
      true,
    );
    expect(root.querySelector('h1')?.textContent).toBe('Heading');
    expect(root.querySelector('table')).not.toBeNull();
    expect(root.querySelector('strong')?.textContent).toBe('bold');
    expect(root.querySelector('del')).not.toBeNull();
    expect(root.querySelector('a[href="/posts"]')).not.toBeNull();
    expect(root.querySelector('a[href="//evil.test"]')).toBeNull();
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('.milkdown-top-bar')).toBeNull();
    expect(view().editable).toBe(false);
  });
  it('shows the original unsupported source in the authoring component', async () => {
    render(Editor, { source: 'paragraph ![image](/x)', locked: false });
    await expect.element(page.getByRole('alert')).toHaveTextContent(/images/);
    await expect
      .element(page.getByText('paragraph ![image](/x)', { exact: true }))
      .toBeInTheDocument();
    expect(document.querySelector('.ProseMirror')).toBeNull();
  });
  it('mounts a reading component with no editable surface', async () => {
    render(PostBody, { source: '# Read only' });
    await expect
      .element(page.getByRole('heading', { name: 'Read only' }))
      .toBeInTheDocument();
    expect(
      document.querySelector('.ProseMirror')?.getAttribute('contenteditable'),
    ).toBe('false');
  });
  it('keeps the initial document nonce for remounts', () => {
    expect(documentStyleNonce()).toBe('initialDocumentNonce');
    nonceMeta.content = 'navigationResponseNonce';
    expect(documentStyleNonce()).toBe('initialDocumentNonce');
  });
});

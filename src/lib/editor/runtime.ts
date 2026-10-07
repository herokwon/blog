import { Compartment, EditorState, Prec } from '@codemirror/state';
import { EditorView as CodeView } from '@codemirror/view';
import { Crepe } from '@milkdown/crepe';
import { editorViewCtx } from '@milkdown/kit/core';
import { trailing } from '@milkdown/kit/plugin/trailing';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Plugin } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';
import { inspectMarkdown, isAllowedLink, readingMarkdown } from './policy';

export type EditorController = {
  getMarkdown(): string;
  setReadonly(value: boolean): void;
  destroy(): Promise<void>;
};

export { documentStyleNonce } from './nonce';

const allowedNodes = new Set([
  'doc',
  'text',
  'paragraph',
  'heading',
  'hardbreak',
  'blockquote',
  'bullet_list',
  'ordered_list',
  'list_item',
  'hr',
  'code_block',
  'table',
  'table_row',
  'table_header_row',
  'table_header',
  'table_cell',
]);
function supportedDocument(doc: ProseNode): boolean {
  let supported = true;
  doc.descendants(node => {
    if (!allowedNodes.has(node.type.name)) supported = false;
    if (
      node.marks.some(
        mark => mark.type.name === 'link' && !isAllowedLink(mark.attrs.href),
      )
    )
      supported = false;
  });
  return supported;
}

function safeTransfer(transfer: DataTransfer, inCode: boolean): boolean {
  if (transfer.files.length) return false;
  const html = transfer.getData('text/html');
  if (html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const allowed = new Set([
      'P',
      'BR',
      'STRONG',
      'B',
      'EM',
      'I',
      'DEL',
      'S',
      'UL',
      'OL',
      'LI',
      'BLOCKQUOTE',
      'HR',
      'A',
      'PRE',
      'CODE',
      'TABLE',
      'THEAD',
      'TBODY',
      'TR',
      'TH',
      'TD',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'SPAN',
    ]);
    for (const element of doc.body.querySelectorAll('*')) {
      if (!allowed.has(element.tagName)) return false;
      for (const attribute of element.attributes) {
        if (
          attribute.name.startsWith('on') ||
          ['style', 'src', 'srcset'].includes(attribute.name)
        )
          return false;
      }
      if (
        element.hasAttribute('href') &&
        !isAllowedLink(element.getAttribute('href')!)
      )
        return false;
    }
    return true;
  }
  return inCode || inspectMarkdown(transfer.getData('text/plain')).supported;
}

export async function mountEditor(options: {
  element: HTMLElement;
  body: string;
  readonly: boolean;
  styleNonce: string;
  onDocumentChange: () => void;
}): Promise<EditorController> {
  if (!options.readonly && !inspectMarkdown(options.body).supported)
    throw new Error('Unsupported Markdown');
  let locked = options.readonly;
  let ready = false;
  let dirty = false;
  const notice = document.createElement('p');
  notice.setAttribute('role', 'alert');
  notice.hidden = true;
  const reject = () => {
    notice.textContent = '지원하지 않는 콘텐츠 또는 링크는 적용할 수 없습니다.';
    notice.hidden = false;
  };
  const codeEditable = new Compartment();
  const guardTransfer = (event: ClipboardEvent | DragEvent) => {
    const transfer =
      'clipboardData' in event ? event.clipboardData : event.dataTransfer;
    const inCode =
      (event.target as Element).closest('.cm-editor, .milkdown-code-block') !==
      null;
    if (locked || (transfer && !safeTransfer(transfer, inCode))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      reject();
    }
  };
  options.element.addEventListener('paste', guardTransfer, true);
  options.element.addEventListener('drop', guardTransfer, true);
  const toolbarKey = (event: KeyboardEvent) => {
    const button = (event.target as Element).closest<HTMLElement>(
      '.milkdown-top-bar button',
    );
    if (button && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (!locked)
        button.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, cancelable: true }),
        );
    }
  };
  options.element.addEventListener('keydown', toolbarKey, true);
  const crepe = new Crepe({
    root: options.element,
    defaultValue: options.readonly
      ? readingMarkdown(options.body)
      : options.body,
    features: {
      [Crepe.Feature.ImageBlock]: false,
      [Crepe.Feature.Latex]: false,
      [Crepe.Feature.AI]: false,
      [Crepe.Feature.TopBar]: !options.readonly,
      [Crepe.Feature.Toolbar]: !options.readonly,
      [Crepe.Feature.BlockEdit]: false,
      [Crepe.Feature.LinkTooltip]: !options.readonly,
      [Crepe.Feature.Placeholder]: !options.readonly,
      [Crepe.Feature.Cursor]: !options.readonly,
    },
    featureConfigs: {
      [Crepe.Feature.TopBar]: {
        buildTopBar(builder) {
          for (const group of builder.build()) {
            for (const item of group.items) {
              if (!item.selector)
                item.icon += `<span class="sr-only">${item.key}</span>`;
            }
          }
        },
      },
      [Crepe.Feature.CodeMirror]: {
        extensions: [
          CodeView.cspNonce.of(options.styleNonce),
          codeEditable.of(
            Prec.highest([
              EditorState.readOnly.compute([], () => locked),
              CodeView.editable.compute([], () => !locked),
            ]),
          ),
        ],
      },
    },
  });
  crepe.setReadonly(locked);
  // The trailing plugin inserts a paragraph on an otherwise selection-only
  // transaction. Do not turn that normalization into an author edit.
  crepe.editor.remove(trailing);
  crepe.editor.use(
    $prose(
      () =>
        new Plugin({
          filterTransaction(transaction) {
            if (ready && locked && transaction.docChanged) return false;
            if (
              !supportedDocument(transaction.doc) ||
              transaction.storedMarks?.some(
                mark =>
                  mark.type.name === 'link' && !isAllowedLink(mark.attrs.href),
              )
            ) {
              reject();
              return false;
            }
            return true;
          },
          props: {
            handlePaste(view, event) {
              if (
                locked ||
                (event.clipboardData &&
                  !safeTransfer(
                    event.clipboardData,
                    view.state.selection.$from.parent.type.name ===
                      'code_block',
                  ))
              ) {
                reject();
                return true;
              }
              return false;
            },
            handleDrop(view, event) {
              if (
                locked ||
                (event.dataTransfer &&
                  !safeTransfer(
                    event.dataTransfer,
                    view.state.selection.$from.parent.type.name ===
                      'code_block',
                  ))
              ) {
                reject();
                return true;
              }
              return false;
            },
            handleClick(_view, _position, event) {
              const link = (event.target as Element).closest('a');
              if (link && !isAllowedLink(link.getAttribute('href') ?? '')) {
                reject();
                return true;
              }
              return false;
            },
          },
          view: () => ({
            update(view, previous) {
              if (ready && !view.state.doc.eq(previous.doc)) {
                dirty = true;
                notice.hidden = true;
                options.onDocumentChange();
              }
            },
          }),
        }),
    ),
  );
  try {
    await crepe.create();
    options.element.appendChild(notice);
    ready = true;
  } catch (error) {
    options.element.removeEventListener('paste', guardTransfer, true);
    options.element.removeEventListener('drop', guardTransfer, true);
    options.element.removeEventListener('keydown', toolbarKey, true);
    await crepe.destroy();
    throw error;
  }
  return {
    getMarkdown: () => (dirty ? crepe.getMarkdown() : options.body),
    setReadonly(value) {
      locked = options.readonly || value;
      crepe.setReadonly(locked);
      // Refresh node views so CodeMirror's own readOnly compartment agrees.
      crepe.editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        view.dispatch(view.state.tr);
      });
      options.element
        .querySelectorAll<HTMLElement>('.cm-editor')
        .forEach(element => {
          CodeView.findFromDOM(element)?.dispatch({
            effects: codeEditable.reconfigure(
              Prec.highest([
                EditorState.readOnly.of(locked),
                CodeView.editable.of(!locked),
              ]),
            ),
          });
        });
    },
    async destroy() {
      ready = false;
      options.element.removeEventListener('paste', guardTransfer, true);
      options.element.removeEventListener('drop', guardTransfer, true);
      options.element.removeEventListener('keydown', toolbarKey, true);
      await crepe.destroy();
      notice.remove();
    },
  };
}

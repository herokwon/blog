import { CrepeBuilder } from '@milkdown/crepe/builder';
import { blockEdit } from '@milkdown/crepe/feature/block-edit';
import { cursor } from '@milkdown/crepe/feature/cursor';
import { linkTooltip } from '@milkdown/crepe/feature/link-tooltip';
import { listItem } from '@milkdown/crepe/feature/list-item';
import { placeholder } from '@milkdown/crepe/feature/placeholder';
import { table } from '@milkdown/crepe/feature/table';
import { toolbar } from '@milkdown/crepe/feature/toolbar';
import { editorViewOptionsCtx } from '@milkdown/kit/core';
import { uploadConfig } from '@milkdown/kit/plugin/upload';
import { Plugin } from '@milkdown/kit/prose/state';
import { $prose, replaceAll } from '@milkdown/kit/utils';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/classic.css';

export async function mountMarkdownEditor(
  root: HTMLElement,
  source: string,
  onChange: (markdown: string) => void,
) {
  const editor = new CrepeBuilder({ root, defaultValue: source })
    .addFeature(blockEdit)
    .addFeature(cursor)
    .addFeature(linkTooltip)
    .addFeature(listItem)
    .addFeature(placeholder)
    .addFeature(table)
    .addFeature(toolbar);
  let initializing = true;
  let synchronizing = false;
  let baselineSource = source;
  let baselineMarkdown = '';
  let currentSource = source;
  const read = () => {
    const markdown = editor.getMarkdown();
    return markdown === baselineMarkdown ? baselineSource : markdown;
  };
  // The built-in markdown listener is debounced. A synchronous document update
  // keeps immediate Save/navigation/unload from missing the last keystroke.
  editor.editor
    .config(ctx =>
      ctx.update(editorViewOptionsCtx, options => ({
        ...options,
        attributes: {
          role: 'textbox',
          'aria-label': 'Markdown editor',
          'aria-multiline': 'true',
        },
      })),
    )
    .use(
      $prose(
        () =>
          new Plugin({
            view: () => ({
              update: (view, previous) => {
                if (
                  !initializing &&
                  !synchronizing &&
                  !view.state.doc.eq(previous.doc)
                ) {
                  currentSource = read();
                  onChange(currentSource);
                }
              },
            }),
          }),
      ),
    );
  // Crepe core depends on the upload configuration slice even when image UI is off.
  editor.editor.config(ctx =>
    ctx.update(uploadConfig.key, config => ({
      ...config,
      uploader: () => Promise.resolve([]),
    })),
  );
  try {
    await editor.create();
  } catch (cause) {
    await editor.destroy();
    throw cause;
  }
  baselineMarkdown = editor.getMarkdown();
  initializing = false;
  return {
    read,
    setValue(value: string) {
      if (value === currentSource) return;
      synchronizing = true;
      try {
        editor.editor.action(replaceAll(value));
        baselineSource = value;
        baselineMarkdown = editor.getMarkdown();
        currentSource = value;
      } finally {
        synchronizing = false;
      }
    },
    setReadonly: editor.setReadonly,
    destroy: editor.destroy,
  };
}

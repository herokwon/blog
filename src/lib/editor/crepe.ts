import { CrepeBuilder } from '@milkdown/crepe/builder';
import { blockEdit } from '@milkdown/crepe/feature/block-edit';
import { cursor } from '@milkdown/crepe/feature/cursor';
import { imageBlock } from '@milkdown/crepe/feature/image-block';
import { linkTooltip } from '@milkdown/crepe/feature/link-tooltip';
import { listItem } from '@milkdown/crepe/feature/list-item';
import { placeholder } from '@milkdown/crepe/feature/placeholder';
import { table } from '@milkdown/crepe/feature/table';
import { toolbar } from '@milkdown/crepe/feature/toolbar';
import {
  editorViewOptionsCtx,
  InitReady,
  remarkPluginsCtx,
} from '@milkdown/kit/core';
import { uploadConfig } from '@milkdown/kit/plugin/upload';
import { Plugin } from '@milkdown/kit/prose/state';
import { $prose, insert, replaceAll } from '@milkdown/kit/utils';
import { explicitBreaks } from '../markdown-breaks.js';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/classic.css';

export async function mountMarkdownEditor(
  root: HTMLElement,
  source: string,
  onChange: (markdown: string) => void,
  onUploadState: (delta: number) => void,
  onUploadError: (message: string) => void,
) {
  const uploads = new Set<AbortController>();
  let destroyed = false;
  async function uploadImage(file: File) {
    const controller = new AbortController();
    uploads.add(controller);
    onUploadState(1);
    onUploadError('');
    try {
      if (
        !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(
          file.type,
        ) ||
        !file.size ||
        file.size > 10 * 1024 * 1024
      )
        throw new Error(
          'Choose a JPEG, PNG, GIF or WebP image of at most 10 MiB.',
        );
      const response = await fetch('/admin/media', {
        method: 'POST',
        headers: { 'content-type': file.type },
        body: file,
        signal: controller.signal,
      });
      const result = await response.json<{ url?: string; message?: string }>();
      if (!response.ok || !result.url)
        throw new Error(result.message ?? 'The image could not be uploaded.');
      return result.url;
    } catch (cause) {
      if (!destroyed)
        onUploadError(
          cause instanceof Error
            ? cause.message
            : 'The image could not be uploaded.',
        );
      throw cause;
    } finally {
      uploads.delete(controller);
      onUploadState(-1);
    }
  }
  const editor = new CrepeBuilder({ root, defaultValue: source })
    .addFeature(blockEdit)
    .addFeature(cursor)
    .addFeature(imageBlock, {
      onUpload: uploadImage,
      proxyDomURL: url =>
        /^\/media\/[0-9a-f-]{36}(?:[?#].*)?$/.test(url) ? `/admin${url}` : url,
    })
    .addFeature(linkTooltip)
    .addFeature(listItem)
    .addFeature(placeholder)
    .addFeature(table)
    .addFeature(toolbar);
  // The provider's rejection path leaves its paste/drop placeholder behind.
  // Settle failed uploads with no nodes after reporting the shared visible error.
  editor.editor.config(ctx =>
    ctx.update(uploadConfig.key, config => {
      const uploader = config.uploader;
      return {
        ...config,
        uploader: async (files, schema, context, position) => {
          try {
            return await uploader(files, schema, context, position);
          } catch (cause) {
            if (!destroyed)
              onUploadError(
                cause instanceof Error
                  ? cause.message
                  : 'The image could not be uploaded.',
              );
            return [];
          }
        },
      };
    }),
  );
  // Run before Milkdown expands references and removes their definitions.
  editor.editor.use(ctx => async () => {
    await ctx.wait(InitReady);
    const entry = {
      plugin: explicitBreaks,
      options: { preserveEmptyParagraphs: true },
    };
    ctx.update(remarkPluginsCtx, plugins => [entry, ...plugins]);
    return () => {
      ctx.update(remarkPluginsCtx, plugins =>
        plugins.filter(plugin => plugin !== entry),
      );
    };
  });
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
    async insertImage(file: File) {
      const url = await uploadImage(file);
      if (!destroyed) editor.editor.action(insert(`![Image](${url})`));
    },
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
    async destroy() {
      destroyed = true;
      for (const upload of uploads) upload.abort();
      await editor.destroy();
    },
  };
}

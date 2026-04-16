import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '$lib/constants';
import { sharedRemarkDirective } from '$lib/milkdown/shared/remarkDirective';
import { videoBlockInsertPlugin } from '$lib/milkdown/videoBlock';
import {
  commandsCtx,
  defaultValueCtx,
  Editor,
  editorViewCtx,
  editorViewOptionsCtx,
  rootCtx,
} from '@milkdown/core';
import type { MilkdownPlugin } from '@milkdown/ctx';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import {
  commonmark,
  downgradeHeadingCommand,
  headingKeymap,
  headingSchema,
  paragraphSchema,
  wrapInHeadingCommand,
  wrapInHeadingInputRule,
} from '@milkdown/preset-commonmark';
import { setBlockType } from '@milkdown/prose/commands';
import { textblockTypeInputRule } from '@milkdown/prose/inputrules';
import { Plugin, PluginKey } from '@milkdown/prose/state';
import type { EditorView, NodeViewConstructor } from '@milkdown/prose/view';
import {
  $command,
  $inputRule,
  type $Node,
  $prose,
  $useKeymap,
  type $View,
} from '@milkdown/utils';

import type { EditorAssetEventHandlers } from './types';

interface EditorOptions extends Partial<EditorAssetEventHandlers> {
  root: HTMLElement;
  defaultValue: string;
  onChange?: (markdown: string) => void;
  readOnly?: boolean;
  nodes?: $Node[];
  nodeViews?: $View<$Node, NodeViewConstructor>[];
}

function validateImage(file: File): string | null {
  const allowedTypes = ALLOWED_IMAGE_TYPES as readonly string[];
  if (!allowedTypes.includes(file.type)) {
    return `File type "${file.type}" is not allowed. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`;
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `File size exceeds the maximum allowed size of ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB`;
  }
  return null;
}

function insertImageAtCursorFromView(
  view: EditorView,
  src: string,
  alt: string = '',
): void {
  const { state, dispatch } = view;
  const imageNodeType = state.schema.nodes.image;
  if (!imageNodeType) return;

  const imageNode = imageNodeType.create({ src, alt });
  const tr = state.tr.replaceSelectionWith(imageNode);
  dispatch(tr);
}

interface ImageUploadPluginOptions {
  onImageAdd?: (file: File, blobUrl: string) => void;
  onImageError?: (error: string) => void;
}

const imageUploadPluginKey = new PluginKey('image-upload');

const createImageUploadPlugin = (options: ImageUploadPluginOptions) =>
  $prose(() => {
    return new Plugin({
      key: imageUploadPluginKey,
      props: {
        handlePaste(view, event) {
          const items = event.clipboardData?.items;
          if (!items) return false;

          for (const item of items) {
            if (item.type.startsWith('image/')) {
              event.preventDefault();
              const file = item.getAsFile();
              if (file) {
                const error = validateImage(file);
                if (error) {
                  options.onImageError?.(error);
                  return true;
                }
                const blobUrl = URL.createObjectURL(file);
                options.onImageAdd?.(file, blobUrl);
                insertImageAtCursorFromView(view, blobUrl, '');
              }
              return true;
            }
          }
          return false;
        },
        handleDrop(view, event) {
          const items = event.dataTransfer?.items;
          if (!items) return false;

          for (const item of items) {
            if (item.type.startsWith('image/')) {
              event.preventDefault();
              const file = item.getAsFile();
              if (file) {
                const error = validateImage(file);
                if (error) {
                  options.onImageError?.(error);
                  return true;
                }
                const blobUrl = URL.createObjectURL(file);
                options.onImageAdd?.(file, blobUrl);
                insertImageAtCursorFromView(view, blobUrl, '');
              }
              return true;
            }
          }
          return false;
        },
      },
    });
  });

const wrapInHeadingUpToH3Command = $command('WrapInHeadingUpToH3', ctx => {
  return (level?: number) => {
    const next = level ?? 1;

    if (next < 1) return setBlockType(paragraphSchema.type(ctx));
    if (next > 3) return setBlockType(paragraphSchema.type(ctx));

    return setBlockType(headingSchema.type(ctx), { level: next });
  };
});

const wrapInHeadingUpToH3InputRule = $inputRule(ctx =>
  textblockTypeInputRule(
    /^(?<hashes>#{1,3})\s$/,
    headingSchema.type(ctx),
    match => {
      const x = match.groups?.hashes.length ?? 1;
      const view = ctx.get(editorViewCtx);
      const node = view.state.selection.$from.node();

      if (node.type.name === 'heading') {
        const level = Math.min(Number(node.attrs.level) + x, 3);
        return { level };
      }

      return { level: x };
    },
  ),
);

const headingH123KeyMap = $useKeymap('headingH123Keymap', {
  TurnIntoH1: {
    shortcuts: 'Mod-Alt-1',
    command: ctx => {
      const commands = ctx.get(commandsCtx);
      return () => commands.call(wrapInHeadingUpToH3Command.key, 1);
    },
  },
  TurnIntoH2: {
    shortcuts: 'Mod-Alt-2',
    command: ctx => {
      const commands = ctx.get(commandsCtx);
      return () => commands.call(wrapInHeadingUpToH3Command.key, 2);
    },
  },
  TurnIntoH3: {
    shortcuts: 'Mod-Alt-3',
    command: ctx => {
      const commands = ctx.get(commandsCtx);
      return () => commands.call(wrapInHeadingUpToH3Command.key, 3);
    },
  },
  DowngradeHeading: {
    shortcuts: ['Delete', 'Backspace'],
    command: ctx => {
      const commands = ctx.get(commandsCtx);
      return () => commands.call(downgradeHeadingCommand.key);
    },
  },
});

const removeDefaultHeadingControls = new Set([
  wrapInHeadingCommand,
  wrapInHeadingInputRule,
  headingKeymap,
]) as ReadonlySet<MilkdownPlugin>;

const normalizeHeadingLevels = (markdown: string): string => {
  const lines = markdown.split('\n');
  let insideFence = false;
  let fenceMarker: '`' | '~' | null = null;

  const normalized = lines.map(line => {
    const fenceLineMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
    if (fenceLineMatch) {
      const marker = fenceLineMatch[2][0] as '`' | '~';
      if (!insideFence) {
        insideFence = true;
        fenceMarker = marker;
      } else if (fenceMarker === marker) {
        insideFence = false;
        fenceMarker = null;
      }
      return line;
    }

    if (insideFence) return line;

    const m = line.match(/^(\s{0,3})#{4,6}[ \t]+(.*?)(?:[ \t]+#+[ \t]*)?$/);
    if (m) return `${m[1]}${m[2]}`;

    return line;
  });

  return normalized.join('\n');
};

/**
 * Creates a Milkdown editor instance with the specified options. The editor is configured to use the CommonMark preset with custom heading controls that only support headings up to level 3. The `onChange` callback is called whenever the markdown content changes, and the editor can be set to read-only mode if needed.
 * @param options.root - The root HTML element where the editor will be mounted.
 * @param options.defaultValue - The initial markdown content to be loaded into the editor.
 * @param options.onChange - An optional callback function that is called with the updated markdown content whenever it changes.
 * @param options.readOnly - A boolean flag indicating whether the editor should be in read-only mode. If true, the editor will not allow any changes to the content.
 * @param options.onImageAdd - An optional callback function that is called when an image is pasted or dropped into the editor.
 * @param options.onImageError - An optional callback function that is called when an image validation error occurs.
 * @returns A promise that resolves to the created Editor instance.
 * @example
 * const root = document.getElementById('editor');
 * const editor = await createMilkdownEditor({
 *   root,
 *   defaultValue: '# Hello World',
 *   onChange: markdown => console.log(markdown),
 *   readOnly: false,
 * });
 */
export async function createMilkdownEditor({
  root,
  defaultValue,
  readOnly = false,
  nodes = [],
  nodeViews = [],
  onChange,
  onImageAdd,
  onImageError,
  onVideoAdd,
  onVideoError,
}: EditorOptions): Promise<Editor> {
  const editor = Editor.make()
    .config(ctx => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, normalizeHeadingLevels(defaultValue));
      ctx.update(editorViewOptionsCtx, prev => ({
        ...prev,
        editable: () => !readOnly,
      }));

      if (!onChange || readOnly) return;

      ctx.get(listenerCtx).markdownUpdated((_, markdown, prevMarkdown) => {
        const next = normalizeHeadingLevels(markdown);
        const prev = normalizeHeadingLevels(prevMarkdown);

        if (next !== prev) onChange(next);
      });
    })
    .use(commonmark.filter(p => !removeDefaultHeadingControls.has(p)))
    .use(wrapInHeadingUpToH3Command)
    .use(wrapInHeadingUpToH3InputRule)
    .use(headingH123KeyMap)
    .use(listener)
    .use(sharedRemarkDirective)
    .use(nodes)
    .use(nodeViews);

  if (!readOnly && onImageAdd && onImageError)
    editor.use(
      createImageUploadPlugin({
        onImageAdd,
        onImageError,
      }),
    );

  if (!readOnly && onVideoAdd && onVideoError)
    editor.use(
      videoBlockInsertPlugin({
        onVideoAdd,
        onVideoError,
      }),
    );

  return await editor.create();
}

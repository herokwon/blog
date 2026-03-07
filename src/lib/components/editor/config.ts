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
import { $command, $inputRule, $useKeymap } from '@milkdown/utils';

interface EditorOptions {
  root: HTMLElement;
  defaultValue: string;
  onChange?: (markdown: string) => void;
  readOnly?: boolean;
}

function normalizeHeadingLevels(markdown: string): string {
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
}

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

export const createMilkdownEditor = async ({
  root,
  defaultValue,
  onChange,
  readOnly = false,
}: EditorOptions): Promise<Editor> => {
  return await Editor.make()
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
    .create();
};

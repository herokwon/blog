import { describe, expect, it, vi } from 'vitest';

import type { Editor as MilkdownEditor } from '@milkdown/core';

import { createMilkdownEditor } from './config';

interface MockCtx {
  set: (token: string, value: HTMLElement | string) => void;
  update: (
    token: string,
    updater: (prev: { flag: boolean }) => {
      flag: boolean;
      editable: () => boolean;
    },
  ) => void;
  get: (token: string) => {
    markdownUpdated: (
      callback: (ctx: string, markdown: string, prevMarkdown: string) => void,
    ) => void;
  } | null;
}

type ListenerCallback = (
  ctx: string,
  markdown: string,
  prevMarkdown: string,
) => void;

const state = vi.hoisted(() => ({
  listenerCallback: null as ListenerCallback | null,
  setMock: vi.fn<(token: string, value: HTMLElement | string) => void>(),
  updateMock: vi.fn<
    (
      token: string,
      updater: (prev: { flag: boolean }) => {
        flag: boolean;
        editable: () => boolean;
      },
    ) => void
  >(),
  createMock: vi.fn(async (): Promise<MilkdownEditor> => {
    return {} as MilkdownEditor;
  }),
}));

vi.mock('@milkdown/core', () => ({
  commandsCtx: 'commandsCtx',
  defaultValueCtx: 'defaultValueCtx',
  editorViewCtx: 'editorViewCtx',
  editorViewOptionsCtx: 'editorViewOptionsCtx',
  rootCtx: 'rootCtx',
  Editor: {
    make: () => {
      const ctx: MockCtx = {
        set: state.setMock,
        update: state.updateMock,
        get: (token: string) => {
          if (token === 'listenerCtx') {
            return {
              markdownUpdated: (
                callback: (
                  ctx: string,
                  markdown: string,
                  prevMarkdown: string,
                ) => void,
              ) => {
                void ctx;
                state.listenerCallback = callback;
              },
            };
          }

          return null;
        },
      };

      const builder = {
        config: (fn: (nextCtx: MockCtx) => void) => {
          fn(ctx);
          return builder;
        },
        use: (plugin: object) => {
          void plugin;
          return builder;
        },
        create: state.createMock,
      };

      return builder;
    },
  },
}));

vi.mock('@milkdown/plugin-listener', () => ({
  listener: { key: 'listener' },
  listenerCtx: 'listenerCtx',
}));

vi.mock('@milkdown/preset-commonmark', () => {
  const wrapInHeadingCommand = { key: 'wrapInHeadingCommand' };
  const wrapInHeadingInputRule = { key: 'wrapInHeadingInputRule' };
  const headingKeymap = { key: 'headingKeymap' };

  return {
    commonmark: [wrapInHeadingCommand, wrapInHeadingInputRule, headingKeymap],
    downgradeHeadingCommand: { key: 'downgradeHeadingCommand' },
    headingKeymap,
    headingSchema: {
      type: (ctx: object) => {
        void ctx;
        return {};
      },
    },
    paragraphSchema: {
      type: (ctx: object) => {
        void ctx;
        return {};
      },
    },
    wrapInHeadingCommand,
    wrapInHeadingInputRule,
  };
});

vi.mock('@milkdown/prose/commands', () => ({
  setBlockType: (type: object, attrs?: { level: number }) => {
    void type;
    void attrs;
    return () => true;
  },
}));

vi.mock('@milkdown/prose/inputrules', () => ({
  textblockTypeInputRule: (
    regexp: RegExp,
    type: object,
    attrs: (match: RegExpMatchArray & { groups?: { hashes?: string } }) => {
      level: number;
    },
  ) => {
    void regexp;
    void type;
    void attrs;
    return { key: 'textblockTypeInputRule' };
  },
}));

vi.mock('@milkdown/utils', () => ({
  $command: (
    key: string,
    factory: (ctx: object) => (level?: number) => object,
  ) => {
    void factory;
    return { key };
  },
  $inputRule: (factory: (ctx: object) => object) => {
    void factory;
    return { key: 'inputRule' };
  },
  $useKeymap: (
    key: string,
    keymap: Record<
      string,
      {
        shortcuts: string | string[];
        command: (ctx: {
          get: (token: string) => {
            call: (key: string, level?: number) => boolean;
          };
        }) => () => boolean;
      }
    >,
  ) => {
    void keymap;
    return { key };
  },
}));

function getListenerCallback(): ListenerCallback {
  if (state.listenerCallback === null)
    throw new Error('listener callback is required');

  return state.listenerCallback as ListenerCallback;
}

describe('[Components] Editor config', () => {
  it('should normalize heading levels before setting default value', async () => {
    state.setMock.mockClear();

    const root = {} as HTMLElement;
    const markdown = '#### Heading\\n```\\n##### keep\\n```\\n###### Tail';

    await createMilkdownEditor({ root, defaultValue: markdown });

    expect(state.setMock).toHaveBeenCalledWith('rootCtx', root);
    expect(state.setMock).toHaveBeenCalledWith(
      'defaultValueCtx',
      'Heading\\n```\\n##### keep\\n```\\n###### Tail',
    );
  });

  it('should call onChange with normalized markdown only when changed', async () => {
    state.listenerCallback = null;
    const onChange = vi.fn<(markdown: string) => void>();

    await createMilkdownEditor({
      root: {} as HTMLElement,
      defaultValue: '',
      onChange,
    });

    const callback = getListenerCallback();

    callback('ctx', '#### Same', 'Same');
    expect(onChange).not.toHaveBeenCalled();

    callback('ctx', '###### Next', 'Old');
    expect(onChange).toHaveBeenCalledWith('Next');
  });
});

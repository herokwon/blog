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
    // Execute attrs to cover the match callback body in config.ts
    attrs(
      Object.assign(['##'], {
        groups: { hashes: '##' },
      }) as RegExpMatchArray & {
        groups?: { hashes?: string };
      },
    );
    attrs(
      Object.assign(['#'], {
        groups: undefined as undefined,
      }) as RegExpMatchArray & { groups?: { hashes?: string } },
    );
    return { key: 'textblockTypeInputRule' };
  },
}));

vi.mock('@milkdown/utils', () => ({
  $command: (
    key: string,
    factory: (ctx: object) => (level?: number) => object,
  ) => {
    const commandFn = factory({});
    commandFn(); // undefined → next = 1 (valid heading)
    commandFn(0); // next < 1 → paragraph
    commandFn(4); // next > 3 → paragraph
    commandFn(2); // valid → heading
    return { key };
  },
  $inputRule: (factory: (ctx: object) => object) => {
    // Non-heading node: covers return { level: x }
    factory({
      get: (token: string) =>
        token === 'editorViewCtx'
          ? {
              state: {
                selection: {
                  $from: {
                    node: () => ({ type: { name: 'paragraph' }, attrs: {} }),
                  },
                },
              },
            }
          : null,
    });
    // Heading node: covers Math.min + return { level }
    factory({
      get: (token: string) =>
        token === 'editorViewCtx'
          ? {
              state: {
                selection: {
                  $from: {
                    node: () => ({
                      type: { name: 'heading' },
                      attrs: { level: 1 },
                    }),
                  },
                },
              },
            }
          : null,
    });
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
    const mockCommands = { call: (): boolean => true };
    const mockCtx = { get: () => mockCommands };
    for (const entry of Object.values(keymap)) {
      entry.command(mockCtx)();
    }
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

  it('should not set up listener when onChange is not provided', async () => {
    state.listenerCallback = null;

    await createMilkdownEditor({ root: {} as HTMLElement, defaultValue: '' });

    expect(state.listenerCallback).toBeNull();
  });

  it('should not set up listener when readOnly is true even if onChange is provided', async () => {
    state.listenerCallback = null;
    const onChange = vi.fn<(markdown: string) => void>();

    await createMilkdownEditor({
      root: {} as HTMLElement,
      defaultValue: '',
      onChange,
      readOnly: true,
    });

    expect(state.listenerCallback).toBeNull();
  });

  it('should configure editable as true when not readOnly', async () => {
    state.updateMock.mockClear();

    await createMilkdownEditor({ root: {} as HTMLElement, defaultValue: '' });

    const call = state.updateMock.mock.calls.find(
      ([token]) => token === 'editorViewOptionsCtx',
    );
    expect(call).toBeDefined();

    const result = call![1]({ flag: false });
    expect(result.editable()).toBe(true);
  });

  it('should configure editable as false when readOnly is true', async () => {
    state.updateMock.mockClear();

    await createMilkdownEditor({
      root: {} as HTMLElement,
      defaultValue: '',
      readOnly: true,
    });

    const call = state.updateMock.mock.calls.find(
      ([token]) => token === 'editorViewOptionsCtx',
    );
    expect(call).toBeDefined();

    const result = call![1]({ flag: false });
    expect(result.editable()).toBe(false);
  });

  it('should not normalize h1-h3 headings', async () => {
    state.setMock.mockClear();

    await createMilkdownEditor({
      root: {} as HTMLElement,
      defaultValue: '# H1\n## H2\n### H3',
    });

    expect(state.setMock).toHaveBeenCalledWith(
      'defaultValueCtx',
      '# H1\n## H2\n### H3',
    );
  });

  it('should keep headings inside tilde fences', async () => {
    state.setMock.mockClear();

    await createMilkdownEditor({
      root: {} as HTMLElement,
      defaultValue: '~~~\n#### inside\n~~~\n#### outside',
    });

    expect(state.setMock).toHaveBeenCalledWith(
      'defaultValueCtx',
      '~~~\n#### inside\n~~~\noutside',
    );
  });

  it('should not close a backtick fence with a tilde marker', async () => {
    state.setMock.mockClear();

    await createMilkdownEditor({
      root: {} as HTMLElement,
      defaultValue: '```\n#### inside\n~~~\n#### still inside\n```',
    });

    expect(state.setMock).toHaveBeenCalledWith(
      'defaultValueCtx',
      '```\n#### inside\n~~~\n#### still inside\n```',
    );
  });

  it('should normalize heading with trailing hashes', async () => {
    state.setMock.mockClear();

    await createMilkdownEditor({
      root: {} as HTMLElement,
      defaultValue: '#### Heading ####',
    });

    expect(state.setMock).toHaveBeenCalledWith('defaultValueCtx', 'Heading');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAX_IMAGE_SIZE_BYTES } from '$lib/constants';
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

interface MockEditorView {
  state: {
    schema: { nodes: { image?: { create: (attrs: object) => object } } };
    tr: { replaceSelectionWith: (node: object) => object };
  };
  dispatch: (tr: object) => void;
}

interface ImagePluginHandlers {
  handlePaste: (
    view: MockEditorView,
    event: Partial<ClipboardEvent>,
  ) => boolean;
  handleDrop: (view: MockEditorView, event: Partial<DragEvent>) => boolean;
}

type EventType = 'paste' | 'drop';

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
  imagePluginHandlers: null as ImagePluginHandlers | null,
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

vi.mock('@milkdown/prose/state', () => ({
  Plugin: class MockPlugin {
    constructor(options: { props: ImagePluginHandlers }) {
      state.imagePluginHandlers = options.props;
    }
  },
  PluginKey: class MockPluginKey {
    constructor(name: string) {
      void name;
    }
  },
}));

vi.mock('@milkdown/utils', () => ({
  $command: (
    key: string,
    factory: (ctx: object) => (level?: number) => object,
  ) => {
    const commandFn = factory({});
    [undefined, 0, 4, 2].forEach(level => commandFn(level));
    return { key };
  },
  $inputRule: (factory: (ctx: object) => object) => {
    const createMockCtx = (nodeName: string, attrs = {}) => ({
      get: (token: string) =>
        token === 'editorViewCtx'
          ? {
              state: {
                selection: {
                  $from: { node: () => ({ type: { name: nodeName }, attrs }) },
                },
              },
            }
          : null,
    });
    factory(createMockCtx('paragraph'));
    factory(createMockCtx('heading', { level: 1 }));
    return { key: 'inputRule' };
  },
  $useKeymap: (
    key: string,
    keymap: Record<
      string,
      {
        shortcuts: string | string[];
        command: (ctx: {
          get: (token: string) => { call: () => boolean };
        }) => () => boolean;
      }
    >,
  ) => {
    const mockCtx = { get: () => ({ call: () => true }) };
    Object.values(keymap).forEach(entry => entry.command(mockCtx)());
    return { key };
  },
  $prose: (factory: () => object) => factory(),
}));

// Helper functions
const createMockView = (hasImageNode = false): MockEditorView => ({
  state: {
    schema: {
      nodes: hasImageNode
        ? { image: { create: () => ({ type: 'image' }) } }
        : {},
    },
    tr: { replaceSelectionWith: vi.fn().mockReturnThis() },
  },
  dispatch: vi.fn(),
});

const createMockImageEvent = (
  eventType: EventType,
  options: { file?: File | null; hasData?: boolean } = {},
) => {
  const { file, hasData = true } = options;
  const dataKey = eventType === 'paste' ? 'clipboardData' : 'dataTransfer';
  const mockItem =
    file !== undefined
      ? { type: file?.type ?? 'image/png', getAsFile: () => file }
      : null;

  return {
    preventDefault: vi.fn(),
    [dataKey]: hasData ? { items: mockItem ? [mockItem] : [] } : null,
  } as unknown as Partial<ClipboardEvent | DragEvent>;
};

const initImageEditor = async (
  callbacks: {
    onImageAdd?: ReturnType<typeof vi.fn>;
    onImageError?: ReturnType<typeof vi.fn>;
  } = {},
) => {
  await createMilkdownEditor({
    root: {} as HTMLElement,
    defaultValue: '',
    ...(callbacks as Pick<
      Parameters<typeof createMilkdownEditor>[0],
      'onImageAdd' | 'onImageError'
    >),
  });
};

const invokeHandler = (
  eventType: EventType,
  view: MockEditorView,
  event: Partial<ClipboardEvent | DragEvent>,
) =>
  eventType === 'paste'
    ? state.imagePluginHandlers!.handlePaste(
        view,
        event as Partial<ClipboardEvent>,
      )
    : state.imagePluginHandlers!.handleDrop(view, event as Partial<DragEvent>);

describe('[Components] Editor config', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Heading normalization', () => {
    it.each([
      [
        '#### Heading\\n```\\n##### keep\\n```\\n###### Tail',
        'Heading\\n```\\n##### keep\\n```\\n###### Tail',
      ],
      ['# H1\n## H2\n### H3', '# H1\n## H2\n### H3'],
      ['~~~\n#### inside\n~~~\n#### outside', '~~~\n#### inside\n~~~\noutside'],
      [
        '```\n#### inside\n~~~\n#### still inside\n```',
        '```\n#### inside\n~~~\n#### still inside\n```',
      ],
      ['#### Heading ####', 'Heading'],
    ])('should normalize "%s" to "%s"', async (input, expected) => {
      state.setMock.mockClear();
      await createMilkdownEditor({
        root: {} as HTMLElement,
        defaultValue: input,
      });
      expect(state.setMock).toHaveBeenCalledWith('defaultValueCtx', expected);
    });
  });

  describe('Listener configuration', () => {
    it('should call onChange with normalized markdown only when changed', async () => {
      state.listenerCallback = null;
      const onChange = vi.fn();
      await createMilkdownEditor({
        root: {} as HTMLElement,
        defaultValue: '',
        onChange,
      });

      state.listenerCallback!('ctx', '#### Same', 'Same');
      expect(onChange).not.toHaveBeenCalled();

      state.listenerCallback!('ctx', '###### Next', 'Old');
      expect(onChange).toHaveBeenCalledWith('Next');
    });

    it.each([
      ['onChange is not provided', {}],
      ['readOnly is true', { onChange: vi.fn(), readOnly: true }],
    ])('should not set up listener when %s', async (_, options) => {
      state.listenerCallback = null;
      await createMilkdownEditor({
        root: {} as HTMLElement,
        defaultValue: '',
        ...options,
      });
      expect(state.listenerCallback).toBeNull();
    });
  });

  describe('Editable configuration', () => {
    it.each([
      [false, true],
      [true, false],
    ])(
      'should configure editable=%s when readOnly=%s',
      async (readOnly, expectedEditable) => {
        state.updateMock.mockClear();
        await createMilkdownEditor({
          root: {} as HTMLElement,
          defaultValue: '',
          readOnly,
        });

        const call = state.updateMock.mock.calls.find(
          ([token]) => token === 'editorViewOptionsCtx',
        );
        expect(call![1]({ flag: false }).editable()).toBe(expectedEditable);
      },
    );
  });

  describe('Image upload plugin', () => {
    it.each([
      ['onImageAdd', { onImageAdd: vi.fn() }],
      ['onImageError', { onImageError: vi.fn() }],
    ])('should use plugin when %s is provided', async (_, callbacks) => {
      state.imagePluginHandlers = null;
      await initImageEditor(callbacks);
      expect(state.imagePluginHandlers).not.toBeNull();
    });

    it('should not use plugin in readOnly mode', async () => {
      state.imagePluginHandlers = null;
      await createMilkdownEditor({
        root: {} as HTMLElement,
        defaultValue: '',
        readOnly: true,
        onImageAdd: vi.fn(),
      });
      expect(state.imagePluginHandlers).toBeNull();
    });
  });

  describe('Image handling (paste/drop)', () => {
    it.each<[EventType]>([['paste'], ['drop']])(
      'should handle %s with valid image file',
      async eventType => {
        vi.stubGlobal('URL', {
          ...URL,
          createObjectURL: () => 'blob:test-url',
        });
        const onImageAdd = vi.fn();
        await initImageEditor({ onImageAdd });

        const file = new File(['test'], 'test.png', { type: 'image/png' });
        const event = createMockImageEvent(eventType, { file });
        const view = createMockView(true);

        const result = invokeHandler(eventType, view, event);

        expect(result).toBe(true);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(onImageAdd).toHaveBeenCalledWith(file, 'blob:test-url');
        expect(view.dispatch).toHaveBeenCalled();
      },
    );

    it.each<[EventType, string, string]>([
      ['paste', 'image/bmp', 'File type "image/bmp" is not allowed'],
      ['drop', 'image/svg+xml', 'File type "image/svg+xml" is not allowed'],
    ])(
      'should reject %s with invalid type %s',
      async (eventType, type, errorMsg) => {
        const onImageError = vi.fn();
        await initImageEditor({ onImageError });

        const file = new File(['test'], 'test.file', { type });
        const result = invokeHandler(
          eventType,
          createMockView(),
          createMockImageEvent(eventType, { file }),
        );

        expect(result).toBe(true);
        expect(onImageError).toHaveBeenCalledWith(
          expect.stringContaining(errorMsg),
        );
      },
    );

    it.each<[EventType]>([['paste'], ['drop']])(
      'should reject %s with oversized image',
      async eventType => {
        const onImageError = vi.fn();
        await initImageEditor({ onImageError });

        const file = new File(
          [new Uint8Array(MAX_IMAGE_SIZE_BYTES + 1)],
          'large.png',
          { type: 'image/png' },
        );
        const result = invokeHandler(
          eventType,
          createMockView(),
          createMockImageEvent(eventType, { file }),
        );

        expect(result).toBe(true);
        expect(onImageError).toHaveBeenCalledWith(
          expect.stringContaining('File size exceeds'),
        );
      },
    );

    it.each<[EventType]>([['paste'], ['drop']])(
      'should return false when no data on %s',
      async eventType => {
        await initImageEditor({ onImageAdd: vi.fn() });
        const result = invokeHandler(
          eventType,
          createMockView(),
          createMockImageEvent(eventType, { hasData: false }),
        );
        expect(result).toBe(false);
      },
    );

    it.each<[EventType]>([['paste'], ['drop']])(
      'should return false when %s contains no image items',
      async eventType => {
        await initImageEditor({ onImageAdd: vi.fn() });

        const event = {
          [eventType === 'paste' ? 'clipboardData' : 'dataTransfer']: {
            items: [{ type: 'text/plain', getAsFile: () => null }],
          },
        } as unknown as Partial<ClipboardEvent | DragEvent>;

        const result = invokeHandler(eventType, createMockView(), event);
        expect(result).toBe(false);
      },
    );

    it.each<[EventType]>([['paste'], ['drop']])(
      'should return true but not process %s when getAsFile returns null',
      async eventType => {
        const onImageAdd = vi.fn();
        await initImageEditor({ onImageAdd });

        const result = invokeHandler(
          eventType,
          createMockView(),
          createMockImageEvent(eventType, { file: null }),
        );

        expect(result).toBe(true);
        expect(onImageAdd).not.toHaveBeenCalled();
      },
    );

    it('should not insert image when imageNodeType is not available', async () => {
      vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:test' });
      const onImageAdd = vi.fn();
      await initImageEditor({ onImageAdd });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const view = createMockView(false);
      invokeHandler('paste', view, createMockImageEvent('paste', { file }));

      expect(view.dispatch).not.toHaveBeenCalled();
    });
  });
});

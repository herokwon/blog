import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_IMAGE_SIZE_BYTES, MAX_VIDEO_SIZE_BYTES } from '$lib/constants';
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
    schema: {
      nodes: {
        image?: { create: (attrs: object) => object };
        video_block?: { create: (attrs: object) => object };
      };
    };
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

interface VideoPluginHandlers {
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
  videoPluginHandlers: null as VideoPluginHandlers | null,
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
    constructor(options: {
      key?: { name?: string };
      props: ImagePluginHandlers | VideoPluginHandlers;
    }) {
      const keyName = options.key?.name;

      if (keyName?.includes('image')) state.imagePluginHandlers = options.props;
      else state.videoPluginHandlers = options.props;
    }
  },
  PluginKey: class MockPluginKey {
    name: string;
    constructor(name: string) {
      this.name = name;
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
  $node: (name: string, factory: () => object) => {
    void name;
    factory();
    return { key: `${name}Node` };
  },
  $nodeAttr: (name: string, factory: () => object) => {
    void name;
    factory();
    return { key: `${name}Attr` };
  },
  $nodeSchema: (name: string, factory: () => object) => {
    void name;
    factory();
    return { key: `${name}Schema` };
  },
  $remark: (name: string, factory: () => unknown) => {
    void name;
    factory();
    return { key: `${name}Remark` };
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
const createMockView = (
  options: {
    hasImageNode?: boolean;
    hasVideoNode?: boolean;
  } = {},
): MockEditorView => {
  const { hasImageNode = false, hasVideoNode = false } = options;

  return {
    state: {
      schema: {
        nodes: {
          ...(hasImageNode && {
            image: { create: () => ({ type: 'image' }) },
          }),
          ...(hasVideoNode && {
            video_block: { create: () => ({ type: 'video_block' }) },
          }),
        },
      },
      tr: { replaceSelectionWith: vi.fn().mockReturnThis() },
    },
    dispatch: vi.fn(),
  };
};

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

const createMockVideoEvent = (
  eventType: EventType,
  options: { file?: File | null; hasData?: boolean; text?: string } = {},
): Partial<ClipboardEvent> | Partial<DragEvent> => {
  const { file, hasData = true, text = '' } = options;
  const mockItem =
    file !== undefined
      ? { type: file?.type ?? 'video/mp4', getAsFile: () => file }
      : null;

  const preventDefault = vi.fn();

  if (eventType === 'paste')
    return {
      preventDefault,
      clipboardData: hasData
        ? ({
            items: mockItem
              ? [mockItem]
              : text
                ? [
                    {
                      kind: 'string',
                      getAsString: (callback: (data: string) => void) =>
                        callback(text),
                      getAsFile: () => null,
                      type: 'text/plain',
                    } as unknown as DataTransferItem,
                  ]
                : [],
            getData: () => text,
          } as unknown as DataTransfer)
        : null,
    };

  return {
    preventDefault,
    dataTransfer: hasData
      ? ({
          items: mockItem ? [mockItem] : [],
          getData: () => text,
        } as unknown as DataTransfer)
      : null,
  };
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

const initVideoEditor = async (
  callbacks: {
    onVideoAdd?: ReturnType<typeof vi.fn>;
    onVideoError?: ReturnType<typeof vi.fn>;
  } = {},
) => {
  await createMilkdownEditor({
    root: {} as HTMLElement,
    defaultValue: '',
    ...(callbacks as Pick<
      Parameters<typeof createMilkdownEditor>[0],
      'onVideoAdd' | 'onVideoError'
    >),
  });
};

const invokeHandler = (
  eventType: EventType,
  view: MockEditorView,
  event: Partial<ClipboardEvent | DragEvent>,
  handlerType: 'image' | 'video',
): boolean => {
  const handlers =
    handlerType === 'image'
      ? state.imagePluginHandlers
      : state.videoPluginHandlers;

  return (
    (eventType === 'paste'
      ? handlers?.handlePaste(view, event as Partial<ClipboardEvent>)
      : handlers?.handleDrop(view, event as Partial<DragEvent>)) ?? false
  );
};

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
    it('should use plugin when all callbacks are provided', async () => {
      state.imagePluginHandlers = null;
      await initImageEditor({
        onImageAdd: vi.fn(),
        onImageError: vi.fn(),
      });
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
    let onImageAdd: ReturnType<typeof vi.fn>;
    let onImageError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onImageAdd = vi.fn();
      onImageError = vi.fn();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it.each<[EventType]>([['paste'], ['drop']])(
      'should handle %s with valid image file',
      async eventType => {
        vi.stubGlobal('URL', {
          ...URL,
          createObjectURL: () => 'blob:test-url',
        });
        await initImageEditor({ onImageAdd, onImageError });

        const file = new File(['test'], 'test.png', { type: 'image/png' });
        const event = createMockImageEvent(eventType, { file });
        const view = createMockView({ hasImageNode: true });

        const result = invokeHandler(eventType, view, event, 'image');

        expect(result).toBe(true);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(onImageAdd).toHaveBeenCalledWith(file, 'blob:test-url');
        expect(onImageError).not.toHaveBeenCalled();
        expect(view.dispatch).toHaveBeenCalled();
      },
    );

    it.each<[EventType, string, string]>([
      ['paste', 'image/bmp', 'File type "image/bmp" is not allowed'],
      ['drop', 'image/svg+xml', 'File type "image/svg+xml" is not allowed'],
    ])(
      'should reject %s with invalid type %s',
      async (eventType, type, errorMsg) => {
        await initImageEditor({ onImageAdd, onImageError });

        const file = new File(['test'], 'test.file', { type });
        const result = invokeHandler(
          eventType,
          createMockView(),
          createMockImageEvent(eventType, { file }),
          'image',
        );

        expect(result).toBe(true);
        expect(onImageAdd).not.toHaveBeenCalled();
        expect(onImageError).toHaveBeenCalledWith(
          expect.stringContaining(errorMsg),
        );
      },
    );

    it.each<[EventType]>([['paste'], ['drop']])(
      'should reject %s with oversized image',
      async eventType => {
        await initImageEditor({ onImageAdd, onImageError });

        const file = new File(
          [new Uint8Array(MAX_IMAGE_SIZE_BYTES + 1)],
          'large.png',
          { type: 'image/png' },
        );
        const result = invokeHandler(
          eventType,
          createMockView(),
          createMockImageEvent(eventType, { file }),
          'image',
        );

        expect(result).toBe(true);
        expect(onImageAdd).not.toHaveBeenCalled();
        expect(onImageError).toHaveBeenCalledWith(
          expect.stringContaining('File size exceeds'),
        );
      },
    );

    it.each<[EventType]>([['paste'], ['drop']])(
      'should return false when no data on %s',
      async eventType => {
        await initImageEditor({ onImageAdd, onImageError });
        const result = invokeHandler(
          eventType,
          createMockView(),
          createMockImageEvent(eventType, { hasData: false }),
          'image',
        );
        expect(result).toBe(false);
      },
    );

    it.each<[EventType]>([['paste'], ['drop']])(
      'should return false when %s contains no image items',
      async eventType => {
        await initImageEditor({ onImageAdd, onImageError });

        const event = {
          [eventType === 'paste' ? 'clipboardData' : 'dataTransfer']: {
            items: [{ type: 'text/plain', getAsFile: () => null }],
          },
        } as unknown as Partial<ClipboardEvent | DragEvent>;

        const result = invokeHandler(
          eventType,
          createMockView(),
          event,
          'image',
        );
        expect(result).toBe(false);
      },
    );

    it.each<[EventType]>([['paste'], ['drop']])(
      'should return true but not process %s when getAsFile returns null',
      async eventType => {
        await initImageEditor({ onImageAdd, onImageError });

        const result = invokeHandler(
          eventType,
          createMockView(),
          createMockImageEvent(eventType, { file: null }),
          'image',
        );

        expect(result).toBe(true);
        expect(onImageAdd).not.toHaveBeenCalled();
        expect(onImageError).not.toHaveBeenCalled();
      },
    );

    it('should not insert image when imageNodeType is not available', async () => {
      vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:test' });
      await initImageEditor({ onImageAdd, onImageError });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const view = createMockView();
      invokeHandler(
        'paste',
        view,
        createMockImageEvent('paste', { file }),
        'image',
      );

      expect(view.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('Video upload plugin', () => {
    it('should use plugin when all callbacks are provided', async () => {
      state.videoPluginHandlers = null;
      await initVideoEditor({
        onVideoAdd: vi.fn(),
        onVideoError: vi.fn(),
      });
      expect(state.videoPluginHandlers).not.toBeNull();
    });

    it('should not use plugin in readOnly mode', async () => {
      state.videoPluginHandlers = null;
      await createMilkdownEditor({
        root: {} as HTMLElement,
        defaultValue: '',
        readOnly: true,
        onVideoAdd: vi.fn(),
      });
      expect(state.videoPluginHandlers).toBeNull();
    });
  });

  describe('Video handling (paste/drop)', () => {
    let onVideoAdd: ReturnType<typeof vi.fn>;
    let onVideoError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onVideoAdd = vi.fn();
      onVideoError = vi.fn();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it.each<[EventType]>([['paste'], ['drop']])(
      'should handle %s with valid video file',
      async eventType => {
        vi.stubGlobal('URL', {
          ...URL,
          createObjectURL: () => 'blob:test-url',
        });
        await initVideoEditor({ onVideoAdd, onVideoError });

        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const event = createMockVideoEvent(eventType, { file });
        const view = createMockView({
          hasVideoNode: true,
        });

        const result = invokeHandler(eventType, view, event, 'video');

        expect(result).toBe(true);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(onVideoAdd).toHaveBeenCalledWith(file, 'blob:test-url');
        expect(onVideoError).not.toHaveBeenCalled();
        expect(view.dispatch).toHaveBeenCalled();
      },
    );

    it.each<[EventType, string, string]>([
      ['paste', 'video/mpeg', 'File type "video/mpeg" is not allowed'],
      ['drop', 'video/avi', 'File type "video/avi" is not allowed'],
    ])(
      'should reject %s with invalid type %s',
      async (eventType, type, errorMsg) => {
        await initVideoEditor({ onVideoAdd, onVideoError });

        const file = new File(['test'], 'test.file', { type });
        const result = invokeHandler(
          eventType,
          createMockView(),
          createMockVideoEvent(eventType, { file }),
          'video',
        );

        expect(result).toBe(true);
        expect(onVideoAdd).not.toHaveBeenCalled();
        expect(onVideoError).toHaveBeenCalledWith(
          expect.stringContaining(errorMsg),
        );
      },
    );

    it.each<[EventType]>([['paste'], ['drop']])(
      'should reject %s with oversized video',
      async eventType => {
        await initVideoEditor({ onVideoAdd, onVideoError });

        const file = new File(
          [new Uint8Array(MAX_VIDEO_SIZE_BYTES + 1)],
          'large.mp4',
          { type: 'video/mp4' },
        );
        const result = invokeHandler(
          eventType,
          createMockView(),
          createMockVideoEvent(eventType, { file }),
          'video',
        );

        expect(result).toBe(true);
        expect(onVideoAdd).not.toHaveBeenCalled();
        expect(onVideoError).toHaveBeenCalledWith(
          expect.stringContaining('File size exceeds'),
        );
      },
    );

    it.each<[EventType]>([['paste'], ['drop']])(
      'should return false when no data on %s',
      async eventType => {
        await initVideoEditor({ onVideoAdd, onVideoError });
        const result = invokeHandler(
          eventType,
          createMockView(),
          createMockVideoEvent(eventType, { hasData: false }),
          'video',
        );
        expect(result).toBe(false);
      },
    );

    it.each<[EventType]>([['paste'], ['drop']])(
      'should return false when %s contains no video items',
      async eventType => {
        await initVideoEditor({ onVideoAdd, onVideoError });

        const event = {
          [eventType === 'paste' ? 'clipboardData' : 'dataTransfer']: {
            items: [{ type: 'text/plain', getAsFile: () => null }],
          },
        } as unknown as Partial<ClipboardEvent | DragEvent>;

        const result = invokeHandler(
          eventType,
          createMockView(),
          event,
          'video',
        );
        expect(result).toBe(false);
      },
    );

    it.each<[EventType]>([['paste'], ['drop']])(
      'should return true but not process %s when getAsFile returns null',
      async eventType => {
        await initVideoEditor({ onVideoAdd, onVideoError });

        const result = invokeHandler(
          eventType,
          createMockView(),
          createMockVideoEvent(eventType, { file: null }),
          'video',
        );

        expect(result).toBe(true);
        expect(onVideoAdd).not.toHaveBeenCalled();
        expect(onVideoError).not.toHaveBeenCalled();
      },
    );

    it('should not insert video when videoNodeType is not available', async () => {
      vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:test' });
      await initVideoEditor({ onVideoAdd, onVideoError });

      const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
      const view = createMockView();
      invokeHandler(
        'paste',
        view,
        createMockVideoEvent('paste', { file }),
        'video',
      );

      expect(view.dispatch).not.toHaveBeenCalled();
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EditorAssetEventHandlers } from '$lib/components/editor';
import { MAX_VIDEO_SIZE_BYTES } from '$lib/constants';
import type { Slice } from '@milkdown/prose/model';
import type { PluginKey, PluginSpec } from '@milkdown/prose/state';
import { EditorState, Plugin } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import type { $Prose } from '@milkdown/utils';

import { videoBlockInsertPlugin } from './videoBlock.plugin';

type VideoBlockInsertPluginOptions = Pick<
  EditorAssetEventHandlers,
  'onVideoAdd' | 'onVideoError'
>;

type HandlePaste = (
  view: Partial<EditorView>,
  event: ClipboardEvent,
  slice: Partial<Slice>,
) => boolean;

type HandleDrop = (
  view: Partial<EditorView>,
  event: DragEvent,
  slice: Partial<Slice>,
  moved: boolean,
) => boolean;

vi.mock('@milkdown/prose/state', () => ({
  Plugin: class MockPlugin {
    static instance: MockPlugin | null = null;
    spec: PluginSpec<EditorState>;
    constructor(spec: PluginSpec<EditorState>) {
      this.spec = spec;
      MockPlugin.instance = this as unknown as MockPlugin;
    }
  },
  PluginKey: class MockPluginKey {
    constructor(public key: string) {
      void key;
    }
  },
}));

let capturedPlugin: Plugin<EditorState> | null = null;

vi.mock('@milkdown/utils', () => ({
  $prose: (factory: () => Plugin<EditorState>) => {
    const plugin = factory();
    capturedPlugin = plugin;

    return plugin as unknown as $Prose;
  },
}));

const mockSlice: Partial<Slice> = {};

describe('[Milkdown] videoBlockInsertPlugin', () => {
  let onVideoAdd: ReturnType<typeof vi.fn>;
  let onVideoError: ReturnType<typeof vi.fn>;
  let mockEditorView: Partial<EditorView>;

  beforeEach(() => {
    onVideoAdd = vi.fn();
    onVideoError = vi.fn();
    capturedPlugin = null;

    mockEditorView = {
      state: {
        schema: {
          nodes: {
            video_block: {
              create: vi.fn().mockReturnValue({
                type: { name: 'video_block' },
                attrs: { src: '', mimeType: '', poster: '' },
              }),
            },
          },
        },
        tr: {
          replaceSelectionWith: vi.fn().mockReturnValue({}),
        },
      } as unknown as EditorState,
      dispatch: vi.fn(),
    };

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
  });

  it('creates a plugin with a key', () => {
    videoBlockInsertPlugin({
      onVideoAdd,
      onVideoError,
    } as VideoBlockInsertPluginOptions);

    expect(capturedPlugin).toBeInstanceOf(Plugin);
    expect(capturedPlugin?.spec.key as PluginKey).toBeDefined();
  });

  it('handlePaste returns false for invalid items', () => {
    videoBlockInsertPlugin({
      onVideoAdd,
      onVideoError,
    } as VideoBlockInsertPluginOptions);
    const handlePaste = capturedPlugin?.spec.props?.handlePaste as
      | HandlePaste
      | undefined;

    expect(
      handlePaste?.(
        mockEditorView,
        { clipboardData: null } as ClipboardEvent,
        mockSlice as Slice,
      ),
    ).toBe(false);

    expect(
      handlePaste?.(
        mockEditorView,
        {
          clipboardData: {
            items: [{ type: 'text/plain' }],
          },
        } as unknown as ClipboardEvent,
        mockSlice as Slice,
      ),
    ).toBe(false);
  });

  it('handlePaste skips null file and processes valid video', () => {
    videoBlockInsertPlugin({
      onVideoAdd,
      onVideoError,
    } as VideoBlockInsertPluginOptions);
    const handlePaste = capturedPlugin?.spec.props?.handlePaste as
      | HandlePaste
      | undefined;

    // Null file case
    let result = handlePaste?.(
      mockEditorView,
      {
        clipboardData: {
          items: [
            {
              type: 'video/mp4',
              getAsFile: () => null,
            },
          ],
        },
        preventDefault: vi.fn(),
      } as unknown as ClipboardEvent,
      mockSlice as Slice,
    );

    expect(result).toBe(true);
    expect(onVideoAdd).not.toHaveBeenCalled();

    // Valid video case
    const file = new File(['video data'], 'test.mp4', {
      type: 'video/mp4',
    });
    const event = {
      clipboardData: {
        items: [
          {
            type: 'video/mp4',
            getAsFile: () => file,
          },
        ],
      },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent;

    result = handlePaste?.(mockEditorView, event, mockSlice as Slice);

    expect(result).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onVideoAdd).toHaveBeenCalledWith(file, 'blob:test-url');
    expect(
      mockEditorView.state?.schema.nodes.video_block?.create,
    ).toHaveBeenCalledWith({
      src: 'blob:test-url',
      mimeType: 'video/mp4',
      poster: '',
    });
    expect(mockEditorView.state?.tr.replaceSelectionWith).toHaveBeenCalled();
    expect(mockEditorView.dispatch).toHaveBeenCalled();
  });

  it('handleDrop returns false for invalid items', () => {
    videoBlockInsertPlugin({
      onVideoAdd,
      onVideoError,
    } as VideoBlockInsertPluginOptions);
    const handleDrop = capturedPlugin?.spec.props?.handleDrop as
      | HandleDrop
      | undefined;

    expect(
      handleDrop?.(
        mockEditorView,
        { dataTransfer: null } as DragEvent,
        mockSlice as Slice,
        false,
      ),
    ).toBe(false);

    expect(
      handleDrop?.(
        mockEditorView,
        {
          dataTransfer: {
            items: [{ type: 'text/plain' }],
          },
        } as unknown as DragEvent,
        mockSlice as Slice,
        false,
      ),
    ).toBe(false);
  });

  it('handleDrop skips null file and processes valid video', () => {
    vi.clearAllMocks();
    onVideoAdd = vi.fn();
    onVideoError = vi.fn();

    videoBlockInsertPlugin({
      onVideoAdd,
      onVideoError,
    } as VideoBlockInsertPluginOptions);
    const handleDrop = capturedPlugin?.spec.props?.handleDrop as
      | HandleDrop
      | undefined;

    // Null file case
    let result = handleDrop?.(
      mockEditorView,
      {
        dataTransfer: {
          items: [
            {
              type: 'video/webm',
              getAsFile: () => null,
            },
          ],
        },
        preventDefault: vi.fn(),
      } as unknown as DragEvent,
      mockSlice as Slice,
      false,
    );

    expect(result).toBe(true);
    expect(onVideoAdd).not.toHaveBeenCalled();

    // Valid video case
    const file = new File(['video data'], 'test.webm', {
      type: 'video/webm',
    });
    const event = {
      dataTransfer: {
        items: [
          {
            type: 'video/webm',
            getAsFile: () => file,
          },
        ],
      },
      preventDefault: vi.fn(),
    } as unknown as DragEvent;

    result = handleDrop?.(mockEditorView, event, mockSlice as Slice, false);

    expect(result).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onVideoAdd).toHaveBeenCalledWith(file, 'blob:test-url');
  });

  it('validates video files correctly', () => {
    videoBlockInsertPlugin({
      onVideoAdd,
      onVideoError,
    } as VideoBlockInsertPluginOptions);
    const handlePaste = capturedPlugin?.spec.props?.handlePaste as
      | HandlePaste
      | undefined;

    // Invalid type
    let file = new File(['audio data'], 'test.mp3', { type: 'audio/mp3' });
    let event = {
      clipboardData: {
        items: [{ type: 'video/unsupported', getAsFile: () => file }],
      },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent;

    handlePaste?.(mockEditorView, event, mockSlice as Slice);
    expect(onVideoError).toHaveBeenCalledWith(
      expect.stringContaining('not allowed'),
    );

    onVideoError.mockClear();

    // Empty file
    file = new File([], 'test.mp4', { type: 'video/mp4' });
    event = {
      clipboardData: {
        items: [{ type: 'video/mp4', getAsFile: () => file }],
      },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent;

    handlePaste?.(mockEditorView, event, mockSlice as Slice);
    expect(onVideoError).toHaveBeenCalledWith(expect.stringContaining('empty'));

    onVideoError.mockClear();

    // Exceeding size
    const oversizeData = new Uint8Array(MAX_VIDEO_SIZE_BYTES + 1);
    file = new File([oversizeData], 'test.mp4', { type: 'video/mp4' });
    event = {
      clipboardData: {
        items: [{ type: 'video/mp4', getAsFile: () => file }],
      },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent;

    handlePaste?.(mockEditorView, event, mockSlice as Slice);
    expect(onVideoError).toHaveBeenCalledWith(
      expect.stringContaining('exceeds the maximum'),
    );

    onVideoError.mockClear();

    // handleDrop validation error (Lines 61-62 coverage)
    const handleDrop = capturedPlugin?.spec.props?.handleDrop as
      | HandleDrop
      | undefined;
    const invalidFile = new File(['audio data'], 'test.mp3', {
      type: 'audio/mp3',
    });
    const dropEvent = {
      dataTransfer: {
        items: [{ type: 'video/invalid', getAsFile: () => invalidFile }],
      },
      preventDefault: vi.fn(),
    } as unknown as DragEvent;

    handleDrop?.(mockEditorView, dropEvent, mockSlice as Slice, false);
    expect(onVideoError).toHaveBeenCalledWith(
      expect.stringContaining('not allowed'),
    );
  });

  it('returns early when nodeType does not exist', () => {
    videoBlockInsertPlugin({
      onVideoAdd,
      onVideoError,
    } as VideoBlockInsertPluginOptions);
    const handlePaste = capturedPlugin?.spec.props?.handlePaste as
      | HandlePaste
      | undefined;

    const editorViewNoNodeType: Partial<EditorView> = {
      state: {
        schema: { nodes: {} },
        tr: { replaceSelectionWith: vi.fn().mockReturnValue({}) },
      } as unknown as EditorState,
      dispatch: vi.fn(),
    };

    const file = new File(['video data'], 'test.mp4', { type: 'video/mp4' });
    const event = {
      clipboardData: {
        items: [{ type: 'video/mp4', getAsFile: () => file }],
      },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent;

    handlePaste?.(editorViewNoNodeType, event, mockSlice as Slice);

    expect(onVideoAdd).toHaveBeenCalled();
    expect(editorViewNoNodeType.dispatch).not.toHaveBeenCalled();
  });
});

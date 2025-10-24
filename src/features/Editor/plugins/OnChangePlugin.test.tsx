import { vi } from 'vitest';

import { act, render, waitFor } from '@testing-library/react';

import { OnChangePlugin } from './OnChangePlugin';

type UpdateListener = (payload: {
  editorState: {
    toJSON: () => unknown;
  };
}) => void;

const mockParseEditorState = vi.fn();
const mockSetEditorState = vi.fn();
const mockRegisterUpdateListener = vi.fn();

const mockEditor = {
  parseEditorState: mockParseEditorState,
  registerUpdateListener: mockRegisterUpdateListener,
  setEditorState: mockSetEditorState,
};

vi.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [mockEditor],
}));

const createEditorState = (state: unknown) => ({
  toJSON: () => state,
});

const serialize = (state: unknown) => JSON.stringify(state);
const initialContent = (content: string | null) => ({
  root: {
    children: [
      {
        children: [
          {
            text: content,
          },
        ],
      },
    ],
  },
});

const renderPlugin = (
  props: Partial<React.ComponentProps<typeof OnChangePlugin>> = {},
) => {
  const onChangeValue = props.onChangeValue ?? vi.fn<(value: string) => void>();

  const result = render(
    <OnChangePlugin value="" {...props} onChangeValue={onChangeValue} />,
  );

  return {
    ...result,
    onChangeValue,
  };
};

describe('[Features/Editor] OnChangePlugin', () => {
  let latestListener: UpdateListener | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    latestListener = undefined;

    mockParseEditorState.mockImplementation(value => ({ parsed: value }));
    mockRegisterUpdateListener.mockImplementation(listener => {
      latestListener = listener;
      return vi.fn();
    });
  });

  it('전달받은 에디터 상태가 비어있지 않으면 JSON 문자열을 반환해야 합니다.', async () => {
    const { onChangeValue } = renderPlugin();

    await waitFor(() => expect(latestListener).toBeDefined());
    const nonEmptyState = initialContent('hello');

    act(() => {
      latestListener?.({ editorState: createEditorState(nonEmptyState) });
    });

    expect(onChangeValue).toHaveBeenCalledTimes(1);
    expect(onChangeValue).toHaveBeenCalledWith(serialize(nonEmptyState));

    act(() => {
      latestListener?.({ editorState: createEditorState(nonEmptyState) });
    });

    expect(onChangeValue).toHaveBeenCalledTimes(1);
  });

  it('에디터 상태가 비어있으면 빈 문자열을 반환해야 합니다.', async () => {
    const { onChangeValue } = renderPlugin();

    await waitFor(() => expect(latestListener).toBeDefined());
    const nonEmptyState = initialContent('hello');

    act(() => {
      latestListener?.({ editorState: createEditorState(nonEmptyState) });
    });
    expect(onChangeValue).toHaveBeenCalledTimes(1);

    const emptyState = {
      root: {
        children: [
          {
            children: [],
          },
        ],
      },
    };

    act(() => {
      latestListener?.({ editorState: createEditorState(emptyState) });
    });

    expect(onChangeValue).toHaveBeenCalledTimes(2);
    expect(onChangeValue).toHaveBeenLastCalledWith('');
  });

  it('value prop이 변경되면 parseEditorState와 setEditorState를 호출해야 합니다.', async () => {
    const initialValue = '{"root":{}}';
    const nextValue = '{"root":{"children":[]}}';

    const { rerender, onChangeValue } = renderPlugin({ value: initialValue });
    await waitFor(() => {
      expect(mockParseEditorState).toHaveBeenCalledWith(initialValue);
    });

    expect(mockSetEditorState).toHaveBeenCalledWith({
      parsed: initialValue,
    });

    mockParseEditorState.mockClear();
    mockSetEditorState.mockClear();

    rerender(
      <OnChangePlugin value={nextValue} onChangeValue={onChangeValue} />,
    );
    await waitFor(() => {
      expect(mockParseEditorState).toHaveBeenCalledWith(nextValue);
    });

    expect(mockSetEditorState).toHaveBeenCalledWith({
      parsed: nextValue,
    });
  });

  it('동일한 content를 연속으로 전달해도 onChangeValue는 한 번만 호출되어야 합니다.', async () => {
    const { onChangeValue } = renderPlugin();

    await waitFor(() => expect(latestListener).toBeDefined());
    const state = initialContent('hello');

    act(() => {
      latestListener?.({ editorState: createEditorState(state) });
    });
    expect(onChangeValue).toHaveBeenCalledTimes(1);

    act(() => {
      latestListener?.({ editorState: createEditorState(state) });
    });
    expect(onChangeValue).toHaveBeenCalledTimes(1);
  });

  it('parseEditorState 오류 발생 시 console.error를 호출해야 합니다.', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const errorMessage = 'Parse error';

    mockParseEditorState.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    const invalidValue = 'invalid-json';
    renderPlugin({ value: invalidValue });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to parse initial data:',
        expect.any(Error),
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it('value prop이 동일한 경우 parseEditorState를 호출하지 않아야 합니다.', async () => {
    const value = '{"root":{}}';
    const { rerender, onChangeValue } = renderPlugin({ value });

    await waitFor(() => {
      expect(mockParseEditorState).toHaveBeenCalledTimes(1);
    });
    mockParseEditorState.mockClear();

    rerender(<OnChangePlugin value={value} onChangeValue={onChangeValue} />);
    await waitFor(() => {
      expect(mockParseEditorState).not.toHaveBeenCalled();
    });
  });

  it('에디터에서 변경된 값이 prop으로 돌아오면 isUpdatingRef를 false로 설정해야 합니다.', async () => {
    const mockOnChangeValue = vi.fn<(value: string) => void>();
    const initialValue = '';

    const { rerender } = render(
      <OnChangePlugin value={initialValue} onChangeValue={mockOnChangeValue} />,
    );
    await waitFor(() => expect(latestListener).toBeDefined());
    const newState = initialContent('test content');

    act(() => {
      latestListener?.({ editorState: createEditorState(newState) });
    });
    expect(mockOnChangeValue).toHaveBeenCalledTimes(1);

    const newValue = mockOnChangeValue.mock.calls[0][0];
    rerender(
      <OnChangePlugin value={newValue} onChangeValue={mockOnChangeValue} />,
    );

    act(() => {
      latestListener?.({ editorState: createEditorState(newState) });
    });
    expect(mockOnChangeValue).toHaveBeenCalledTimes(1);
  });

  it('invalid 상태는 빈 문자열을 반환해야 합니다.', async () => {
    const { onChangeValue } = renderPlugin();
    await waitFor(() => expect(latestListener).toBeDefined());

    const nonEmptyState = initialContent('initial');
    act(() => {
      latestListener?.({ editorState: createEditorState(nonEmptyState) });
    });

    expect(onChangeValue).toHaveBeenCalledTimes(1);

    const invalidStates = [
      {
        root: {
          children: null,
        },
      },
      {
        root: {
          children: ['invalid'],
        },
      },
      {
        root: {
          children: [{ children: [] }],
        },
      },
      {
        root: {
          children: [
            { children: null },
            { children: 'invalid' },
            { type: 'paragraph' },
          ],
        },
      },
    ];

    for (const invalidState of invalidStates) {
      act(() => {
        latestListener?.({
          editorState: createEditorState(invalidState),
        });
      });
    }

    expect(onChangeValue).toHaveBeenCalledTimes(2);
    expect(onChangeValue).toHaveBeenLastCalledWith('');
  });
});

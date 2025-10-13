import { vi } from 'vitest';

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import * as LexicalNS from 'lexical';
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  KEY_TAB_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';

import { EditorShell } from '../EditorShell';

vi.mock('lexical', async importOriginal => {
  const actual = await importOriginal<typeof import('lexical')>();

  return {
    ...actual,
    __orig: {
      $getSelection: actual.$getSelection,
      $isRangeSelection: actual.$isRangeSelection,
    },
    $getSelection: vi.fn(actual.$getSelection),
    $isRangeSelection: vi.fn(actual.$isRangeSelection),
  };
});

describe('[Features/Editor] ToolbarPlugin', () => {
  it('ToolbarPlugin의 요소들이 렌더링되어야 합니다.', () => {
    render(<EditorShell />);
    const toolbar = screen.getByTestId('toolbar');
    const buttons = toolbar.querySelectorAll('button');
    const dividers = toolbar.querySelectorAll('hr');

    expect(toolbar).toBeInTheDocument();
    expect(toolbar.tagName.toLowerCase()).toBe('div');
    expect(toolbar).toHaveRole('toolbar');

    expect(buttons).toHaveLength(11);
    expect(dividers).toHaveLength(2);
  });

  it('혼합 정렬 상태에서는 정렬 버튼이 모두 활성화되지 않아야 합니다.', async () => {
    render(<EditorShell />);
    const editable = screen.getByRole('textbox');

    await waitFor(() => expect(editable.__lexicalEditor).toBeTruthy());
    const editor = editable.__lexicalEditor;

    await act(async () => {
      editor?.update(() => {
        const root = $getRoot();
        root.clear();

        const paragraph1 = $createParagraphNode();
        const text1 = $createTextNode('A');
        paragraph1.append(text1);

        const paragraph2 = $createParagraphNode();
        const text2 = $createTextNode('B');
        paragraph2.append(text2);

        root.append(paragraph1, paragraph2);

        const selection = $createRangeSelection();
        selection.anchor.set(text1.getKey(), 0, 'text');
        selection.focus.set(text1.getKey(), 1, 'text');
        $setSelection(selection);
      });
    });

    act(() => {
      editor?.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center');
    });

    await act(async () => {
      editor?.update(() => {
        const root = $getRoot();
        const [paragraph1, p2] = root.getChildren();
        const firstTextFromParagraph1 = (
          paragraph1 as ReturnType<typeof $createParagraphNode>
        ).getChildren()[0];
        const firstTextFromParagraph2 = (
          p2 as ReturnType<typeof $createParagraphNode>
        ).getChildren()[0];

        const selection = $createRangeSelection();
        selection.anchor.set(firstTextFromParagraph1.getKey(), 0, 'text');
        selection.focus.set(firstTextFromParagraph2.getKey(), 1, 'text');
        $setSelection(selection);
      });
    });

    act(() => {
      editor?.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);
    });

    const toolbar = screen.getByRole('toolbar');
    const buttons = Array.from(toolbar.querySelectorAll('button'));
    const alignButtons = buttons.slice(-4);

    alignButtons.forEach(button => {
      expect(button.classList.contains('active')).toBe(false);
    });
  });

  it('Undo/Redo 활성화 시 Toolbar의 모든 버튼이 클릭 가능해야 합니다.', async () => {
    render(<EditorShell />);
    const editable = screen.getByRole('textbox');

    await waitFor(() => expect(editable.__lexicalEditor).toBeTruthy());
    const editor = editable.__lexicalEditor;

    const toolbar = screen.getByRole('toolbar');
    const buttons = Array.from(toolbar.querySelectorAll('button'));

    await act(async () => {
      editor?.update(() => {
        const root = $getRoot();
        root.clear();

        const paragraph = $createParagraphNode();
        const text = $createTextNode('hello');
        paragraph.append(text);
        root.append(paragraph);

        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), 0, 'text');
        selection.focus.set(text.getKey(), 5, 'text');
        $setSelection(selection);
      });
    });

    act(() => {
      editor?.dispatchCommand(CAN_UNDO_COMMAND, true);
      editor?.dispatchCommand(CAN_REDO_COMMAND, true);
    });

    for (const button of buttons) {
      expect(button).not.toBeDisabled();
      await userEvent.click(button);
    }

    const activeButtons = [...buttons.slice(2, 7), buttons[10]];
    activeButtons.forEach(button => {
      expect(button).toHaveClass('active');
    });

    expect(buttons).toHaveLength(11);
  });

  it('빈 에디터에서 정렬 버튼을 클릭하면 onChangeAlignment 콜백함수가 실행되어야 합니다.', async () => {
    render(<EditorShell />);
    const editable = screen.getByRole('textbox');

    await waitFor(() => expect(editable.__lexicalEditor).toBeTruthy());
    const editor = editable.__lexicalEditor;

    await act(async () => {
      editor?.update(() => {
        const root = $getRoot();
        root.clear();
      });
    });

    const toolbar = screen.getByRole('toolbar');
    const buttons = within(toolbar).getAllByRole('button');
    const alignLeftButton = buttons[7];

    await userEvent.click(alignLeftButton);
    await waitFor(() => {
      expect(alignLeftButton).toHaveClass('active');
    });
  });

  it('요소를 선택중일 때와 아닐 때를 적절하게 대응해야 합니다.', async () => {
    render(<EditorShell />);
    const editable = screen.getByRole('textbox');

    await waitFor(() => expect(editable.__lexicalEditor).toBeTruthy());
    const editor = editable.__lexicalEditor;

    await act(async () => {
      editor?.update(() => {
        const root = $getRoot();
        root.clear();

        const paragraph = $createParagraphNode();
        const text = $createTextNode('hello');
        paragraph.append(text);
        root.append(paragraph);

        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), 0, 'text');
        selection.focus.set(text.getKey(), 5, 'text');
        $setSelection(selection);
      });
    });

    act(() => {
      editor?.dispatchCommand(KEY_TAB_COMMAND, {
        preventDefault: () => {},
        shiftKey: false,
      } as KeyboardEvent);
      editor?.dispatchCommand(KEY_TAB_COMMAND, {
        preventDefault: () => {},
        shiftKey: true,
      } as KeyboardEvent);
    });

    await act(async () => {
      editor?.update(() => {
        $setSelection(null);
      });
    });

    const selection = $createRangeSelection();
    const insertSpy = vi.spyOn(selection, 'insertText');

    const selSpy = vi
      .spyOn(LexicalNS, '$getSelection')
      .mockReturnValue(selection);
    const isRangeSpy = vi
      .spyOn(LexicalNS, '$isRangeSelection')
      .mockReturnValueOnce(false)
      .mockReturnValue(true);

    act(() => {
      editor?.dispatchCommand(KEY_TAB_COMMAND, {
        preventDefault: () => {},
        shiftKey: false,
      } as KeyboardEvent);
    });

    expect(insertSpy).toHaveBeenCalledWith('\t');

    selSpy.mockRestore();
    isRangeSpy.mockRestore();
  });

  it('getFormatType 함수가 빈 문자열을 반환할 때 left로 처리되어야 합니다.', async () => {
    render(<EditorShell />);
    const editable = screen.getByRole('textbox');

    await waitFor(() => expect(editable.__lexicalEditor).toBeTruthy());
    const editor = editable.__lexicalEditor;

    await act(async () => {
      editor?.update(() => {
        const root = $getRoot();
        root.clear();

        const paragraph = $createParagraphNode();
        const text = $createTextNode('test');
        paragraph.append(text);
        root.append(paragraph);

        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), 0, 'text');
        selection.focus.set(text.getKey(), 4, 'text');
        $setSelection(selection);
      });
    });

    act(() => {
      editor?.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);
    });

    const toolbar = screen.getByRole('toolbar');
    const buttons = within(toolbar).getAllByRole('button');
    const alignLeftButton = buttons[7];

    await waitFor(() => {
      expect(alignLeftButton).toHaveClass('active');
    });
  });

  it('텍스트 포맷 상태가 false인 경로를 커버해야 합니다.', async () => {
    render(<EditorShell />);
    const editable = screen.getByRole('textbox');

    await waitFor(() => expect(editable.__lexicalEditor).toBeTruthy());
    const editor = editable.__lexicalEditor;

    await act(async () => {
      editor?.update(() => {
        const root = $getRoot();
        root.clear();

        const paragraph = $createParagraphNode();
        const text = $createTextNode('test');
        paragraph.append(text);
        root.append(paragraph);

        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), 0, 'text');
        selection.focus.set(text.getKey(), 4, 'text');
        $setSelection(selection);
      });
    });

    await act(async () => {
      editor?.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);
    });

    const toolbar = screen.getByRole('toolbar');
    const buttons = within(toolbar).getAllByRole('button');
    const italicButton = buttons[3];
    const strikeButton = buttons[5];

    await waitFor(() => {
      expect(italicButton).not.toHaveClass('active');
      expect(strikeButton).not.toHaveClass('active');
    });
  });

  it('텍스트 포맷 상태가 true인 경로를 커버해야 합니다.', async () => {
    render(<EditorShell />);
    const editable = screen.getByRole('textbox');

    await waitFor(() => expect(editable.__lexicalEditor).toBeTruthy());
    const editor = editable.__lexicalEditor;

    await act(async () => {
      editor?.update(() => {
        const root = $getRoot();
        root.clear();

        const paragraph = $createParagraphNode();
        const text = $createTextNode('test');
        paragraph.append(text);
        root.append(paragraph);

        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), 0, 'text');
        selection.focus.set(text.getKey(), 4, 'text');
        $setSelection(selection);
      });
    });

    const toolbar = screen.getByRole('toolbar');
    const buttons = within(toolbar).getAllByRole('button');
    const italicButton = buttons[3];
    const strikeButton = buttons[5];

    await userEvent.click(italicButton);
    await waitFor(() => {
      expect(italicButton).toHaveClass('active');
    });

    await userEvent.click(strikeButton);
    await waitFor(() => {
      expect(strikeButton).toHaveClass('active');
    });

    editor?.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        expect(selection.hasFormat('italic')).toBe(true);
        expect(selection.hasFormat('strikethrough')).toBe(true);
      }
    });
  });

  it('RangeSelection이 아닌 상태에서 update 내부가 false인 경로를 커버해야 합니다.', async () => {
    render(<EditorShell />);
    const editable = screen.getByRole('textbox');

    await waitFor(() => expect(editable.__lexicalEditor).toBeTruthy());
    const editor = editable.__lexicalEditor;

    await act(async () => {
      editor?.update(() => {
        const root = $getRoot();
        root.clear();

        const paragraph = $createParagraphNode();
        const text = $createTextNode('test');
        paragraph.append(text);
        root.append(paragraph);
      });
    });

    await act(async () => {
      editor?.update(() => {
        $setSelection(null);
      });
    });

    const getSelSpy = vi
      .spyOn(LexicalNS, '$getSelection')
      .mockReturnValue(null);
    const isRangeSpy = vi
      .spyOn(LexicalNS, '$isRangeSelection')
      .mockReturnValue(false);

    act(() => {
      editor?.dispatchCommand(KEY_TAB_COMMAND, {
        preventDefault: () => {},
        shiftKey: false,
      } as KeyboardEvent);
    });

    await waitFor(() => {
      expect(isRangeSpy).toHaveBeenCalled();
    });

    getSelSpy.mockRestore();
    isRangeSpy.mockRestore();
  });

  it('FORMAT_ELEMENT_COMMAND에서 start와 end payload는 false를 반환해야 합니다.', async () => {
    render(<EditorShell />);
    const editable = screen.getByRole('textbox');

    await waitFor(() => expect(editable.__lexicalEditor).toBeTruthy());
    const editor = editable.__lexicalEditor;

    act(() => {
      editor?.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'start');
    });

    act(() => {
      editor?.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'end');
    });

    const toolbar = screen.getByRole('toolbar');
    const buttons = within(toolbar).getAllByRole('button');
    const alignLeftButton = buttons[7];

    await waitFor(() => {
      expect(alignLeftButton).toHaveClass('active');
    });
  });

  it('FORMAT_ELEMENT_COMMAND에서 빈 문자열 payload는 left로 처리되어야 합니다.', async () => {
    render(<EditorShell />);
    const editable = screen.getByRole('textbox');

    await waitFor(() => expect(editable.__lexicalEditor).toBeTruthy());
    const editor = editable.__lexicalEditor;

    await act(async () => {
      editor?.update(() => {
        const root = $getRoot();
        root.clear();
      });
    });

    act(() => {
      editor?.dispatchCommand(FORMAT_ELEMENT_COMMAND, '');
    });

    const toolbar = screen.getByRole('toolbar');
    const buttons = within(toolbar).getAllByRole('button');
    const alignLeftButton = buttons[7];

    await waitFor(() => {
      expect(alignLeftButton).toHaveClass('active');
    });
  });
});

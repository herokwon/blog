import { vi } from 'vitest';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { LexicalEditor } from 'lexical';

import { EditorShell } from './EditorShell';

declare global {
  interface HTMLElement {
    __lexicalEditor?: LexicalEditor;
  }
}

const onChangeValue = vi.fn();

describe('[Features/Editor] EditorShell', () => {
  it('Props 기본값으로 렌더링해야 합니다.', () => {
    render(<EditorShell value="" onChangeValue={onChangeValue} />);
    const editorShell = screen.getByTestId('editor-shell');
    const editorInner = screen.getByTestId('editor-inner');
    const editable = screen.getByRole('textbox');

    expect(editorShell).toBeInTheDocument();
    expect(editorShell.tagName.toLowerCase()).toBe('div');

    expect(editorInner).toBeInTheDocument();
    expect(editorInner.tagName.toLowerCase()).toBe('div');
    expect(editorInner).toHaveTextContent('텍스트를 입력해 주세요.');

    expect(editable).toBeInTheDocument();
    expect(editable.tagName.toLowerCase()).toBe('div');
  });

  it('placeholder가 전달된 경우, 해당 값을 반영해야 합니다.', () => {
    const customPlaceholder = 'test-placeholder';
    render(
      <EditorShell
        value=""
        placeholder={customPlaceholder}
        onChangeValue={onChangeValue}
      />,
    );
    const editorInner = screen.getByTestId('editor-inner');
    const editable = screen.getByTestId('editor-content');

    expect(editorInner).toHaveTextContent(customPlaceholder);
    expect(editable).toHaveAttribute('aria-placeholder', customPlaceholder);
  });

  it('className를 비롯한 div 요소의 props가 전달된 경우, 해당 속성들을 반영해야 합니다.', () => {
    const customProps = {
      id: 'custom-id',
      className: 'custom-class',
      role: 'region',
    } satisfies React.ComponentPropsWithoutRef<'div'>;
    render(
      <EditorShell {...customProps} value="" onChangeValue={onChangeValue} />,
    );
    const editorShell = screen.getByTestId('editor-shell');

    expect(editorShell).toHaveAttribute('id', customProps.id);
    expect(editorShell).toHaveClass(customProps.className);
    expect(editorShell).toHaveRole(customProps.role);
  });

  it('ToolbarPlugin의 onChangeAlignment 콜백함수가 호출되면 alignment 상태가 변경되어야 합니다.', async () => {
    render(<EditorShell value="" onChangeValue={onChangeValue} />);
    const toolbar = screen.getByRole('toolbar');
    const placeholder = screen.getByTestId('editor-placeholder');
    const alignmentButtons = Array.from(
      toolbar.querySelectorAll('button'),
    ).slice(-4);

    await userEvent.click(alignmentButtons[1]);
    expect(placeholder).toHaveClass('left-1/2 -translate-x-1/2');

    await userEvent.click(alignmentButtons[2]);
    expect(placeholder).toHaveClass('right-0');

    await userEvent.click(alignmentButtons[3]);
    expect(placeholder).toHaveClass('left-0');

    await userEvent.click(alignmentButtons[0]);
    expect(placeholder).toHaveClass('left-0');
  });

  it('오류가 발생한 경우, 에러를 throw 합니다.', async () => {
    render(<EditorShell value="" onChangeValue={onChangeValue} />);
    const editable = screen.getByRole('textbox');
    const editor = editable.__lexicalEditor;

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      expect(() => {
        act(() => {
          editor?.update(() => {
            throw new Error('Test Error');
          });
        });
      }).toThrow('Test Error');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

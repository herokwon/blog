import { render, screen } from '@testing-library/react';

import { PostContent } from './PostContent';

const validEditorState = JSON.stringify({
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Hello, World!',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
});

describe('[Features/Post] PostContent', () => {
  it('유효한 에디터 상태를 전달하면 읽기 전용 뷰어로 렌더링되어야 합니다.', () => {
    const { container } = render(<PostContent content={validEditorState} />);
    const viewer = screen.getByTestId('viewer-content');
    const editorContainer = container.querySelector('[data-lexical-editor]');

    expect(viewer).toBeInTheDocument();
    expect(viewer).toHaveTextContent('Hello, World!');
    expect(viewer).toHaveAttribute('contenteditable', 'false');
    expect(viewer).toHaveAttribute('role', 'textbox');
    expect(viewer).toHaveAttribute('readonly');
    expect(viewer).toHaveClass('outline-none');

    expect(editorContainer).toBeInTheDocument();
  });

  it('유효하지 않은 에디터 상태를 전달하면 빈 에디터로 렌더링되어야 합니다.', () => {
    render(<PostContent content="invalid-json" />);
    const viewer = screen.getByTestId('viewer-content');

    expect(viewer).toBeInTheDocument();
    expect(viewer).toBeEmptyDOMElement();
  });
});

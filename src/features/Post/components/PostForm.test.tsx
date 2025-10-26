import { vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PostRequest } from '../types';
import { PostForm } from './PostForm';

type MockOnSubmit = React.ComponentProps<typeof PostForm>['onSubmit'];
type MockOnChangeData = NonNullable<
  React.ComponentProps<typeof PostForm>['onChangeData']
>;

const mockOnSubmit = vi.fn<MockOnSubmit>();
const mockOnChangeData = vi.fn<MockOnChangeData>();

vi.mock('@/features/Editor', () => ({
  __esModule: true,
  EditorShell: ({
    value,
    onChangeValue,
    className,
  }: {
    value: string;
    onChangeValue: (content: string) => void;
    className?: string;
  }) => (
    <div data-testid="editor-shell" className={className}>
      <textarea
        data-testid="editor-content"
        value={value}
        onChange={e => onChangeValue((e.target as HTMLTextAreaElement).value)}
      />
      <button
        type="button"
        data-testid="editor-apply"
        onClick={() => onChangeValue('MOCKED_CONTENT')}
      >
        apply
      </button>
    </div>
  ),
}));

describe('[Features/Post] PostForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('기본 UI 렌더링', () => {
    render(<PostForm onSubmit={mockOnSubmit} />);
    const form = screen.getByRole('form');
    const titleInput = screen.getByPlaceholderText('제목');
    const editorShell = screen.getByTestId('editor-shell');

    expect(form).toBeInTheDocument();
    expect(titleInput).toBeInTheDocument();
    expect(editorShell).toBeInTheDocument();
  });

  it('제목 변경 시 onChangeData 호출', async () => {
    render(
      <PostForm onSubmit={mockOnSubmit} onChangeData={mockOnChangeData} />,
    );
    const titleInput = screen.getByPlaceholderText('제목');

    await userEvent.type(titleInput, 'Title');
    await waitFor(() =>
      expect(mockOnChangeData).toHaveBeenCalledWith({
        title: 'Title',
        content: '',
      }),
    );
  });

  it('내용 변경 시 onChangeData 호출', async () => {
    render(
      <PostForm onSubmit={mockOnSubmit} onChangeData={mockOnChangeData} />,
    );
    const editorContent = screen.getByTestId('editor-content');

    await userEvent.type(editorContent, 'Content');
    await waitFor(() =>
      expect(mockOnChangeData).toHaveBeenCalledWith({
        title: '',
        content: 'Content',
      }),
    );
  });

  it('submit 시 onSubmit 호출', async () => {
    const data: PostRequest = { title: 'S1', content: 'BC' };
    mockOnSubmit.mockResolvedValue({
      id: '1',
      created_at: '',
      updated_at: '',
      ...data,
    });
    render(
      <PostForm initialData={data} onSubmit={mockOnSubmit}>
        <button type="submit">Send</button>
      </PostForm>,
    );
    const submitButton = screen.getByRole('button', { name: 'Send' });

    await userEvent.click(submitButton);
    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledWith(data));
  });
});

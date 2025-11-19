import { vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { UpdatePostForm } from './UpdatePostForm';

const mockUpdate = vi.fn();

vi.mock('../hooks', () => ({
  useUpdatePost: () => ({
    update: mockUpdate,
    isLoading: false,
    error: '',
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/features/Editor', () => ({
  __esModule: true,
  EditorShell: () => <div data-testid="editor-shell" />,
}));

describe('[Features/Post] UpdatePostForm', () => {
  it('초기 데이터와 함께 PostForm과 UpdateButton을 렌더링해야 합니다', () => {
    render(<UpdatePostForm id="1" title="Test Title" content="Test Content" />);

    expect(screen.getByPlaceholderText('제목')).toHaveValue('Test Title');
    expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument();
  });
});

import { vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PostHeader } from './PostHeader';

const mockPush = vi.fn();
const mockRemovePost = vi.fn();
const mockConfirm = vi.fn();
const mockAlert = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('../api', () => ({
  removePost: (id: string) => mockRemovePost(id),
}));

describe('[Features/Post] PostHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.confirm = mockConfirm;
    global.alert = mockAlert;
  });

  it('기본 정보를 렌더링하고 날짜 조건에 따라 수정일을 표시해야 합니다', () => {
    const { rerender } = render(
      <PostHeader
        id="1"
        title="Test Post"
        created_at="2024-01-01"
        updated_at="2024-01-01"
        isAdmin={false}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Test Post' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/수정됨/)).not.toBeInTheDocument();

    rerender(
      <PostHeader
        id="1"
        title="Test Post"
        created_at="2024-01-01"
        updated_at="2024-01-02"
        isAdmin={false}
      />,
    );

    expect(screen.getByText('(2024. 1. 2. 수정됨)')).toBeInTheDocument();
  });

  it('isAdmin에 따라 버튼을 표시하고 수정/삭제 동작을 수행해야 합니다', async () => {
    const { rerender } = render(
      <PostHeader
        id="1"
        title="Test"
        created_at="2024-01-01"
        updated_at="2024-01-01"
        isAdmin={false}
      />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <PostHeader
        id="1"
        title="Test"
        created_at="2024-01-01"
        updated_at="2024-01-01"
        isAdmin={true}
      />,
    );

    const updateButton = screen.getByRole('button', { name: '수정' });
    await userEvent.click(updateButton);
    expect(mockPush).toHaveBeenCalledWith('/posts/1/edit');

    mockConfirm.mockReturnValue(false);
    const removeButton = screen.getByRole('button', { name: '삭제' });
    await userEvent.click(removeButton);
    expect(mockRemovePost).not.toHaveBeenCalled();

    mockConfirm.mockReturnValue(true);
    mockRemovePost.mockResolvedValue({ success: true, error: null });
    await userEvent.click(removeButton);
    expect(mockRemovePost).toHaveBeenCalledWith('1');
    expect(mockPush).toHaveBeenCalledWith('/posts');
  });

  it('삭제 실패 시 에러 메시지를 표시해야 합니다', async () => {
    mockConfirm.mockReturnValue(true);
    mockRemovePost.mockResolvedValue({ success: false, error: '권한 없음' });

    render(
      <PostHeader
        id="1"
        title="Test"
        created_at="2024-01-01"
        updated_at="2024-01-01"
        isAdmin={true}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '삭제' }));

    expect(mockAlert).toHaveBeenCalledWith(
      '게시글 삭제에 실패했습니다: 권한 없음',
    );
    expect(mockPush).not.toHaveBeenCalledWith('/posts');
  });
});

import { ErrorBoundary } from 'next/dist/client/components/error-boundary';

import { vi } from 'vitest';

import { render } from '@testing-library/react';

vi.mock('react', () => ({
  use: vi.fn(v => v),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));

const mockedIsError = vi.fn(result => (result.error ? true : false));
vi.mock('../types', () => ({
  isError: mockedIsError,
}));

const mockedGetPosts = vi.fn();
const mockedGetPost = vi.fn();
vi.mock('../api', () => ({
  getPosts: mockedGetPosts,
  getPost: mockedGetPost,
}));

const { PostList } = await import('./PostList');

describe('[Features/Post] PostList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('게시글 불러오기 성공 시, 게시글 목록을 렌더링해야 합니다.', async () => {
    const { getPosts } = await import('../api');

    mockedGetPosts.mockReturnValue({
      data: ['1', '2'],
      error: null,
    });
    mockedGetPost.mockImplementation((id: string) => ({
      data: {
        id,
        title: `제목 ${id}`,
        content: `내용 ${id}`,
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      },
      error: null,
    }));

    render(<PostList postsPromise={getPosts()} />);

    expect(mockedGetPosts).toHaveBeenCalled();

    expect(mockedGetPost).toHaveBeenCalledWith('1');
    expect(mockedGetPost).toHaveBeenCalledWith('2');

    expect(mockedIsError).toHaveReturnedWith(false);
  });

  it('게시글 목록 불러오기 실패 시, 오류 객체를 던져야 합니다.', async () => {
    const { getPosts } = await import('../api');

    mockedGetPosts.mockReturnValue({
      data: null,
      error: 'Failed to fetch posts',
    });

    render(
      <ErrorBoundary errorComponent={({ error }) => <div>{error.message}</div>}>
        <PostList postsPromise={getPosts()} />
      </ErrorBoundary>,
    );

    expect(mockedGetPosts).toHaveBeenCalled();

    expect(mockedGetPost).not.toHaveBeenCalled();

    expect(mockedIsError).toHaveBeenCalled();
    expect(mockedIsError).toHaveReturnedWith(true);
  });

  it('개별 게시글 불러오기 실패 시, 오류 객체를 던져야 합니다.', async () => {
    const { getPosts } = await import('../api');

    mockedGetPosts.mockReturnValue({
      data: ['1'],
      error: null,
    });
    mockedGetPost.mockReturnValue({
      data: null,
      error: 'Failed to fetch post',
    });

    render(
      <ErrorBoundary errorComponent={({ error }) => <div>{error.message}</div>}>
        <PostList postsPromise={getPosts()} />
      </ErrorBoundary>,
    );

    expect(mockedGetPosts).toHaveBeenCalled();

    expect(mockedGetPost).toHaveBeenCalled();
    expect(mockedGetPost).toHaveBeenCalledWith('1');

    expect(mockedIsError).toHaveBeenCalled();
    expect(mockedIsError).toHaveReturnedWith(true);
  });
});

import { vi } from 'vitest';

import { render, screen } from '@testing-library/react';

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

const validEditorState = (...args: string[]) =>
  JSON.stringify({
    root: {
      children: [
        {
          children: args.map(text => ({
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text,
            type: 'text',
            version: 1,
          })),
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

describe('[Features/Post] PostList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('게시글 목록을 렌더링해야 합니다.', () => {
    const posts = [
      {
        id: '1',
        title: '제목 1',
        content: validEditorState('짧은 내용'),
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      },
      {
        id: '2',
        title: '제목 2',
        content: validEditorState('두 번째 게시글'),
        created_at: '2025-01-02',
        updated_at: '2025-01-02',
      },
    ];

    render(<PostList posts={posts} />);
    const list = screen.getByTestId('post-list');
    const items = list.querySelectorAll('article');

    expect(list).toBeInTheDocument();
    expect(items).toHaveLength(2);
  });

  it('200자 이상의 콘텐츠는 잘려서 표시되어야 합니다.', () => {
    const texts = ['A'.repeat(100), 'B'.repeat(100), 'C'.repeat(100)];
    const posts = [
      {
        id: '1',
        title: '긴 콘텐츠',
        content: validEditorState(...texts),
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      },
    ];

    const { container } = render(<PostList posts={posts} />);
    const preview = container.querySelector('p');

    expect(preview).toBeInTheDocument();

    expect(preview?.textContent.length).toBeGreaterThanOrEqual(200);
    expect(preview?.textContent).not.toContain('C');
  });

  it('200자 이하의 콘텐츠는 전체가 표시되어야 합니다.', () => {
    const shortText = '짧은 내용입니다.';
    const posts = [
      {
        id: '1',
        title: '짧은 콘텐츠',
        content: validEditorState(shortText),
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      },
    ];

    const { container } = render(<PostList posts={posts} />);
    const preview = container.querySelector('p');

    expect(preview).toBeInTheDocument();
    expect(preview?.textContent).toBe(shortText);
  });

  it('유효하지 않은 콘텐츠는 빈 문자열로 표시되어야 합니다.', () => {
    const posts = [
      {
        id: '1',
        title: '잘못된 콘텐츠',
        content: 'invalid-json',
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      },
    ];

    const { container } = render(<PostList posts={posts} />);
    const preview = container.querySelector('p');

    expect(preview).toBeInTheDocument();
    expect(preview?.textContent.length).toBe(0);
  });
});

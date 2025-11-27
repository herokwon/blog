import { vi } from 'vitest';

import { act, renderHook } from '@testing-library/react';

import type { PostRequest } from '../types';

const { pushMock, createPostMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  createPostMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('../api/createPost', () => ({
  createPost: createPostMock,
}));

const { useCreatePost } = await import('./useCreatePost');

describe('[Features/Post] useCreatePost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('초기 상태가 올바르게 설정되어야 합니다.', () => {
    const { result } = renderHook(() => useCreatePost());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.create).toBe('function');
  });

  it('게시글 생성 성공 시, 데이터를 반환하고 페이지를 이동해야 합니다.', async () => {
    const request: PostRequest = { title: 'title', content: 'content' };
    const mockPost = {
      id: '1',
      title: 'title',
      content: 'content',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    createPostMock.mockResolvedValue({ data: mockPost, error: null });

    const { result } = renderHook(() => useCreatePost());

    let returnedPost;
    await act(async () => {
      returnedPost = await result.current.create(request);
    });

    expect(createPostMock).toHaveBeenCalledWith(request);
    expect(returnedPost).toEqual(mockPost);
    expect(pushMock).toHaveBeenCalledWith('/posts/1');
    expect(result.current.error).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('게시글 생성 실패 시, 오류를 설정하고 null을 반환해야 합니다.', async () => {
    const request: PostRequest = { title: 'title', content: 'content' };
    createPostMock.mockResolvedValue({
      data: null,
      error: '게시글 생성에 실패했습니다.',
    });

    const { result } = renderHook(() => useCreatePost());

    let returnedPost;
    await act(async () => {
      returnedPost = await result.current.create(request);
    });

    expect(createPostMock).toHaveBeenCalledWith(request);
    expect(returnedPost).toBeNull();
    expect(result.current.error).toBe('게시글 생성에 실패했습니다.');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('연속 호출 시, 이전 타임아웃이 정리되어야 합니다.', async () => {
    const request: PostRequest = { title: 'title', content: 'content' };
    const mockPost = {
      id: '1',
      title: 'title',
      content: 'content',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    createPostMock.mockResolvedValue({ data: mockPost, error: null });

    const { result } = renderHook(() => useCreatePost());

    await act(async () => {
      await result.current.create(request);
    });

    await act(async () => {
      await result.current.create(request);
    });

    expect(createPostMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('언마운트 시, 타임아웃이 정리되어야 합니다.', async () => {
    const request: PostRequest = { title: 'title', content: 'content' };
    const mockPost = {
      id: '1',
      title: 'title',
      content: 'content',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    createPostMock.mockResolvedValue({ data: mockPost, error: null });

    const { result, unmount } = renderHook(() => useCreatePost());

    await act(async () => {
      await result.current.create(request);
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(200);
    });
  });
});

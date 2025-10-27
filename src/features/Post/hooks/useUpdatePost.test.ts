import { vi } from 'vitest';

import { act, renderHook } from '@testing-library/react';

import type { PostRequest } from '../types';

const { pushMock, updatePostMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  updatePostMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('../api/updatePost', () => ({
  updatePost: updatePostMock,
}));

const { useUpdatePost } = await import('./useUpdatePost');

describe('[Features/Post] useUpdatePost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('초기 상태가 올바르게 설정되어야 합니다.', () => {
    const { result } = renderHook(() => useUpdatePost('1'));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('');
    expect(typeof result.current.update).toBe('function');
  });

  it('게시글 수정 성공 시, 데이터를 반환하고 페이지를 이동해야 합니다.', async () => {
    const request: PostRequest = {
      title: 'updated',
      content: 'updated content',
    };
    const mockPost = {
      id: '1',
      title: 'updated',
      content: 'updated content',
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    };

    updatePostMock.mockResolvedValue({ data: mockPost, error: null });

    const { result } = renderHook(() => useUpdatePost('1'));

    let returnedPost;
    await act(async () => {
      returnedPost = await result.current.update(request);
    });

    expect(updatePostMock).toHaveBeenCalledWith({ id: '1', ...request });
    expect(returnedPost).toEqual(mockPost);
    expect(pushMock).toHaveBeenCalledWith('/posts/1');
    expect(result.current.error).toBe('');

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('게시글 수정 실패 시, 오류를 설정하고 null을 반환해야 합니다.', async () => {
    const request: PostRequest = {
      title: 'updated',
      content: 'updated content',
    };
    updatePostMock.mockResolvedValue({
      data: null,
      error: '게시글 수정에 실패했습니다.',
    });

    const { result } = renderHook(() => useUpdatePost('1'));

    let returnedPost;
    await act(async () => {
      returnedPost = await result.current.update(request);
    });

    expect(updatePostMock).toHaveBeenCalledWith({ id: '1', ...request });
    expect(returnedPost).toBeNull();
    expect(result.current.error).toBe('게시글 수정에 실패했습니다.');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('연속 호출 시, 이전 타임아웃이 정리되어야 합니다.', async () => {
    const request: PostRequest = {
      title: 'updated',
      content: 'updated content',
    };
    const mockPost = {
      id: '1',
      title: 'updated',
      content: 'updated content',
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    };

    updatePostMock.mockResolvedValue({ data: mockPost, error: null });

    const { result } = renderHook(() => useUpdatePost('1'));

    await act(async () => {
      await result.current.update(request);
    });

    await act(async () => {
      await result.current.update(request);
    });

    expect(updatePostMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('언마운트 시, 타임아웃이 정리되어야 합니다.', async () => {
    const request: PostRequest = {
      title: 'updated',
      content: 'updated content',
    };
    const mockPost = {
      id: '1',
      title: 'updated',
      content: 'updated content',
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    };

    updatePostMock.mockResolvedValue({ data: mockPost, error: null });

    const { result, unmount } = renderHook(() => useUpdatePost('1'));

    await act(async () => {
      await result.current.update(request);
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(200);
    });
  });
});

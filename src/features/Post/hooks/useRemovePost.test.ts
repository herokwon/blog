import { vi } from 'vitest';

import { act, renderHook } from '@testing-library/react';

const { pushMock, removePostMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  removePostMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('../api/removePost', () => ({
  removePost: removePostMock,
}));

const { useRemovePost } = await import('./useRemovePost');

describe('[Features/Post] useRemovePost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('초기 상태가 올바르게 설정되어야 합니다.', () => {
    const { result } = renderHook(() => useRemovePost());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('');
    expect(typeof result.current.remove).toBe('function');
  });

  it('게시글 삭제 성공 시, true를 반환하고 목록 페이지로 이동해야 합니다.', async () => {
    removePostMock.mockResolvedValue({ success: true, error: null });

    const { result } = renderHook(() => useRemovePost());

    let returnedResult;
    await act(async () => {
      returnedResult = await result.current.remove('1');
    });

    expect(removePostMock).toHaveBeenCalledWith('1');
    expect(returnedResult).toBe(true);
    expect(pushMock).toHaveBeenCalledWith('/posts');
    expect(result.current.error).toBe('');

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('게시글 삭제 실패 시, 오류를 설정하고 false를 반환해야 합니다.', async () => {
    removePostMock.mockResolvedValue({
      success: false,
      error: '게시글 삭제에 실패했습니다.',
    });

    const { result } = renderHook(() => useRemovePost());

    let returnedResult;
    await act(async () => {
      returnedResult = await result.current.remove('1');
    });

    expect(removePostMock).toHaveBeenCalledWith('1');
    expect(returnedResult).toBe(false);
    expect(result.current.error).toBe('게시글 삭제에 실패했습니다.');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('연속 호출 시, 이전 타임아웃이 정리되어야 합니다.', async () => {
    removePostMock.mockResolvedValue({ success: true, error: null });

    const { result } = renderHook(() => useRemovePost());

    await act(async () => {
      await result.current.remove('1');
    });

    await act(async () => {
      await result.current.remove('2');
    });

    expect(removePostMock).toHaveBeenCalledTimes(2);
    expect(removePostMock).toHaveBeenNthCalledWith(1, '1');
    expect(removePostMock).toHaveBeenNthCalledWith(2, '2');

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('언마운트 시, 타임아웃이 정리되어야 합니다.', async () => {
    removePostMock.mockResolvedValue({ success: true, error: null });

    const { result, unmount } = renderHook(() => useRemovePost());

    await act(async () => {
      await result.current.remove('1');
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(200);
    });
  });
});

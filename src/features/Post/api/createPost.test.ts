import { vi } from 'vitest';

import { PostgrestError } from '@supabase/supabase-js';

import type { PostRequest } from '../types';
import { getErrorMessage } from '../utils';

const { insertMock, selectMock, singleMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  selectMock: vi.fn(),
  singleMock: vi.fn(),
}));

vi.mock('@/utils/supabase/server', () => ({
  createClient: () => ({
    from: () => ({
      insert: (...args: unknown[]) => {
        insertMock(...args);
        return {
          select: (...args: unknown[]) => {
            selectMock(...args);
            return {
              single: singleMock,
            };
          },
        };
      },
    }),
  }),
}));

const { createPost } = await import('./createPost');

describe('[Features/Post] createPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('제목이 비어있으면 관련 오류 메시지를 반환해야 합니다.', async () => {
    const request: PostRequest = { title: '   ', content: 'content' };
    const result = await createPost(request);

    expect(result).toEqual({
      data: null,
      error: '제목을 입력해 주세요.',
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('내용이 비어있으면 관련 오류 메시지를 반환해야 합니다.', async () => {
    const request: PostRequest = { title: 'title', content: '' };
    const result = await createPost(request);

    expect(result).toEqual({
      data: null,
      error: '내용을 입력해 주세요.',
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('작업 성공 시, 생성된 게시글의 데이터 객체를 반환해야 합니다.', async () => {
    const request: PostRequest = { title: 'title', content: 'content' };
    const mockPost = {
      id: '1',
      title: 'title',
      content: 'content',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    singleMock.mockResolvedValue({ data: mockPost, error: null });

    const result = await createPost(request);

    expect(insertMock).toHaveBeenCalledWith(request);
    expect(selectMock).toHaveBeenCalled();
    expect(result).toEqual({ data: mockPost, error: null });
  });

  it('작업 실패 시, 적절한 오류 메시지를 반환해야 합니다.', async () => {
    const params = { title: 'title', content: 'content' };
    const mockError = new PostgrestError({
      code: '23503',
      message: '',
      details: '',
      hint: '',
    });

    singleMock.mockResolvedValue({ data: null, error: mockError });

    const result = await createPost(params);

    expect(insertMock).toHaveBeenCalled();
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(result.error).toBe(getErrorMessage(mockError));
  });

  it('작업 중 예외 발생 시, 기본 오류 메시지를 반환해야 합니다.', async () => {
    const request: PostRequest = { title: 'title', content: 'content' };
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    singleMock.mockRejectedValue(new Error('Network error'));

    const result = await createPost(request);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Create Post Error:',
      expect.any(Error),
    );
    expect(result).toEqual({
      data: null,
      error: '게시글 생성 중 오류가 발생했습니다.',
    });

    consoleErrorSpy.mockRestore();
  });
});

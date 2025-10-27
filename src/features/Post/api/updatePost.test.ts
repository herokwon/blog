import { vi } from 'vitest';

import { PostgrestError } from '@supabase/supabase-js';

import type { PostRequest } from '../types';
import { getErrorMessage } from '../utils';

const { updateMock, eqMock, selectMock, singleMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  eqMock: vi.fn(),
  selectMock: vi.fn(),
  singleMock: vi.fn(),
}));

vi.mock('@/utils/supabase/server', () => ({
  createClient: () => ({
    from: () => ({
      update: (...args: unknown[]) => {
        updateMock(...args);
        return {
          eq: (...args: unknown[]) => {
            eqMock(...args);
            return {
              select: (...args: unknown[]) => {
                selectMock(...args);
                return {
                  single: singleMock,
                };
              },
            };
          },
        };
      },
    }),
  }),
}));

const { updatePost } = await import('./updatePost');

describe('[Features/Post] updatePost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('제목이 비어있으면 관련 오류 메시지를 반환해야 합니다.', async () => {
    const params = { id: '1', title: '', content: 'content' };
    const result = await updatePost(params);

    expect(result).toEqual({
      data: null,
      error: '제목을 입력해 주세요.',
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('내용이 비어있으면 관련 오류 메시지를 반환해야 합니다.', async () => {
    const params = { id: '1', title: 'title', content: '' };
    const result = await updatePost(params);

    expect(result).toEqual({
      data: null,
      error: '내용을 입력해 주세요.',
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('작업 성공 시, 수정된 게시글의 데이터 객체를 반환해야 합니다.', async () => {
    const params = { id: '1', title: 'updated', content: 'updated content' };
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

    singleMock.mockResolvedValue({ data: mockPost, error: null });

    const result = await updatePost(params);

    expect(updateMock).toHaveBeenCalledWith(request);
    expect(eqMock).toHaveBeenCalledWith('id', '1');
    expect(selectMock).toHaveBeenCalled();
    expect(result).toEqual({ data: mockPost, error: null });
  });

  it('작업 실패 시, 적절한 오류 메시지를 반환해야 합니다.', async () => {
    const params = { id: '1', title: 'title', content: 'content' };
    const mockError = new PostgrestError({
      code: '23503',
      message: '',
      details: '',
      hint: '',
    });

    singleMock.mockResolvedValue({ data: null, error: mockError });

    const result = await updatePost(params);

    expect(updateMock).toHaveBeenCalled();
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(result.error).toBe(getErrorMessage(mockError));
  });

  it('예외 발생 시, 기본 오류 메시지를 반환해야 합니다.', async () => {
    const params = { id: '1', title: 'title', content: 'content' };
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    singleMock.mockRejectedValue(new Error('Network error'));

    const result = await updatePost(params);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Update Post Error:',
      expect.any(Error),
    );
    expect(result).toEqual({
      data: null,
      error: '게시물 수정 중 오류가 발생했습니다.',
    });

    consoleErrorSpy.mockRestore();
  });
});

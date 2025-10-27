import { vi } from 'vitest';

import { PostgrestError } from '@supabase/supabase-js';

import { getErrorMessage } from '../utils';

const { deleteMock, eqMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  eqMock: vi.fn(),
}));

vi.mock('@/utils/supabase/server', () => ({
  createClient: () => ({
    from: () => ({
      delete: () => {
        deleteMock();
        return {
          eq: eqMock,
        };
      },
    }),
  }),
}));

const { removePost } = await import('./removePost');

describe('[Features/Post] removePost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ID 값이 비어있으면 오류 메시지를 반환한다', async () => {
    const result = await removePost('');

    expect(result).toEqual({
      success: false,
      error: '유효하지 않은 게시글 ID입니다.',
    });
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('작업 성공 시, { success: true, error: null } 를 반환해야 합니다.', async () => {
    eqMock.mockResolvedValue({ error: null });

    const result = await removePost('1');

    expect(deleteMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith('id', '1');
    expect(result).toEqual({ success: true, error: null });
  });

  it('작업 실패 시, { success: false, error: message } 를 반환해야 합니다.', async () => {
    const mockError = new PostgrestError({
      code: '23503',
      message: '',
      details: '',
      hint: '',
    });
    eqMock.mockResolvedValue({ error: mockError });

    const result = await removePost('1');

    expect(deleteMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith('id', '1');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).toBe(getErrorMessage(mockError));
  });

  it('예외 발생 시, 기본 오류 메시지를 반환해야 합니다.', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    eqMock.mockRejectedValue(new Error('Network error'));

    const result = await removePost('1');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Delete Post Error:',
      expect.any(Error),
    );
    expect(result).toEqual({
      success: false,
      error: '게시글 삭제 중 오류가 발생했습니다.',
    });

    consoleErrorSpy.mockRestore();
  });
});

import { vi } from 'vitest';

import { PostgrestError } from '@supabase/supabase-js';

import { getErrorMessage } from '../utils';

const { selectMock, eqMock, singleMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  singleMock: vi.fn(),
}));

vi.mock('@/utils/supabase/server', () => ({
  createClient: () => ({
    from: () => ({
      select: (...args: unknown[]) => {
        selectMock(...args);
        return {
          eq: (...args: unknown[]) => {
            eqMock(...args);
            return {
              single: singleMock,
            };
          },
        };
      },
    }),
  }),
}));

const { getPost } = await import('./getPost');

describe('[Features/Post] getPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('작업 성공 시, 단일 게시글 데이터를 반환해야 합니다.', async () => {
    const mock = {
      id: '1',
      title: 't',
      content: 'c',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };
    singleMock.mockResolvedValue({ data: mock, error: null });

    const result = await getPost('1');

    expect(selectMock).toHaveBeenCalledWith('*');
    expect(eqMock).toHaveBeenCalledWith('id', '1');
    expect(result.error).toBeNull();
    expect(result).toEqual({ data: mock, error: null });
  });

  it('작업 실패 시, 적절한 오류 메시지를 반환해야 합니다.', async () => {
    const error = new PostgrestError({
      code: '23503',
      message: '',
      details: '',
      hint: '',
    });
    singleMock.mockResolvedValue({ data: null, error: error });

    const result = await getPost('1');

    expect(selectMock).toHaveBeenCalled();
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(result.error).toBe(getErrorMessage(error));
  });

  it('예외 발생 시, 기본 오류 메시지를 반환하고 로그를 출력해야 합니다.', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    singleMock.mockRejectedValue(new Error('boom'));

    const result = await getPost('1');

    expect(spy).toHaveBeenCalledWith('Get Post Error:', expect.any(Error));
    expect(result).toEqual({
      data: null,
      error: '게시글을 불러오는 중 오류가 발생했습니다.',
    });

    spy.mockRestore();
  });
});

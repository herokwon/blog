import { vi } from 'vitest';

import { PostgrestError } from '@supabase/supabase-js';

import { getErrorMessage } from '../utils';

const { selectMock, orderMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  orderMock: vi.fn(),
}));

vi.mock('@/utils/supabase/server', () => ({
  createClient: () => ({
    from: () => ({
      select: (...args: unknown[]) => {
        selectMock(...args);
        return {
          order: (...args: unknown[]) => {
            return orderMock(...args);
          },
        };
      },
    }),
  }),
}));

const { getPosts } = await import('./getPosts');

describe('[Features/Post] getPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('작업 성공 시, 게시글 목록을 최신순으로 반환해야 합니다.', async () => {
    orderMock.mockResolvedValueOnce({
      data: [
        {
          id: '2',
          created_at: '2025-01-02',
          updated_at: '2025-01-02',
          title: 'title2',
          content: 'content2',
        },
        {
          id: '1',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          title: 'title1',
          content: 'content1',
        },
      ],
      error: null,
    });

    const result = await getPosts();

    expect(selectMock).toHaveBeenCalledWith('*');
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result.data).not.toBeNull();
    expect(result.error).toBeNull();
  });

  it('작업 실패 시, 적절한 오류 메시지를 반환해야 합니다.', async () => {
    const error = new PostgrestError({
      code: '23505',
      message: '',
      details: '',
      hint: '',
    });
    orderMock.mockResolvedValueOnce({ data: null, error: error });

    const result = await getPosts();

    expect(selectMock).toHaveBeenCalled();
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(result.error).toBe(getErrorMessage(error));
  });

  it('예외 발생 시, 기본 오류 메시지를 반환하고 로그를 출력해야 합니다.', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    orderMock.mockRejectedValueOnce(new Error('network'));

    const result = await getPosts();

    expect(spy).toHaveBeenCalledWith('Get Posts Error:', expect.any(Error));
    expect(result).toEqual({
      data: null,
      error: '게시글 목록을 불러오는 중 오류가 발생했습니다.',
    });

    spy.mockRestore();
  });
});

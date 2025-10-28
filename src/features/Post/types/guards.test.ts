import { describe, expect, it } from 'vitest';

import type { CreatePostResponse, UpdatePostResponse } from '.';
import { isError, isSuccess } from './guards';

describe('[Features/Post] guards', () => {
  it('성공 / 실패 판별과 타입 내로잉을 한번에 모두 검증합니다.', () => {
    const successCreate: CreatePostResponse = {
      data: {
        id: '1',
        title: 'title',
        content: 'content',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      error: null,
    };
    expect(isSuccess(successCreate)).toBe(true);
    expect(isError(successCreate)).toBe(false);

    if (isSuccess(successCreate)) {
      expect(successCreate.data.id).toBe('1');
      expect(successCreate.error).toBeNull();
    }

    const errorCreate: CreatePostResponse = {
      data: null,
      error: '게시글 생성에 실패했습니다.',
    };

    expect(isSuccess(errorCreate)).toBe(false);
    expect(isError(errorCreate)).toBe(true);

    if (isError(errorCreate)) {
      expect(errorCreate.error).toBe('게시글 생성에 실패했습니다.');
      expect(errorCreate.data).toBeNull();
    }

    const successUpdate: UpdatePostResponse = {
      data: {
        id: '1',
        title: 'updated',
        content: 'updated content',
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      },
      error: null,
    };
    const errorUpdate: UpdatePostResponse = {
      data: null,
      error: '게시글 수정에 실패했습니다.',
    };

    expect(isSuccess(successUpdate)).toBe(true);
    expect(isError(errorUpdate)).toBe(true);
  });
});

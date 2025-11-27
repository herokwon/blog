'use server';

import { createClient } from '@/utils/supabase/server';

import type { RemovePostResponse } from '../types';
import { getErrorMessage } from '../utils/errorMessage';

/**
 * 게시글을 삭제합니다.
 *
 * - 게시글 ID 유효성 검사
 * - Supabase posts 테이블에서 데이터 삭제
 * - PostgreSQL 에러를 사용자 친화적 메시지로 변환
 *
 * @param id - 삭제할 게시글 ID (빈 문자열인 경우 에러)
 *
 * @returns 게시글 삭제 결과를 담은 Promise
 * - `success`: 삭제 성공 여부 (`true` 성공, `false` 실패)
 * - `error`: 에러 메시지 (실패 시) 또는 `null` (성공 시)
 *
 * @see {@link RemovePostResponse} - 응답 데이터 타입 정의
 * @see {@link getErrorMessage} - PostgreSQL 에러 메시지 변환 함수
 */
export const removePost = async (id: string): Promise<RemovePostResponse> => {
  if (id.length === 0)
    return {
      success: false,
      error: '유효하지 않은 게시글 ID입니다.',
    };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('posts').delete().eq('id', id);

    return !error
      ? { success: true, error }
      : {
          success: false,
          error: getErrorMessage(error),
        };
  } catch (error) {
    console.error('Delete Post Error:', error);
    return {
      success: false,
      error: '게시글 삭제 중 오류가 발생했습니다.',
    };
  }
};

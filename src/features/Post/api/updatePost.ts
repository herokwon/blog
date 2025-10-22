'use server';

import { createClient } from '@/utils/supabase/server';

import type { PostRequest, UpdatePostResponse } from '../types';
import { getErrorMessage } from '../utils/errorMessage';

/**
 * 게시글을 수정합니다.
 *
 * - 제목과 내용의 유효성 검사 (공백 체크)
 * - Supabase posts 테이블의 데이터 업데이트
 * - PostgreSQL 에러를 사용자 친화적 메시지로 변환
 *
 * @param params - 게시글 수정 요청 데이터
 * @param params.id - 수정할 게시글 ID
 * @param params.title - 수정할 게시글 제목 (공백만 있는 경우 에러)
 * @param params.contents - 수정할 게시글 내용 (공백만 있는 경우 에러)
 *
 * @returns 게시글 수정 결과를 담은 Promise
 * - `data`: 수정된 게시글 (성공 시) 또는 `null` (실패 시)
 * - `error`: 에러 메시지 (실패 시) 또는 `null` (성공 시)
 *
 * @see {@link PostRequest} - 요청 데이터 타입 정의
 * @see {@link UpdatePostResponse} - 응답 데이터 타입 정의
 * @see {@link getErrorMessage} - PostgreSQL 에러 메시지 변환 함수
 */
export const updatePost = async ({
  id,
  ...request
}: {
  id: string;
} & PostRequest): Promise<UpdatePostResponse> => {
  if (request.title.trim().length === 0)
    return {
      data: null,
      error: '제목을 입력해 주세요.',
    };
  if (request.contents.trim().length === 0)
    return {
      data: null,
      error: '내용을 입력해 주세요.',
    };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('posts')
      .update(request)
      .eq('id', id)
      .select()
      .single();

    return !error
      ? { data, error }
      : {
          data: null,
          error: getErrorMessage(error),
        };
  } catch (error) {
    console.error('Update Post Error:', error);
    return {
      data: null,
      error: '게시물 수정 중 오류가 발생했습니다.',
    };
  }
};

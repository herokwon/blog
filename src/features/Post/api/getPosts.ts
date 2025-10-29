'use server';

import { createClient } from '@/utils/supabase/server';

import type { GetPostsResponse } from '../types';
import { getErrorMessage } from '../utils';

/**
 * 게시글 목록을 최신순으로 조회합니다.
 *
 * - Supabase 클라이언트를 생성합니다.
 * - posts 테이블에서 id 컬럼만 조회합니다.
 * - created_at 기준 내림차순으로 정렬합니다.
 * - PostgreSQL/Supabase 에러를 사용자 친화적 메시지로 변환합니다.
 *
 * @returns 게시글 목록 조회 결과를 담은 Promise
 * - `data`: 게시글 id 배열(성공 시) 또는 `null`(실패 시)
 * - `error`: 에러 메시지(실패 시) 또는 `null`(성공 시)
 *
 * @see {@link GetPostsResponse} - 응답 데이터 타입 정의
 * @see {@link getErrorMessage} - PostgreSQL 에러 메시지 변환 함수
 */
export const getPosts = async (): Promise<GetPostsResponse> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('posts')
      .select('id')
      .order('created_at', { ascending: false });

    return !error
      ? {
          data: data.map(post => post.id),
          error,
        }
      : {
          data: null,
          error: getErrorMessage(error),
        };
  } catch (error) {
    console.error('Get Posts Error:', error);
    return {
      data: null,
      error: '게시글 목록을 불러오는 중 오류가 발생했습니다.',
    };
  }
};

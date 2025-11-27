'use server';

import { createClient } from '@/utils/supabase/server';

import type { GetPostResponse } from '../types';
import { getErrorMessage } from '../utils';

/**
 * 특정 ID의 게시글을 상세 조회합니다.
 *
 * - Supabase 클라이언트를 생성합니다.
 * - posts 테이블에서 모든 컬럼(*)을 조회합니다.
 * - id 컬럼으로 단일 레코드를 조회하고 `single()`로 단일 결과를 보장합니다.
 * - PostgreSQL/Supabase 에러를 사용자 친화적 메시지로 변환합니다.
 *
 * @param id - 조회할 게시글의 ID
 *
 * @returns 게시글 상세 조회 결과를 담은 Promise
 * - `data`: 게시글(성공 시) 또는 `null`(실패 시)
 * - `error`: 에러 메시지(실패 시) 또는 `null`(성공 시)
 *
 * @see {@link GetPostResponse} - 응답 데이터 타입 정의
 * @see {@link getErrorMessage} - PostgreSQL 에러 메시지 변환 함수
 */
export const getPost = async (id: string): Promise<GetPostResponse> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();
    return !error
      ? {
          data,
          error,
        }
      : {
          data: null,
          error: getErrorMessage(error),
        };
  } catch (error) {
    console.error('Get Post Error:', error);
    return {
      data: null,
      error: '게시글을 불러오는 중 오류가 발생했습니다.',
    };
  }
};

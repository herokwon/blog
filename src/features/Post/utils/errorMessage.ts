import { PostgrestError } from '@supabase/supabase-js';

type PostgresErrorCode =
  | '08006' // connection_failure (연결 실패)
  | '23502' // not_null_violation (NOT NULL 위반)
  | '23505' // unique_violation (중복 키)
  | '23503' // foreign_key_violation (외래 키 위반)
  | '23514' // check_violation (CHECK 제약 위반)
  | '42501' // insufficient_privilege (권한 부족)
  | '42703' // undefined_column (컬럼 없음)
  | '42P01' // undefined_table (테이블 없음)
  | 'PGRST116' // JWT expired (Supabase PostgREST)
  | 'PGRST301'; // JWT invalid

export const getErrorMessage = (error: PostgrestError): string => {
  const code = error.code as PostgresErrorCode;

  switch (code) {
    case '08006':
      return '데이터베이스 연결에 실패했습니다.';
    case '23502':
      return '필수 항목이 누락되었습니다.';
    case '23503':
      return '관련된 데이터가 존재하지 않습니다.';
    case '23505':
      return '중복된 데이터가 존재합니다.';
    case '23514':
      return '데이터가 유효하지 않습니다.';
    case '42501':
      return '권한이 부족합니다.';
    case '42703':
      return '존재하지 않는 필드에 접근했습니다.';
    case '42P01':
      return '존재하지 않는 테이블에 접근했습니다.';
    case 'PGRST116':
      return '인증이 만료되었습니다.\n다시 로그인해주세요.';
    case 'PGRST301':
      return '유효하지 않은 인증입니다.\n다시 로그인해주세요.';
    default:
      return '요청을 처리하는 중 오류가 발생했습니다.';
  }
};

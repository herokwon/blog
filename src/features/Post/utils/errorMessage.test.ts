import { describe, expect, it } from 'vitest';

import type { PostgrestError } from '@supabase/supabase-js';

import { getErrorMessage } from './errorMessage';

const makeError = (code: string): PostgrestError =>
  ({
    message: 'error',
    code,
    details: null,
    hint: null,
  }) as unknown as PostgrestError;

describe('[Features/Post] getErrorMessage', () => {
  it('모든 매핑된 에러 코드와 기본 분기를 처리해야 합니다.', () => {
    const cases: Array<[string, string]> = [
      ['08006', '데이터베이스 연결에 실패했습니다.'],
      ['23502', '필수 항목이 누락되었습니다.'],
      ['23503', '관련된 데이터가 존재하지 않습니다.'],
      ['23505', '중복된 데이터가 존재합니다.'],
      ['23514', '데이터가 유효하지 않습니다.'],
      ['42501', '권한이 부족합니다.'],
      ['42703', '존재하지 않는 필드에 접근했습니다.'],
      ['42P01', '존재하지 않는 테이블에 접근했습니다.'],
      ['PGRST116', '인증이 만료되었습니다.\n다시 로그인해주세요.'],
      ['PGRST301', '유효하지 않은 인증입니다.\n다시 로그인해주세요.'],
    ];

    for (const [code, expected] of cases) {
      expect(getErrorMessage(makeError(code))).toBe(expected);
    }

    expect(getErrorMessage(makeError('UNKNOWN'))).toBe(
      '요청을 처리하는 중 오류가 발생했습니다.',
    );
  });
});

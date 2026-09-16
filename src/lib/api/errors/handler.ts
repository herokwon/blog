import { json } from '@sveltejs/kit';
import type { ErrorResponse } from '../schemas';
import { ApiError } from './error';

export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      } satisfies ErrorResponse,
      {
        status: error.status,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  return json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error.',
        details: [],
      },
    } satisfies ErrorResponse,
    {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}

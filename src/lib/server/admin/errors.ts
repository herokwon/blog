import type { ApiErrorCode } from '$lib/admin/error-codes';

export type ValidationDetail = { path: (string | number)[]; message: string };

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: ValidationDetail[],
  ) {
    super(message);
  }
}

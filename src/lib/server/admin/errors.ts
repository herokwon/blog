import type { ApiErrorCode, ValidationDetail } from '#lib/admin/contracts.ts';

export type { ValidationDetail } from '#lib/admin/contracts.ts';

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

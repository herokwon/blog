import type { ApiErrorCode, ValidationDetail } from '$lib/admin/contracts';

export type { ValidationDetail } from '$lib/admin/contracts';

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

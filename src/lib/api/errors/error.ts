import type { ErrorCode, ValidationIssue } from '$lib/api/schemas';

const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONTENT_NOT_FOUND: 404,
  INVALID_CONTENT_STATE: 409,
  SLUG_CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: ValidationIssue[];

  constructor({
    code,
    message,
    details = [],
  }: {
    code: ErrorCode;
    message: string;
    details?: ValidationIssue[];
  }) {
    super(message);

    this.name = 'ApiError';
    this.code = code;
    this.status = ERROR_STATUS_MAP[code];
    this.details = details;
  }
}

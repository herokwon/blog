import type { components } from '$lib/types/schema';

type SchemaApiError = components['schemas']['ApiError'];
type SchemaApiErrorResponse = components['schemas']['ApiErrorResponse'];
type SchemaApiSuccessResponsePost =
  components['schemas']['ApiSuccessResponsePost'];

export type ApiError = SchemaApiError;

export type ApiSuccessResponse<T> = Omit<
  SchemaApiSuccessResponsePost,
  'data' | 'error'
> & {
  data: T;
  error: null;
  message?: string;
};

export type ApiErrorResponse = Omit<SchemaApiErrorResponse, 'data'> & {
  data: null;
  message?: string;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

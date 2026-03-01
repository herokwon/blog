export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  error: null;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  error: ApiError;
  message?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface ApiError {
  code: string | number;
  message: string;
  details: unknown;
}

import type { ErrorResponse, SuccessResponse } from '.';

type Result<K extends string, T> = SuccessResponse<K, T> | ErrorResponse<K, T>;

export const isSuccess = <K extends string, T>(
  result: Result<K, T>,
): result is SuccessResponse<K, T> => {
  return !result.error;
};

export const isError = <K extends string, T>(
  result: Result<K, T>,
): result is ErrorResponse<K, T> => {
  return typeof result.error === 'string';
};

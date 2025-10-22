import type { CreatePostResponse, Post, UpdatePostResponse } from '.';

export const isSuccess = (
  result: CreatePostResponse | UpdatePostResponse,
): result is { data: Post; error: null } => {
  return !result.error;
};

export const isError = (
  result: CreatePostResponse | UpdatePostResponse,
): result is { data: null; error: string } => {
  return result.error !== null;
};

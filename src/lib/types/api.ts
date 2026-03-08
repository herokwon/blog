import type { components, operations } from '$lib/types/schema';

type SchemaApiError = components['schemas']['ApiError'];
type SchemaApiErrorResponse = components['schemas']['ApiErrorResponse'];

export type ApiError = SchemaApiError;

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  error: null;
  message?: string;
};

export type ApiErrorResponse = Omit<SchemaApiErrorResponse, 'data'> & {
  data: null;
  message?: string;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

type SchemaPost = components['schemas']['Post'];

export type ListPostsApiResponse = ApiResponse<SchemaPost[]>;
export type CreatePostApiResponse = ApiResponse<SchemaPost>;
export type GetPostByIdApiResponse = ApiResponse<SchemaPost>;
export type UpdatePostByIdApiResponse = ApiResponse<SchemaPost>;
export type DeletePostByIdApiResponse = ApiResponse<null>;

export type ListPostsOperation = operations['listPosts'];
export type CreatePostOperation = operations['createPost'];
export type GetPostByIdOperation = operations['getPostById'];
export type UpdatePostByIdOperation = operations['updatePostById'];
export type DeletePostByIdOperation = operations['deletePostById'];

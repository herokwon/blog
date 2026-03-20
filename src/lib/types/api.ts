import type { Post } from '$lib/types/post';
import type { components, operations } from '$lib/types/schema';

type SchemaApiSuccessResponse = components['schemas']['ApiSuccessResponse'];
type SchemaApiError = components['schemas']['ApiError'];
type SchemaApiErrorResponse = components['schemas']['ApiErrorResponse'];

export type ApiError = SchemaApiError;

export type ApiSuccessResponse<T = null> = Omit<
  SchemaApiSuccessResponse,
  'data'
> & {
  data: T;
};

export type ApiErrorResponse = Omit<SchemaApiErrorResponse, 'data'> & {
  data: null;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export type ListPostsApiResponse = ApiResponse<Post[]>;
export type CreatePostApiResponse = ApiResponse<Post>;
export type GetPostByIdApiResponse = ApiResponse<Post>;
export type UpdatePostByIdApiResponse = ApiResponse<Post>;
export type DeletePostByIdApiResponse = ApiResponse<null>;

export type ListPostsOperation = operations['listPosts'];
export type CreatePostOperation = operations['createPost'];
export type GetPostByIdOperation = operations['getPostById'];
export type UpdatePostByIdOperation = operations['updatePostById'];
export type DeletePostByIdOperation = operations['deletePostById'];

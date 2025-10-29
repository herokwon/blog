export * from './guards';

export type Post = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  content: string;
};

export type PostRequest = Pick<Post, 'title' | 'content'>;

export type SuccessResponse<K extends string, T> = {
  [P in K]: T;
} & {
  error: null;
};
export type ErrorResponse<K extends string, T> = {
  [P in K]: T;
} & {
  error: string;
};

export type CreatePostResponse =
  | SuccessResponse<'data', Post>
  | ErrorResponse<'data', null>;
export type UpdatePostResponse =
  | SuccessResponse<'data', Post>
  | ErrorResponse<'data', null>;
export type RemovePostResponse =
  | SuccessResponse<'success', true>
  | ErrorResponse<'success', false>;
export type GetPostsResponse =
  | SuccessResponse<'data', string[]>
  | ErrorResponse<'data', null>;

export type GetPostResponse =
  | SuccessResponse<'data', Post>
  | ErrorResponse<'data', null>;

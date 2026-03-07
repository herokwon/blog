import { json, type RequestHandler } from '@sveltejs/kit';

import type {
  ApiError,
  ApiErrorResponse,
  ApiSuccessResponse,
} from '$lib/types/api';
import type { Post, UpdatePostInput } from '$lib/types/post';

function isUpdatePostRequestBody(body: unknown): body is UpdatePostInput {
  return (
    typeof body === 'object' &&
    body !== null &&
    'title' in body &&
    typeof body.title === 'string' &&
    'content' in body &&
    typeof body.content === 'string'
  );
}

export const GET: RequestHandler = async ({
  platform,
  params,
}): Promise<Response> => {
  try {
    const postId = params.id;
    if (!postId) {
      const error: ApiError = {
        code: 'INVALID_REQUEST',
        message: 'Post id is required',
        details: null,
      };

      return json(
        { success: false, data: null, error } satisfies ApiErrorResponse,
        {
          status: 400,
          statusText: 'Bad Request',
        },
      );
    }

    const bucket = platform?.env.BLOG;
    if (!bucket) {
      const error: ApiError = {
        code: 'BUCKET_NOT_FOUND',
        message: 'Blog bucket not found in environment variables',
        details: null,
      };

      return json(
        { success: false, data: null, error } satisfies ApiErrorResponse,
        {
          status: 500,
          statusText: 'Internal Server Error',
        },
      );
    }

    const storedPost = await bucket.get(postId);
    if (!storedPost) {
      const error: ApiError = {
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
        details: { id: postId },
      };

      return json(
        { success: false, data: null, error } satisfies ApiErrorResponse,
        {
          status: 404,
          statusText: 'Not Found',
        },
      );
    }

    const post = await storedPost.json<Post>();

    return json({
      success: true,
      data: post,
      error: null,
    } satisfies ApiSuccessResponse<Post>);
  } catch (e) {
    const error: ApiError = {
      code: 'SERVER_ERROR',
      message: e instanceof Error ? e.message : 'Unknown error',
      details: null,
    };

    return json(
      { success: false, data: null, error } satisfies ApiErrorResponse,
      {
        status: 500,
        statusText: 'Internal Server Error',
      },
    );
  }
};

export const PUT: RequestHandler = async ({
  platform,
  params,
  request,
}): Promise<Response> => {
  try {
    const postId = params.id;
    if (!postId) {
      const error: ApiError = {
        code: 'INVALID_REQUEST',
        message: 'Post id is required',
        details: null,
      };

      return json(
        { success: false, data: null, error } satisfies ApiErrorResponse,
        {
          status: 400,
          statusText: 'Bad Request',
        },
      );
    }

    const body = await request.json();
    if (!isUpdatePostRequestBody(body)) {
      const error: ApiError = {
        code: 'INVALID_REQUEST',
        message: 'Request body must be a valid JSON object',
        details: null,
      };

      return json(
        { success: false, data: null, error } satisfies ApiErrorResponse,
        {
          status: 400,
          statusText: 'Bad Request',
        },
      );
    }

    const bucket = platform?.env.BLOG;
    if (!bucket) {
      const error: ApiError = {
        code: 'BUCKET_NOT_FOUND',
        message: 'Blog bucket not found in environment variables',
        details: null,
      };

      return json(
        { success: false, data: null, error } satisfies ApiErrorResponse,
        {
          status: 500,
          statusText: 'Internal Server Error',
        },
      );
    }

    const storedPost = await bucket.get(postId);
    if (!storedPost) {
      const error: ApiError = {
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
        details: { id: postId },
      };

      return json(
        { success: false, data: null, error } satisfies ApiErrorResponse,
        {
          status: 404,
          statusText: 'Not Found',
        },
      );
    }

    const post = await storedPost.json<Post>();
    const now = new Date().toISOString();

    const updatedPost: Post = {
      ...post,
      title: body.title,
      content: body.content,
      updatedAt: now,
    };

    await bucket.put(postId, JSON.stringify(updatedPost));

    return json({
      success: true,
      data: updatedPost,
      error: null,
    } satisfies ApiSuccessResponse<Post>);
  } catch (e) {
    const error: ApiError = {
      code: 'SERVER_ERROR',
      message: e instanceof Error ? e.message : 'Unknown error',
      details: null,
    };

    return json(
      { success: false, data: null, error } satisfies ApiErrorResponse,
      {
        status: 500,
        statusText: 'Internal Server Error',
      },
    );
  }
};

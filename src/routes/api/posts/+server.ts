import { json, type RequestHandler } from '@sveltejs/kit';

import type {
  ApiError,
  ApiErrorResponse,
  ApiSuccessResponse,
} from '$lib/types/api';
import type { CreatePostInput, Post } from '$lib/types/post';

function isPostRequestBody(body: unknown): body is CreatePostInput {
  return (
    typeof body === 'object' &&
    body !== null &&
    'title' in body &&
    typeof body.title === 'string' &&
    'content' in body &&
    typeof body.content === 'string'
  );
}

export const GET: RequestHandler = async ({ platform }): Promise<Response> => {
  try {
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

    const posts: Post[] = [];
    let cursor: string | undefined;

    do {
      const listedObjects = await bucket.list({ cursor });

      const objectPromises = listedObjects.objects.map(
        async (object: { key: string }) => {
          const storedPost = await bucket.get(object.key);
          if (!storedPost) {
            return null;
          }
          return storedPost.json<Post>();
        },
      );
      const pagePosts = await Promise.all(objectPromises);

      for (const post of pagePosts) {
        if (post) posts.push(post);
      }

      cursor = listedObjects.truncated ? listedObjects.cursor : undefined;
    } while (cursor);

    posts.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return json({
      success: true,
      data: posts,
      error: null,
    } satisfies ApiSuccessResponse<Post[]>);
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

export const POST: RequestHandler = async ({
  platform,
  request,
}): Promise<Response> => {
  try {
    const body = await request.json();
    if (!isPostRequestBody(body)) {
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

    const postId = crypto.randomUUID();
    const now = new Date().toISOString();
    const postData: Post = {
      ...body,
      id: postId,
      createdAt: now,
      updatedAt: now,
    };

    await bucket.put(postId, JSON.stringify(postData));

    return json({
      success: true,
      data: postData,
      error: null,
    } satisfies ApiSuccessResponse<Post>);
  } catch (e) {
    const error: ApiError = {
      code: 'SERVER_ERROR',
      message: e instanceof Error ? e.message : 'Unknown error',
      details: null,
    };

    return json(
      {
        success: false,
        data: null,
        error,
      } satisfies ApiErrorResponse,
      {
        status: 500,
        statusText: 'Internal Server Error',
      },
    );
  }
};

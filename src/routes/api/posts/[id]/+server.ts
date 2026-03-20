import { json, type RequestHandler } from '@sveltejs/kit';

import type {
  ApiError,
  ApiErrorResponse,
  ApiSuccessResponse,
} from '$lib/types/api';
import type { DBPost, Post } from '$lib/types/post';
import { dbPostToPost } from '$lib/types/post';

import {
  hasContentProperty,
  hasTitleProperty,
  isNonNullableObject,
  isPostInput,
} from '../utils';

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
        {
          success: false,
          data: null,
          error,
        } satisfies ApiErrorResponse,
        {
          status: 400,
          statusText: 'Bad Request',
        },
      );
    }

    const database = platform?.env.BLOG_DB;
    if (!database) {
      const error: ApiError = {
        code: 'DATABASE_BINDING_MISSING',
        message: 'The server is not configured correctly',
        details: {
          resource: 'BLOG_DB',
          hint: 'Please check your wrangler config file or environment variables',
        },
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

    const {
      results: [dbPost],
    } = await database
      .prepare('SELECT * FROM posts WHERE id = ?')
      .bind(postId)
      .run<DBPost>();

    if (!dbPost) {
      const error: ApiError = {
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
        details: { id: postId },
      };

      return json(
        {
          success: false,
          data: null,
          error,
        } satisfies ApiErrorResponse,
        {
          status: 404,
          statusText: 'Not Found',
        },
      );
    }

    const post = dbPostToPost(dbPost);

    return json(
      {
        success: true,
        data: post,
        error: null,
      } satisfies ApiSuccessResponse<Post>,
      {
        status: 200,
        statusText: 'OK',
      },
    );
  } catch (e) {
    const error: ApiError = {
      code: 'SERVER_ERROR',
      message:
        e instanceof Error ? e.message : 'Unknown error occurred on the server',
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
        {
          success: false,
          data: null,
          error,
        } satisfies ApiErrorResponse,
        {
          status: 400,
          statusText: 'Bad Request',
        },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
      if (!isNonNullableObject(body)) throw new Error();
    } catch {
      const error: ApiError = {
        code: 'INVALID_REQUEST',
        message: 'Request body must be a valid JSON object',
        details: null,
      };

      return json(
        {
          success: false,
          data: null,
          error,
        } satisfies ApiErrorResponse,
        {
          status: 400,
          statusText: 'Bad Request',
        },
      );
    }

    if (!isPostInput(body)) {
      const error: ApiError = {
        code: 'INVALID_REQUEST',
        message:
          'Request body must be a JSON object with string properties "title" and "content"',
        details: {
          title: hasTitleProperty(body)
            ? null
            : 'Missing or invalid (must be a non-empty string)',
          content: hasContentProperty(body)
            ? null
            : 'Missing or invalid (must be a non-empty string)',
        },
      };

      return json(
        {
          success: false,
          data: null,
          error,
        } satisfies ApiErrorResponse,
        {
          status: 400,
          statusText: 'Bad Request',
        },
      );
    }

    const database = platform?.env.BLOG_DB;
    if (!database) {
      const error: ApiError = {
        code: 'DATABASE_BINDING_MISSING',
        message: 'The server is not configured correctly',
        details: {
          resource: 'BLOG_DB',
          hint: 'Please check your wrangler config file or environment variables',
        },
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

    const { title, content } = body;
    const now = new Date().toISOString();

    const {
      results: [updatedDbPost],
    } = await database
      .prepare(
        'UPDATE posts SET title = ?, content = ?, updated_at = ? WHERE id = ? RETURNING *',
      )
      .bind(title, content, now, postId)
      .run<DBPost>();

    if (!updatedDbPost) {
      const error: ApiError = {
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
        details: { id: postId },
      };

      return json(
        {
          success: false,
          data: null,
          error,
        } satisfies ApiErrorResponse,
        {
          status: 404,
          statusText: 'Not Found',
        },
      );
    }

    const updatedPost = dbPostToPost(updatedDbPost);

    return json(
      {
        success: true,
        data: updatedPost,
        error: null,
      } satisfies ApiSuccessResponse<Post>,
      {
        status: 200,
        statusText: 'OK',
      },
    );
  } catch (e) {
    const error: ApiError = {
      code: 'SERVER_ERROR',
      message:
        e instanceof Error ? e.message : 'Unknown error occurred on the server',
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

export const DELETE: RequestHandler = async ({
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
        {
          success: false,
          data: null,
          error,
        } satisfies ApiErrorResponse,
        {
          status: 400,
          statusText: 'Bad Request',
        },
      );
    }

    const database = platform?.env.BLOG_DB;
    if (!database) {
      const error: ApiError = {
        code: 'DATABASE_BINDING_MISSING',
        message: 'The server is not configured correctly',
        details: {
          resource: 'BLOG_DB',
          hint: 'Please check your wrangler config file or environment variables',
        },
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

    const {
      results: [deletedDbPost],
    } = await database
      .prepare('DELETE FROM posts WHERE id = ? RETURNING *')
      .bind(postId)
      .run<DBPost>();

    if (!deletedDbPost) {
      const error: ApiError = {
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
        details: { id: postId },
      };

      return json(
        {
          success: false,
          data: null,
          error,
        } satisfies ApiErrorResponse,
        {
          status: 404,
          statusText: 'Not Found',
        },
      );
    }

    return json(
      {
        success: true,
        data: null,
        error: null,
      } satisfies ApiSuccessResponse<null>,
      {
        status: 200,
        statusText: 'OK',
      },
    );
  } catch (e) {
    const error: ApiError = {
      code: 'SERVER_ERROR',
      message:
        e instanceof Error ? e.message : 'Unknown error occurred on the server',
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

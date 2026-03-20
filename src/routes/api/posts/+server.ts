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
} from './utils';

export const GET: RequestHandler = async ({ platform }): Promise<Response> => {
  try {
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

    const { results: dbPosts } = await database
      .prepare('SELECT * FROM posts ORDER BY created_at DESC')
      .all<DBPost>();

    const posts = dbPosts.map(dbPostToPost);

    return json(
      {
        success: true,
        data: posts,
        error: null,
      } satisfies ApiSuccessResponse<Post[]>,
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

export const POST: RequestHandler = async ({
  platform,
  request,
}): Promise<Response> => {
  try {
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

    const postId = crypto.randomUUID();
    const now = new Date().toISOString();

    const {
      results: [createdDbPost],
    } = await database
      .prepare(
        'INSERT INTO posts (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING *',
      )
      .bind(postId, body.title, body.content, now, now)
      .run<DBPost>();

    if (!createdDbPost) {
      const error: ApiError = {
        code: 'POST_CREATION_FAILED',
        message: 'Failed to retrieve the created post from the database',
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

    const createdPost = dbPostToPost(createdDbPost);

    return json(
      {
        success: true,
        data: createdPost,
        error: null,
      } satisfies ApiSuccessResponse<Post>,
      {
        status: 201,
        statusText: 'Created',
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

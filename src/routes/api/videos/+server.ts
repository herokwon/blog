import { json, type RequestHandler } from '@sveltejs/kit';

import {
  ALLOWED_VIDEO_TYPES,
  MAX_VIDEO_SIZE_BYTES,
  R2_VIDEO_PREFIX,
} from '$lib/constants';
import type {
  ApiError,
  ApiErrorResponse,
  ApiSuccessResponse,
} from '$lib/types/api';
import type { VideoUploadData } from '$lib/types/video';

export const POST: RequestHandler = async ({
  platform,
  request,
  locals,
}): Promise<Response> => {
  try {
    if (!locals.user || locals.user.role !== 'admin') {
      const error: ApiError = {
        code: 'UNAUTHORIZED',
        message: 'You must be logged in as an admin to upload videos',
        details: null,
      };

      return json(
        {
          success: false,
          data: null,
          error,
        } satisfies ApiErrorResponse,
        {
          status: 401,
          statusText: 'Unauthorized',
        },
      );
    }

    const bucket = platform?.env.BLOG_BUCKET;
    if (!bucket) {
      const error: ApiError = {
        code: 'BUCKET_BINDING_MISSING',
        message: 'The server is not configured correctly',
        details: {
          resource: 'BLOG_BUCKET',
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

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      const error: ApiError = {
        code: 'INVALID_REQUEST',
        message: 'Request body must be valid multipart/form-data',
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

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      const error: ApiError = {
        code: 'INVALID_REQUEST',
        message: 'Request must include a file in the "file" field',
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

    if (!ALLOWED_VIDEO_TYPES.some(type => type === file.type)) {
      const error: ApiError = {
        code: 'INVALID_FILE_TYPE',
        message: `File type "${file.type}" is not allowed. Allowed types: ${ALLOWED_VIDEO_TYPES.join(', ')}`,
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

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      const maxSizeMB = MAX_VIDEO_SIZE_BYTES / 1024 / 1024;
      const actualSizeMB = (file.size / 1024 / 1024).toFixed(2);
      const error: ApiError = {
        code: 'FILE_TOO_LARGE',
        message: `File size (${actualSizeMB}MB) exceeds the maximum allowed size of ${maxSizeMB}MB`,
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

    const extension = getFileExtension(
      file.type as (typeof ALLOWED_VIDEO_TYPES)[number],
    );
    const key = `${R2_VIDEO_PREFIX}/${crypto.randomUUID()}.${extension}`;

    const arrayBuffer = await file.arrayBuffer();
    await bucket.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    const url = `/api/videos/${key}`;

    return json(
      {
        success: true,
        data: { key, url },
        error: null,
      } satisfies ApiSuccessResponse<VideoUploadData>,
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

function getFileExtension(
  mimeType: (typeof ALLOWED_VIDEO_TYPES)[number],
): string {
  const extensions = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogg',
  };
  return extensions[mimeType];
}

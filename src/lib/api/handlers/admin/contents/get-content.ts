import { contentIdSchema } from '$lib/api/schemas';
import type { ContentService } from '$lib/server/services';
import { json, type RequestEvent } from '@sveltejs/kit';

export function createGetContentHandler(service: ContentService) {
  return async (event: RequestEvent): Promise<Response> => {
    const result = contentIdSchema.safeParse(event.params.id);

    if (!result.success) {
      return json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed.',
            details: result.error.issues.map(issue => ({
              path: ['id', ...issue.path],
              message: issue.message,
            })),
          },
        },
        { status: 400 },
      );
    }

    try {
      const content = await service.getContent(result.data);

      return json(content, { status: 200 });
    } catch (error) {
      if (error instanceof Error && error.message === 'CONTENT_NOT_FOUND') {
        return json(
          {
            error: {
              code: 'CONTENT_NOT_FOUND',
              message: 'Content not found.',
              details: [],
            },
          },
          { status: 404 },
        );
      }

      throw error;
    }
  };
}

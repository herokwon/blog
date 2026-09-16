import { handleApiError } from '$lib/api/errors/handler';
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
      return handleApiError(error);
    }
  };
}

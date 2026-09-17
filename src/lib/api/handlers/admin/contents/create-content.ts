import { handleApiError } from '$lib/api/errors/handler';
import {
  createContentRequestSchema,
  type ErrorResponse,
} from '$lib/api/schemas';
import type { ContentService } from '$lib/server/services';
import { json, type RequestEvent } from '@sveltejs/kit';

export function createContentHandler(service: ContentService) {
  return async ({ request }: RequestEvent): Promise<Response> => {
    const body = await request.json();
    const parsedBody = createContentRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed.',
            details: parsedBody.error.issues.map(issue => ({
              path: issue.path.map(segment =>
                typeof segment === 'symbol' ? String(segment) : segment,
              ),
              message: issue.message,
            })),
          },
        } satisfies ErrorResponse,
        { status: 400 },
      );
    }

    try {
      const content = await service.createContent(parsedBody.data);

      return json(content, { status: 201 });
    } catch (error) {
      return handleApiError(error);
    }
  };
}

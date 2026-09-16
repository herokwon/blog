import { ApiError } from '$lib/api/errors';
import type { ContentService } from '$lib/server/services';
import { createTestContent } from '$lib/test/fixtures';
import { createGetContentHandler } from './get-content';

describe('[API/Handlers/Admin/Contents] GET /api/admin/contents/:id', () => {
  const contentId = '0198f7b1-1234-7abc-8def-123456789abc';

  describe('getContentHandler', () => {
    const createdAt = '2026-01-01T00:00:00.000Z';

    it('returns 200 with the content when a valid content ID is provided', async () => {
      const testContent = createTestContent({
        id: contentId,
        status: 'published',
        slug: 'test-content',
        createdAt,
        publishedAt: createdAt,
        updatedAt: createdAt,
      });

      const service = {
        getContent: vi.fn().mockResolvedValue(testContent),
      } as unknown as ContentService;

      const getContentHandler = createGetContentHandler(service);

      const event = {
        params: {
          id: testContent.id,
        },
      } as unknown as Parameters<typeof getContentHandler>[0];

      const response = await getContentHandler(event);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(testContent);
      expect(service.getContent).toHaveBeenCalledWith(testContent.id);
    });

    it('returns 400 when an invalid content ID is provided', async () => {
      const service = {
        getContent: vi.fn(),
      } as unknown as ContentService;

      const getContentHandler = createGetContentHandler(service);

      const event = {
        params: {
          id: 'invalid-id',
        },
      } as unknown as Parameters<typeof getContentHandler>[0];

      const response = await getContentHandler(event);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          details: [
            {
              path: ['id'],
              message: expect.any(String),
            },
          ],
        },
      });
      expect(service.getContent).not.toHaveBeenCalledWith();
    });

    it('returns 404 when the content does not exist', async () => {
      const service = {
        getContent: vi.fn().mockRejectedValue(
          new ApiError({
            code: 'CONTENT_NOT_FOUND',
            message: 'Content not found.',
          }),
        ),
      } as unknown as ContentService;

      const getContentHandler = createGetContentHandler(service);

      const event = {
        params: {
          id: contentId,
        },
      } as unknown as Parameters<typeof getContentHandler>[0];

      const response = await getContentHandler(event);

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: 'Content not found.',
          details: [],
        },
      });
      expect(service.getContent).toHaveBeenCalledWith(contentId);
    });
  });
});

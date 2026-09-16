import { getDb } from '$lib/server/db';
import { insertTestContent } from '$lib/test/helpers';
import { env } from 'cloudflare:workers';
import { GET } from './+server';

describe('GET /api/admin/contents/:id', () => {
  it('returns the requested content', async () => {
    const db = getDb(env.DB);
    const content = await insertTestContent(db);

    const event = {
      params: {
        id: content.id,
      },
      platform: {
        env,
      },
    } as unknown as Parameters<typeof GET>[0];

    const response = await GET(event);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(content);
  });

  it('returns 400 when the content ID is invalid', async () => {
    const event = {
      params: {
        id: 'invalid-id',
      },
      platform: {
        env,
      },
    } as unknown as Parameters<typeof GET>[0];

    const response = await GET(event);

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
  });

  it('returns 404 when the content does not exist', async () => {
    const contentId = '0198f7b1-1234-7abc-8def-123456789abc';

    const event = {
      params: {
        id: contentId,
      },
      platform: {
        env,
      },
    } as unknown as Parameters<typeof GET>[0];

    const response = await GET(event);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'CONTENT_NOT_FOUND',
        message: 'Content not found.',
        details: [],
      },
    });
  });
});

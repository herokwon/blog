import { createRequestEvent } from '$lib/test/fixtures';
import { env } from 'cloudflare:workers';
import { POST } from './+server';

describe('POST /api/admin/contents', () => {
  const requestPath = '/api/admin/contents';

  it('creates content and returns 201', async () => {
    const input = {
      title: 'Test title',
      body: 'Test body',
    };
    const request = createRequestEvent({
      path: requestPath,
      method: 'POST',
      body: input,
      platform: {
        env: env,
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(201);

    const responseBody = await response.json();

    expect(responseBody).toMatchObject({
      status: 'draft',
      slug: null,
      title: input.title,
      body: input.body,
      publishedAt: null,
      deletedAt: null,
    });
  });

  it('returns 400 when the request body is invalid', async () => {
    const invalidInput = {
      title: '',
      body: '',
    };
    const request = createRequestEvent({
      path: requestPath,
      method: 'POST',
      body: invalidInput,
      platform: {
        env,
      },
    });

    const response = await POST(request);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: ['title'],
            message: expect.any(String),
          }),
          expect.objectContaining({
            path: ['body'],
            message: expect.any(String),
          }),
        ]),
      },
    });
  });
});

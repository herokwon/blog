import type { ContentService } from '$lib/server/services';
import { createRequestEvent, createTestContent } from '$lib/test/fixtures';
import { createContentHandler } from './create-content';

describe('[API/Handlers - Admin/Contents] createCreateContentHandler', () => {
  it('returns 201 with the created content', async () => {
    const input = {
      title: 'Content Test Creation',
      body: '# Test Content Creation',
    };
    const testContent = createTestContent(input);

    const service = {
      createContent: vi.fn().mockResolvedValue(testContent),
    } as unknown as ContentService;

    const handler = createContentHandler(service);

    const event = createRequestEvent({
      path: '/api/admin/contents',
      method: 'POST',
      body: input,
    });

    const response = await handler(event);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(testContent);
    expect(service.createContent).toHaveBeenCalledWith(input);
  });

  it('returns 400 when the request body is invalid', async () => {
    const invalidInput = {
      title: '',
    };

    const service = {
      createContent: vi.fn(),
    } as unknown as ContentService;

    const handler = createContentHandler(service);

    const event = createRequestEvent({
      path: '/api/admin/contents',
      method: 'POST',
      body: invalidInput,
    });

    const response = await handler(event);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: ['body'],
            message: expect.any(String),
          }),
        ]),
      },
    });
    expect(service.createContent).not.toHaveBeenCalled();
  });

  it('includes all validation issues in the error details', async () => {
    const invalidInput = {
      title: 123,
      body: 456,
    };

    const service = {
      createContent: vi.fn(),
    } as unknown as ContentService;

    const handler = createContentHandler(service);

    const event = createRequestEvent({
      path: '/api/admin/contents',
      method: 'POST',
      body: invalidInput,
    });

    const response = await handler(event);
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
    expect(service.createContent).not.toHaveBeenCalled();
  });
});

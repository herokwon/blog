import { ApiError } from './error';
import { handleApiError } from './handler';

describe('[API/Errors] Error', () => {
  it('creates an error with the mapped status and empty details by default', () => {
    const error = new ApiError({
      code: 'CONTENT_NOT_FOUND',
      message: 'Content not found.',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(error.code).toBe('CONTENT_NOT_FOUND');
    expect(error.message).toBe('Content not found.');
    expect(error.status).toBe(404);
    expect(error.details).toEqual([]);
  });

  it.each([
    ['VALIDATION_ERROR', 400],
    ['UNAUTHORIZED', 401],
    ['FORBIDDEN', 403],
    ['CONTENT_NOT_FOUND', 404],
    ['INVALID_CONTENT_STATE', 409],
    ['SLUG_CONFLICT', 409],
    ['INTERNAL_ERROR', 500],
  ] as const)('maps %s to HTTP %i', (code, status) => {
    const error = new ApiError({
      code,
      message: 'Test error.',
    });

    expect(error.status).toBe(status);
  });

  it('preserves provided validation details', () => {
    const details = [
      {
        path: ['title'],
        message: 'title is required.',
      },
      {
        path: ['body'],
        message: 'body is required.',
      },
    ];

    const error = new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      details,
    });

    expect(error.details).toEqual(details);
  });

  it('serializes an ApiError into an HTTP response', async () => {
    const error = new ApiError({
      code: 'CONTENT_NOT_FOUND',
      message: 'Content not found.',
    });

    const response = handleApiError(error);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');

    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'CONTENT_NOT_FOUND',
        message: 'Content not found.',
        details: [],
      },
    });
  });

  it('serializes validation details without changing their field name', async () => {
    const error = new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      details: [
        {
          path: ['title'],
          message: 'title is required.',
        },
      ],
    });

    const response = handleApiError(error);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: [
          {
            path: ['title'],
            message: 'title is required.',
          },
        ],
      },
    });
  });
});

import { handleApiError } from './handler';

describe('[API/Errors] Error Handler', () => {
  it('maps an unexpected error to an internal server error response', async () => {
    const error = new Error('Database connection failed');

    const response = handleApiError(error);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error.',
        details: [],
      },
    });
  });

  it('does not expose unexcepted error details in the response', async () => {
    const error = new Error('Database connection failed: secret=super-secret');

    const response = handleApiError(error);
    const body = await response.json();

    expect(body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error.',
        details: [],
      },
    });
    expect(JSON.stringify(body)).not.toContain('Database connection failed');
    expect(JSON.stringify(body)).not.toContain('super-secret');
  });
});

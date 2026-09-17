import { createRequestEvent } from './http';

describe('[Test/Fixtures] createRequestEvent', () => {
  it('creates a RequestEvent with a JSON request body', async () => {
    const event = createRequestEvent({
      path: '/api/admin/contents',
      method: 'POST',
      body: {
        title: 'Test title',
        body: 'Test body',
      },
    });

    expect(event.request.method).toBe('POST');
    expect(event.request.headers.get('Content-Type')).toBe('application/json');
    expect(await event.request.json()).toEqual({
      title: 'Test title',
      body: 'Test body',
    });
  });

  it('creates a RequestEvent with a path-based request URL', async () => {
    const event = createRequestEvent({
      path: '/api/admin/contents',
      method: 'POST',
      body: {
        title: 'Test title',
        body: 'Test body',
      },
    });

    expect(new URL(event.request.url).pathname).toBe('/api/admin/contents');
  });
});

import type { RequestEvent } from '@sveltejs/kit';

type CreateRequestEventOptions = {
  path: string;
  method?: string;
  params?: Record<string, string>;
  platform?: Pick<App.Platform, 'env'>;
  body?: unknown;
};

export function createRequestEvent({
  path,
  method = 'GET',
  platform,
  params = {},
  body,
}: CreateRequestEventOptions): RequestEvent {
  const request = new Request(`http://localhost${path}`, {
    method,
    headers:
      body !== undefined
        ? {
            'Content-Type': 'application/json',
          }
        : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return {
    request,
    params,
    platform,
  } as RequestEvent;
}

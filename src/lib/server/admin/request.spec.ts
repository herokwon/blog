import type { RequestEvent } from '@sveltejs/kit';
import type { ResolveOptions } from '@sveltejs/kit/hooks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handle } from '../../../hooks.server';
import type { AdminEnvironment } from './environment';
import { AdminApiError } from './errors';

const authentication = vi.hoisted(() => vi.fn());
vi.mock('./access', () => ({ authenticateAdmin: authentication }));
const worker = vi.hoisted(() => ({ env: {} as AdminEnvironment }));
vi.mock('cloudflare:workers', () => worker);
vi.mock('$app/env', () => ({ dev: false }));

function event(path = '/api/admin/posts', method = 'GET', origin?: string) {
  const url = new URL(path, 'https://blog.example');
  for (const key of Object.keys(worker.env))
    delete worker.env[key as keyof AdminEnvironment];
  Object.assign(worker.env, { ADMIN_ORIGIN: 'https://blog.example' });
  return {
    url,
    request: new Request(url, {
      method,
      headers: origin ? { Origin: origin } : {},
    }),
    locals: {},
  } as unknown as RequestEvent;
}
const resolve =
  vi.fn<(event: RequestEvent, options?: ResolveOptions) => Promise<Response>>();

describe('Admin request hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authentication.mockResolvedValue({ email: 'admin@example.test' });
    resolve.mockResolvedValue(new Response('ok'));
  });

  it.each([
    '/admin',
    '/admin/posts',
    '/api/admin',
    '/api/admin/posts',
    '/%61dmin/posts',
  ])('protects %s and assigns request-scoped identity', async path => {
    const request = event(path);
    const response = await handle({ event: request, resolve });
    expect(authentication).toHaveBeenCalledWith(request);
    expect(request.locals.admin).toEqual({ email: 'admin@example.test' });
    expect(resolve).toHaveBeenCalledOnce();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it.each(['/administrator', '/api/admin-tools', '/'])(
    'leaves Public requests available: %s',
    async path => {
      const response = await handle({ event: event(path), resolve });
      expect(authentication).not.toHaveBeenCalled();
      expect(response.headers.has('cache-control')).toBe(false);
    },
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'rejects missing Origin for %s after authentication',
    async method => {
      const response = await handle({
        event: event(undefined, method),
        resolve,
      });
      expect(authentication).toHaveBeenCalledOnce();
      expect(resolve).not.toHaveBeenCalled();
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: {
          code: 'FORBIDDEN',
          message: 'Admin mutations require the trusted application origin.',
        },
      });
      expect(response.headers.get('cache-control')).toBe('no-store');
    },
  );

  it('authenticates before rejecting writes on a candidate', async () => {
    authentication.mockRejectedValue(
      new AdminApiError(401, 'UNAUTHORIZED', 'Authentication required.'),
    );
    const response = await handle({
      event: event(
        'https://candidate.blog.workers.dev/api/admin/posts',
        'POST',
        'https://candidate.blog.workers.dev',
      ),
      resolve,
    });
    expect(response.status).toBe(401);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('permits candidate reads but rejects authenticated candidate writes', async () => {
    const path = 'https://candidate.blog.workers.dev/api/admin/posts';
    expect((await handle({ event: event(path), resolve })).status).toBe(200);
    resolve.mockClear();
    expect(
      (
        await handle({
          event: event(path, 'POST', 'https://candidate.blog.workers.dev'),
          resolve,
        })
      ).status,
    ).toBe(403);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('allows an authenticated mutation with the exact trusted Origin', async () => {
    const response = await handle({
      event: event(undefined, 'POST', 'https://blog.example'),
      resolve,
    });
    expect(response.status).toBe(200);
    expect(resolve).toHaveBeenCalledOnce();
  });

  it.each([401, 403])(
    'returns uncached JSON authentication errors: %s',
    async status => {
      authentication.mockRejectedValue(
        new AdminApiError(
          status,
          status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
          'Access denied.',
        ),
      );
      const response = await handle({ event: event(), resolve });
      expect(response.status).toBe(status);
      expect(response.headers.get('content-type')).toContain(
        'application/json',
      );
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(resolve).not.toHaveBeenCalled();
    },
  );

  it('retains no-store on route errors and immutable redirect headers', async () => {
    resolve.mockResolvedValue(
      Response.redirect('https://blog.example/admin/posts'),
    );
    const response = await handle({ event: event('/admin'), resolve });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://blog.example/admin/posts',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    resolve.mockResolvedValue(new Response('Not found', { status: 404 }));
    expect(
      (await handle({ event: event(), resolve })).headers.get('cache-control'),
    ).toBe('no-store');
  });

  it('redacts unexpected errors', async () => {
    authentication.mockRejectedValue(
      new Error('secret token and database details'),
    );
    const response = await handle({ event: event(), resolve });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The Admin request could not be completed.',
      },
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

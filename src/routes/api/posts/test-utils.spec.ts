import { describe, expect, it } from 'vitest';

import { createMockEvent, createMockPlatform } from './test-utils';

describe('[Functions] test-utils', () => {
  it('createMockPlatform returns env with BLOG bucket and shapes', () => {
    const bucket = { put: () => {}, get: async () => null };
    const platform = createMockPlatform(bucket);

    expect(typeof platform).toBe('object');
    expect(platform.env.BLOG).toBe(bucket);
    expect(platform.ctx).toEqual({});
    expect(platform.caches).toEqual({});

    const emptyPlatform = createMockPlatform();
    expect(emptyPlatform.env.BLOG).toBeUndefined();
  });

  it('createMockEvent populates params, route, url and cookie helpers', () => {
    const req = new Request('http://localhost/posts/123');
    const bucket = { put: () => {} };
    const platform = createMockPlatform(bucket);

    const event = createMockEvent({
      request: req,
      platform,
      postId: '123',
      routeId: '/api/posts/[id]',
    });

    expect(event.params.id).toBe('123');
    expect(event.route.id).toBe('/api/posts/[id]');
    expect(event.url.href).toBe(req.url);

    expect(event.cookies.get('test')).toBeUndefined();
    expect(Array.isArray(event.cookies.getAll())).toBe(true);
    expect(event.cookies.getAll().length).toEqual(0);
    expect(event.cookies.set('test', 'value', { path: '' })).toBeUndefined();
    expect(event.cookies.delete('test', { path: '' })).toBeUndefined();
    expect(event.cookies.serialize('test', 'value', { path: '' })).toBe('');

    expect(typeof event.fetch).toBe('function');
    expect(event.getClientAddress()).toBe('');
    expect(event.setHeaders({})).toBeUndefined();
    expect(event.isDataRequest).toBe(false);
    expect(event.isSubRequest).toBe(false);
    expect(event.isRemoteRequest).toBe(false);
    expect(event.tracing).toEqual({
      enabled: false,
      root: null,
      current: null,
    });
  });

  it('createMockEvent works without platform and postId', () => {
    const req = new Request('http://localhost/');
    const event = createMockEvent({ request: req, routeId: '/' });

    expect(event.params.id).toBe('');
    expect(event.platform).toBeUndefined();
    expect(event.route.id).toBe('/');
  });
});

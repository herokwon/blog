import { describe, expect, it } from 'vitest';

import {
  createMockD1,
  createMockFetch,
  createMockLoadEvent,
  createMockPost,
  createMockRequestEvent,
} from './test-utils';

describe('[Functions] test-utils', () => {
  it('createMockPost returns a post object with default values', () => {
    const post = createMockPost();

    expect(post).toHaveProperty('id');
    expect(post).toHaveProperty('title');
    expect(post).toHaveProperty('content');
    expect(post).toHaveProperty('createdAt');
    expect(post).toHaveProperty('updatedAt');
  });

  it('createMockD1 returns a mock D1 and spies are callable', async () => {
    const { db, spies } = createMockD1();

    spies.prepare('SELECT 1');
    spies.bind('x', 1);
    spies.first();
    spies.run();
    spies.all();

    expect(typeof db).toBe('object');

    expect(spies.prepare).toHaveBeenCalled();
    expect(spies.bind).toHaveBeenCalled();
    expect(spies.first).toHaveBeenCalled();
    expect(spies.run).toHaveBeenCalled();
    expect(spies.all).toHaveBeenCalled();
  });

  it('createMockRequestEvent attaches platform env, ctx, caches', () => {
    const { db } = createMockD1();
    const {
      event: { platform },
    } = createMockRequestEvent({
      pathname: '/posts',
      db,
    });

    expect(platform?.env.BLOG_DB).toBe(db);
  });

  it('createMockFetch returns Response with JSON and correct headers', async () => {
    const payload = { ok: true, items: [createMockPost()] };
    const mockFetch = createMockFetch(payload);

    const response = await mockFetch('/api/test');
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(json).toEqual(payload);
  });

  it('createMockLoadEvent builds a load event with resolved fields', async () => {
    const payload = { success: true, data: [] };
    const mockFetch = createMockFetch(payload);
    const event = createMockLoadEvent({ id: 'abc', fetch: mockFetch });

    expect(event.params).toEqual({ id: 'abc' });
    expect(event.route.id).toContain('[id]');
    expect(event.url.toString()).toContain('/posts/abc');
    expect(event.request).toBeInstanceOf(Request);
    expect(event.getClientAddress()).toBe('127.0.0.1');

    event.depends('key');
    event.setHeaders({ 'x-test': '1' });

    await expect(event.parent()).resolves.toEqual({});
    expect(event.depends).toHaveBeenCalled();
    expect(event.setHeaders).toHaveBeenCalled();
    expect(event.untrack(() => 'untracked')).toBe('untracked');

    await event.fetch('/api/test');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('createMockRequestEvent sets request method, headers and body', async () => {
    const body = { foo: 'bar' };
    const {
      event: { request },
    } = createMockRequestEvent({
      method: 'POST',
      body,
      pathname: '/api/test',
    });

    expect(request.method).toBe('POST');
    expect(request.headers.get('Content-Type')).toBe('application/json');

    const parsed = await request.json();
    expect(parsed).toEqual(body);
  });
});

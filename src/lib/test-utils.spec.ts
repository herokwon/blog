import { describe, expect, it } from 'vitest';

import {
  createMockD1,
  createMockFetch,
  createMockLoadEvent,
  createMockPost,
  createMockR2,
  createMockRequestEvent,
  stubGlobalFetch,
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
    const {
      db,
      spies: { prepare, bind, first, run, all },
    } = createMockD1();

    new prepare('SELECT 1');
    new bind('x', 1);
    new first();
    new run();
    new all();

    expect(typeof db).toBe('object');

    expect(prepare).toHaveBeenCalled();
    expect(bind).toHaveBeenCalled();
    expect(first).toHaveBeenCalled();
    expect(run).toHaveBeenCalled();
    expect(all).toHaveBeenCalled();
  });

  it('createMockR2 returns a mock R2 and spies are callable', async () => {
    const { bucket, spies } = createMockR2();

    await bucket.get('test-key');
    await bucket.put('test-key', new ArrayBuffer(0));
    await bucket.delete('test-key');

    expect(spies.get).toHaveBeenCalled();
    expect(spies.put).toHaveBeenCalled();
    expect(spies.delete).toHaveBeenCalled();
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

  it('stubGlobalFetch: resolves with JSON (default and custom options)', async () => {
    const defaultPayload = { ok: true, items: [createMockPost()] };
    stubGlobalFetch({
      response: defaultPayload,
    });

    const defaultResp = await fetch('/api/test');

    expect(defaultResp.status).toBe(200);
    expect(defaultResp.headers.get('Content-Type')).toBe('application/json');
    expect(await defaultResp.json()).toEqual(defaultPayload);

    const customPayload = { hello: 'world' };
    stubGlobalFetch({
      response: customPayload,
      options: {
        status: 201,
        headers: { 'Content-Type': 'application/custom' },
      },
    });

    const customResp = await fetch('/api/custom');

    expect(customResp.status).toBe(201);
    expect(customResp.headers.get('Content-Type')).toBe('application/custom');
    expect(await customResp.json()).toEqual(customPayload);
  });

  it('stubGlobalFetch: rejects for boolean and custom error inputs', async () => {
    stubGlobalFetch({
      error: true,
    });
    await expect(fetch('/api/err')).rejects.toThrow('Fetch error');

    const customError = new Error('Custom fetch failure');
    stubGlobalFetch({
      error: customError,
    });
    await expect(fetch('/api/err')).rejects.toThrow('Custom fetch failure');
  });

  it('createMockPendingVideo returns a pending video object with correct properties', () => {
    const file = new File([''], 'video.mp4', { type: 'video/mp4' });
    const blobUrl = URL.createObjectURL(file);
    const pendingVideo = { file, blobUrl };

    expect(pendingVideo).toHaveProperty('file');
    expect(pendingVideo).toHaveProperty('blobUrl');
    expect(pendingVideo.file).toBe(file);
    expect(pendingVideo.blobUrl).toBe(blobUrl);
  });
});

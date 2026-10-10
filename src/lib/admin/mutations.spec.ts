import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminPost } from './contracts';
import { readAdminPost, runMutation, type MutationRequest } from './mutations';

const id = '019a1234-5678-7000-8000-000000000001';
const post: AdminPost = {
  id,
  slug: null,
  title: 'Original',
  body: 'Raw **body**',
  status: 'draft',
  revision: 1,
  created_at: '2026-10-07T00:00:00.000Z',
  updated_at: '2026-10-07T00:00:00.000Z',
  published_at: null,
  deleted_at: null,
};
const save: MutationRequest = {
  kind: 'save',
  id,
  input: { title: 'Edited', expected_revision: 1 },
};
const apiError = (code: string, status: number) =>
  Response.json({ error: { code, message: 'Rejected' } }, { status });

function transport(...responses: (Response | Error)[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const response = responses.shift();
    if (!response) throw new Error('Unexpected request');
    if (response instanceof Error) throw response;
    return response;
  };
  return { fetcher, calls };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('bounded retry and uncertain outcome inspection', () => {
  it.each(['headers', 'body'])(
    'bounds explicit latest-post reload stalled %s without replacing input',
    async phase => {
      vi.useFakeTimers();
      let signal: AbortSignal | undefined;
      const fetcher: typeof fetch = async (_url, init) => {
        signal = init?.signal ?? undefined;
        if (phase === 'headers') return new Promise<Response>(() => {});
        return new Response(
          new ReadableStream({
            start(stream) {
              stream.enqueue(new TextEncoder().encode('{'));
            },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      };
      const pending = readAdminPost(id, fetcher).then(
        () => 'success',
        error => error.name,
      );
      await vi.advanceTimersByTimeAsync(30000);
      expect(await pending).toBe('TimeoutError');
      expect(signal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it('rejects a malformed or mismatched reload rather than replacing the loaded document', async () => {
    const { fetcher } = transport(
      Response.json({ ...post, id: '019a1234-5678-7000-8000-000000000002' }),
    );
    await expect(readAdminPost(id, fetcher)).rejects.toThrow();
  });
  const edited = { ...post, title: 'Edited', revision: 2 };

  it('bounds a stalled request, retry and recovery read with timeouts', async () => {
    vi.useFakeTimers();
    const calls: RequestInit[] = [];
    const fetcher: typeof fetch = async (_url, init) => {
      calls.push(init!);
      return new Promise<Response>(() => {});
    };
    const pending = runMutation(save, fetcher);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(62_000);
    expect(await pending).toMatchObject({
      kind: 'unresolved',
      cause: { kind: 'timeout' },
      recoveryCause: { kind: 'timeout' },
    });
    expect(calls).toHaveLength(3);
    expect(calls.every(call => call.signal?.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('recovers when the success headers arrive but the response body is lost', async () => {
    vi.useFakeTimers();
    const lostBody = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new TypeError('Connection lost'));
        },
      }),
      { status: 200 },
    );
    const { fetcher, calls } = transport(
      lostBody,
      apiError('POST_VERSION_CONFLICT', 409),
      Response.json(edited),
    );
    expect((await finish(save, fetcher)).kind).toBe('observed');
    expect(calls).toHaveLength(3);
  });

  it('times out a stalled response body and inspects after the retry conflict', async () => {
    vi.useFakeTimers();
    const stalled = new Response(new ReadableStream({}), { status: 200 });
    const { fetcher, calls } = transport(
      stalled,
      apiError('POST_VERSION_CONFLICT', 409),
      Response.json(edited),
    );
    const pending = runMutation(save, fetcher);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_202);
    expect(await pending).toMatchObject({ kind: 'observed', post: edited });
    expect(calls[0].init?.signal?.aborted).toBe(true);
    expect(calls).toHaveLength(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps a matching title with a differing submitted body unresolved', async () => {
    vi.useFakeTimers();
    const request: MutationRequest = {
      kind: 'save',
      id,
      input: {
        title: 'Edited',
        body: 'Submitted **body**',
        expected_revision: 1,
      },
    };
    const { fetcher } = transport(
      new TypeError('Lost'),
      apiError('POST_VERSION_CONFLICT', 409),
      Response.json(edited),
    );
    expect(await finish(request, fetcher)).toMatchObject({
      kind: 'unresolved',
      request,
      id,
      post: edited,
    });
  });
  async function finish(request: MutationRequest, fetcher: typeof fetch) {
    const pending = runMutation(request, fetcher);
    await vi.runAllTimersAsync();
    return pending;
  }

  it.each([
    new TypeError('Lost'),
    new DOMException('Timed out', 'TimeoutError'),
    502,
    503,
    504,
  ])('retries eligible failure %s once after jittered delay', async failure => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { fetcher, calls } = transport(
      typeof failure === 'number'
        ? new Response('Gateway', { status: failure })
        : failure,
      Response.json(edited),
    );
    const pending = runMutation(save, fetcher);
    await vi.advanceTimersByTimeAsync(799);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(402);
    expect(await pending).toMatchObject({ kind: 'confirmed', post: edited });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({
      url: calls[0].url,
      init: {
        method: calls[0].init?.method,
        body: calls[0].init?.body,
        headers: calls[0].init?.headers,
      },
    });
  });

  it.each([
    new TypeError('Lost'),
    new DOMException('Timed out', 'TimeoutError'),
    502,
    503,
    504,
    500,
  ])(
    'never retries or automatically inspects uncertain creation %s',
    async failure => {
      vi.useFakeTimers();
      const request: MutationRequest = {
        kind: 'create',
        input: { title: 'A', body: 'B' },
      };
      const { fetcher, calls } = transport(
        typeof failure === 'number'
          ? new Response(null, { status: failure })
          : failure,
      );
      expect(await finish(request, fetcher)).toMatchObject({
        kind: 'unresolved',
        request,
      });
      expect(calls).toHaveLength(1);
    },
  );

  it('preserves frozen original payload and revision despite edits during retry delay', async () => {
    vi.useFakeTimers();
    const input = { title: 'Edited', expected_revision: 1 };
    const request: MutationRequest = { kind: 'save', id, input };
    const { fetcher, calls } = transport(
      new TypeError('Lost'),
      Response.json(edited),
    );
    const pending = runMutation(request, fetcher);
    input.title = 'New unsaved input';
    input.expected_revision = 99;
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result.request).toEqual(save);
    expect(Object.isFrozen(result.request)).toBe(true);
    expect(calls.map(call => call.init?.body)).toEqual([
      '{"title":"Edited","expected_revision":1}',
      '{"title":"Edited","expected_revision":1}',
    ]);
  });

  it('observes a title-only match after lost response and retry conflict without confirming success', async () => {
    vi.useFakeTimers();
    const current = { ...edited, body: 'Another edit', revision: 7 };
    const { fetcher, calls } = transport(
      new TypeError('Lost'),
      apiError('POST_VERSION_CONFLICT', 409),
      Response.json(current),
    );
    expect(await finish(save, fetcher)).toEqual({
      kind: 'observed',
      request: save,
      id,
      post: current,
    });
    expect(calls.map(call => call.init?.method)).toEqual([
      'PATCH',
      'PATCH',
      'GET',
    ]);
    expect(calls[2].init).toMatchObject({
      cache: 'no-store',
      credentials: 'same-origin',
    });
  });

  it('returns unresolved with the differing current post without silently changing revision', async () => {
    vi.useFakeTimers();
    const { fetcher, calls } = transport(
      new TypeError('Lost'),
      apiError('POST_VERSION_CONFLICT', 409),
      Response.json({ ...post, revision: 7 }),
    );
    expect(await finish(save, fetcher)).toMatchObject({
      kind: 'unresolved',
      request: save,
      id,
      post: { ...post, revision: 7 },
      cause: { kind: 'http', status: 409 },
    });
    expect(calls).toHaveLength(3);
  });

  it.each([
    new TypeError('Read failed'),
    new Response(null, { status: 404 }),
    Response.json({ id }),
    Response.json({ ...edited, id: '019a1234-5678-7000-8000-000000000002' }),
  ])('keeps failure or invalid recovery read unresolved', async failedRead => {
    vi.useFakeTimers();
    const { fetcher, calls } = transport(
      new TypeError('Lost'),
      new TypeError('Lost again'),
      failedRead,
    );
    expect(await finish(save, fetcher)).toMatchObject({
      kind: 'unresolved',
      request: save,
      id,
      recoveryCause: expect.any(Object),
    });
    expect(calls).toHaveLength(3);
  });

  it.each([
    ['publish', { status: 'published', deleted_at: null }],
    ['archive', { status: 'archived', deleted_at: null }],
    ['delete', { deleted_at: '2026-10-07T01:00:00.000Z' }],
    ['restore', { deleted_at: null }],
  ] as const)(
    'observes %s lifecycle target after two lost responses',
    async (kind, fields) => {
      vi.useFakeTimers();
      const request: MutationRequest = {
        kind,
        id,
        input: { expected_revision: 1 },
      };
      const current = { ...post, ...fields, revision: 2 };
      const { fetcher, calls } = transport(
        new TypeError('Lost'),
        new TypeError('Lost again'),
        Response.json(current),
      );
      expect(await finish(request, fetcher)).toEqual({
        kind: 'observed',
        request,
        id,
        post: current,
      });
      expect(calls).toHaveLength(3);
    },
  );

  it('does not mistake a published but deleted row for observed publication', async () => {
    vi.useFakeTimers();
    const request: MutationRequest = {
      kind: 'publish',
      id,
      input: { expected_revision: 1 },
    };
    const { fetcher } = transport(
      new TypeError('Lost'),
      new TypeError('Lost again'),
      Response.json({
        ...post,
        status: 'published',
        deleted_at: '2026-10-07T01:00:00.000Z',
      }),
    );
    expect((await finish(request, fetcher)).kind).toBe('unresolved');
  });

  it.each([
    new Response('Server error', { status: 500 }),
    apiError('INTERNAL_ERROR', 500),
  ])('keeps 500 uncertain without retry or recovery GET', async response => {
    vi.useFakeTimers();
    const { fetcher, calls } = transport(response);
    expect(await finish(save, fetcher)).toMatchObject({
      kind: 'unresolved',
      cause: { kind: 'http', status: 500 },
    });
    expect(calls).toHaveLength(1);
  });

  it('uses recovery after a gateway failure and a definite retry rejection instead of claiming original failure', async () => {
    vi.useFakeTimers();
    const { fetcher, calls } = transport(
      new Response('Gateway', { status: 502 }),
      apiError('INVALID_POST_STATE', 409),
      Response.json(edited),
    );
    expect((await finish(save, fetcher)).kind).toBe('observed');
    expect(calls).toHaveLength(3);
  });
});

describe('confirmed mutation responses', () => {
  it('creates once and returns the confirmed created row and immutable input', async () => {
    const request: MutationRequest = {
      kind: 'create',
      input: { title: 'Original', body: 'Raw **body**' },
    };
    const { fetcher, calls } = transport(Response.json(post, { status: 201 }));
    const result = await runMutation(request, fetcher);
    expect(result).toEqual({ kind: 'confirmed', request, id, post });
    expect(calls).toEqual([
      {
        url: '/api/admin/posts',
        init: expect.objectContaining({
          method: 'POST',
          body: '{"title":"Original","body":"Raw **body**"}',
        }),
      },
    ]);
    expect(result.request).not.toBe(request);
    expect(Object.isFrozen(result.request.input)).toBe(true);
  });

  it.each(['save', 'publish', 'archive', 'restore'] as const)(
    'sends %s to its API method/path',
    async kind => {
      const request: MutationRequest =
        kind === 'save' ? save : { kind, id, input: { expected_revision: 1 } };
      const { fetcher, calls } = transport(Response.json(post));
      expect((await runMutation(request, fetcher)).kind).toBe('confirmed');
      expect(calls[0]).toEqual({
        url:
          kind === 'save'
            ? `/api/admin/posts/${id}`
            : `/api/admin/posts/${id}/${kind}`,
        init: expect.objectContaining({
          method: kind === 'save' ? 'PATCH' : 'POST',
          body: JSON.stringify(request.input),
        }),
      });
    },
  );

  it('confirms an empty DELETE 204 without parsing JSON', async () => {
    const request: MutationRequest = {
      kind: 'delete',
      id,
      input: { expected_revision: 1 },
    };
    const { fetcher, calls } = transport(new Response(null, { status: 204 }));
    expect(await runMutation(request, fetcher)).toEqual({
      kind: 'confirmed',
      request,
      id,
    });
    expect(calls[0].init?.method).toBe('DELETE');
  });

  it.each([
    ['VALIDATION_ERROR', 400],
    ['UNAUTHORIZED', 401],
    ['FORBIDDEN', 403],
    ['POST_NOT_FOUND', 404],
    ['INVALID_POST_STATE', 409],
  ] as const)(
    'preserves definite %s rejection without retries or recovery reads',
    async (code, status) => {
      const { fetcher, calls } = transport(apiError(code, status));
      expect(await runMutation(save, fetcher)).toEqual({
        kind: 'rejected',
        request: save,
        id,
        status,
        error: { code, message: 'Rejected' },
      });
      expect(calls).toHaveLength(1);
    },
  );

  it('keeps ordinary version conflict separate from uncertain outcomes', async () => {
    const { fetcher, calls } = transport(
      apiError('POST_VERSION_CONFLICT', 409),
    );
    expect(await runMutation(save, fetcher)).toEqual({
      kind: 'conflict',
      request: save,
      id,
      status: 409,
      error: { code: 'POST_VERSION_CONFLICT', message: 'Rejected' },
    });
    expect(calls).toHaveLength(1);
  });

  it('does not call a malformed success a confirmed mutation', async () => {
    const { fetcher, calls } = transport(Response.json({ id }));
    expect((await runMutation(save, fetcher)).kind).toBe('unresolved');
    expect(calls).toHaveLength(1);
  });
});

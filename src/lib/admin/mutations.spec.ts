import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminPost } from './contracts';
import { runMutation, type MutationRequest } from './mutations';

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

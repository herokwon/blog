import { describe, expect, it } from 'vitest';
import {
  buildSaveInput,
  createAuthoringState,
  submitAuthoring,
} from './authoring';
import type { AdminPost } from './contracts';

const post: AdminPost = {
  id: '019bfe70-0000-7000-8000-000000000001',
  title: 'Original',
  body: '**original**\n',
  slug: null,
  status: 'draft',
  revision: 3,
  created_at: '2026-10-08T00:00:00.000Z',
  updated_at: '2026-10-08T00:00:00.000Z',
  published_at: null,
  deleted_at: null,
};
function responses(...values: Response[]) {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    requests.push({ url, init });
    const response = values.shift();
    if (!response) throw new Error('Unexpected request');
    return response;
  }) as typeof fetch;
  return { fetcher, requests };
}
const json = (body: unknown, status = 200) => Response.json(body, { status });

describe('authoring requests and stage outcomes', () => {
  it.each([false, true])(
    'keeps the original base when title-only recovery observes a changed body (newer input: %s)',
    async newer => {
      const state = createAuthoringState(post);
      state.input.title = 'Submitted';
      if (newer) {
        await submitAuthoring(
          state,
          'save',
          responses(
            new Response(null, { status: 500 }),
            new Response(null, { status: 500 }),
            new Response(null, { status: 500 }),
          ).fetcher,
        );
        state.input = { title: 'Newer title', body: 'Newer local body' };
        state.bodyDirty = true;
      }
      const recovery = responses(
        new Response(null, { status: 503 }),
        json(
          { error: { code: 'POST_VERSION_CONFLICT', message: 'Changed' } },
          409,
        ),
        json({
          ...post,
          title: 'Submitted',
          body: 'Concurrent body',
          revision: 5,
        }),
      );
      await submitAuthoring(state, newer ? 'retry' : 'save', recovery.fetcher);
      expect(state.result?.kind).toBe('conflict');
      expect(state.base).toEqual(post);
      expect(state.input.body).toBe(newer ? 'Newer local body' : post.body);
      expect(buildSaveInput(state)).toEqual({
        title: newer ? 'Newer title' : 'Submitted',
        expected_revision: 3,
        ...(newer ? { body: 'Newer local body' } : {}),
      });
      expect(state.destination).toBeNull();
    },
  );
  it('reflects observed publication without a failure or success notice, retaining the created ID', async () => {
    const state = createAuthoringState();
    state.input = { title: post.title, body: post.body };
    const published = {
      ...post,
      status: 'published',
      revision: 4,
      slug: 'original',
      published_at: post.created_at,
    };
    const { fetcher } = responses(
      json(post, 201),
      new Response(null, { status: 503 }),
      json(
        { error: { code: 'POST_VERSION_CONFLICT', message: 'Changed' } },
        409,
      ),
      json(published),
    );
    await submitAuthoring(state, 'publish', fetcher);
    expect(state.result?.kind).toBe('observed');
    expect(state.destination).toBe(`/admin/posts/${post.id}/edit`);
    expect(state.base).toEqual(published);
  });
  it('retains a known creation and saves newer input to that ID instead of creating or publishing again', async () => {
    const state = createAuthoringState();
    state.input = { title: post.title, body: post.body };
    let finish!: (value: Response) => void;
    const running = submitAuthoring(
      state,
      'save',
      (() =>
        new Promise<Response>(resolve => {
          finish = resolve;
        })) as typeof fetch,
    );
    state.input = { title: 'Newer creation input', body: 'Newer body' };
    finish(json(post, 201));
    await running;
    expect(state.destination).toBeNull();
    const next = responses(
      json({
        ...post,
        title: 'Newer creation input',
        body: 'Newer body',
        revision: 4,
      }),
    );
    await submitAuthoring(state, 'save', next.fetcher);
    expect(next.requests[0].url).toBe(`/api/admin/posts/${post.id}`);
    expect(next.requests[0].init?.method).toBe('PATCH');
    expect(JSON.parse(next.requests[0].init!.body as string)).toEqual({
      title: 'Newer creation input',
      body: 'Newer body',
      expected_revision: 3,
    });
  });
  it('omits unchanged Markdown during a title-only save', () => {
    const state = createAuthoringState(post);
    state.input.title = 'Changed';
    expect(buildSaveInput(state)).toEqual({
      title: 'Changed',
      expected_revision: 3,
    });
  });
  it('includes explicitly edited body without normalizing its source', () => {
    const state = createAuthoringState(post);
    state.bodyDirty = true;
    state.input.body = '  ';
    expect(buildSaveInput(state)).toEqual({
      title: 'Original',
      body: '  ',
      expected_revision: 3,
    });
  });
  it('creates a draft once and navigates to its edit page', async () => {
    const state = createAuthoringState();
    state.input = { title: 'Original', body: post.body };
    const { fetcher, requests } = responses(json(post, 201));
    await submitAuthoring(state, 'save', fetcher);
    expect(state.destination).toBe(`/admin/posts/${post.id}/edit`);
    expect(state.created?.id).toBe(post.id);
    expect(state.pending).toBe(false);
    expect(requests.map(r => r.url)).toEqual(['/api/admin/posts']);
  });
  it('publishes only the confirmed created ID and revision', async () => {
    const state = createAuthoringState();
    state.input = { title: post.title, body: post.body };
    const { fetcher, requests } = responses(
      json(post, 201),
      json({
        ...post,
        status: 'published',
        revision: 4,
        slug: 'original',
        published_at: post.created_at,
      }),
    );
    await submitAuthoring(state, 'publish', fetcher);
    expect(state.destination).toBe(`/admin/posts/${post.id}`);
    expect(JSON.parse(requests[1].init!.body as string)).toEqual({
      expected_revision: 3,
    });
  });
  it('keeps the confirmed draft when publication fails and never creates it again', async () => {
    const state = createAuthoringState();
    state.input = { title: post.title, body: post.body };
    const { fetcher, requests } = responses(
      json(post, 201),
      json({ error: { code: 'FORBIDDEN', message: 'Denied' } }, 403),
    );
    await submitAuthoring(state, 'publish', fetcher);
    expect(state.created?.id).toBe(post.id);
    expect(state.destination).toBe(
      `/admin/posts/${post.id}/edit?publication=failed`,
    );
    expect(state.result?.request.kind).toBe('publish');
    expect(requests).toHaveLength(2);
  });
  it('keeps unknown creation input without automatic retry or navigation', async () => {
    const state = createAuthoringState();
    state.input = { title: post.title, body: post.body };
    const { fetcher, requests } = responses(
      new Response(null, { status: 503 }),
    );
    await submitAuthoring(state, 'save', fetcher);
    expect(state.result?.kind).toBe('unresolved');
    expect(state.destination).toBeNull();
    expect(state.input).toEqual({ title: post.title, body: post.body });
    expect(requests).toHaveLength(1);
  });
  it('ordinary conflict preserves input and the entire loaded base', async () => {
    const state = createAuthoringState(post);
    state.input.title = 'Local';
    const { fetcher } = responses(
      json(
        { error: { code: 'POST_VERSION_CONFLICT', message: 'Changed' } },
        409,
      ),
    );
    await submitAuthoring(state, 'save', fetcher);
    expect(state.result?.kind).toBe('conflict');
    expect(state.base).toEqual(post);
    expect(state.input.title).toBe('Local');
    expect(state.destination).toBeNull();
  });
  it('manual retry preserves the original revision and newer input without navigation', async () => {
    const state = createAuthoringState(post);
    state.input.title = 'Submitted';
    const first = responses(new Response(null, { status: 500 }));
    await submitAuthoring(state, 'save', first.fetcher);
    state.input.title = 'Newer';
    const retry = responses(json({ ...post, title: 'Submitted', revision: 4 }));
    await submitAuthoring(state, 'retry', retry.fetcher);
    expect(JSON.parse(retry.requests[0].init!.body as string)).toEqual({
      title: 'Submitted',
      expected_revision: 3,
    });
    expect(state.input.title).toBe('Newer');
    expect(state.destination).toBeNull();
    expect(state.base?.title).toBe('Submitted');
    expect(state.pending).toBe(false);
  });
  it('locks and prevents duplicate submissions until the response settles', async () => {
    const state = createAuthoringState(post);
    let finish!: (value: Response) => void;
    const fetcher = (() =>
      new Promise<Response>(resolve => {
        finish = resolve;
      })) as typeof fetch;
    const running = submitAuthoring(state, 'save', fetcher);
    expect(state.pending).toBe(true);
    await submitAuthoring(state, 'save', fetcher);
    finish(json(post));
    await running;
    expect(state.pending).toBe(false);
    expect(state.destination).toBe(`/admin/posts/${post.id}`);
  });
});

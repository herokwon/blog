import type { AdminPost } from '$lib/admin/contracts';
import { expect } from '@playwright/test';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { assertLocalOrigin, test } from '../../../tests/admin/local-d1';

const collection = '/api/admin/posts';
async function create(
  api: APIRequestContext,
  title = 'Hello World',
): Promise<AdminPost> {
  const response = await api.post(collection, {
    data: { title, body: '# raw\n\n' },
  });
  expect(response.status()).toBe(201);
  return response.json();
}
async function failure(response: APIResponse, status: number, code: string) {
  expect(response.status()).toBe(status);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(await response.json()).toMatchObject({ error: { code } });
}

test.beforeEach(async ({ localD1 }) => {
  await localD1.db.prepare('DELETE FROM posts').run();
});

test('creates a UUIDv7 draft and returns the direct persisted representation', async ({
  localD1,
  playwright,
}) => {
  const request = await playwright.request.newContext({
    baseURL: localD1.origin,
    extraHTTPHeaders: {
      Origin: localD1.origin,
      'Cf-Access-Jwt-Assertion': await localD1.token(),
    },
  });
  try {
    const response = await request.post('/api/admin/posts', {
      data: { title: ' Raw title ', body: ' ' },
    });
    expect(response.status()).toBe(201);
    expect(response.headers()['cache-control']).toBe('no-store');
    const post = await response.json();
    expect(post).toMatchObject({
      title: ' Raw title ',
      body: ' ',
      status: 'draft',
      revision: 1,
      slug: null,
      published_at: null,
      deleted_at: null,
    });
    expect(post.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(
      await (await request.get(`/api/admin/posts/${post.id}`)).json(),
    ).toEqual(post);
  } finally {
    await request.dispose();
  }
});

test('all lifecycle endpoints preserve publication identity and return empty deletion responses', async ({
  api,
}) => {
  const draft = await create(api);
  const path = `${collection}/${draft.id}`;
  await failure(
    await api.post(`${path}/archive`, { data: { expected_revision: 1 } }),
    409,
    'INVALID_POST_STATE',
  );
  const publishedResponse = await api.post(`${path}/publish`, {
    data: { expected_revision: 1 },
  });
  expect(publishedResponse.status()).toBe(200);
  const published = await publishedResponse.json();
  expect(published).toMatchObject({
    status: 'published',
    revision: 2,
    slug: 'hello-world',
  });
  expect(
    await (
      await api.post(`${path}/publish`, { data: { expected_revision: 1 } })
    ).json(),
  ).toEqual(published);
  const archived = await (
    await api.post(`${path}/archive`, { data: { expected_revision: 2 } })
  ).json();
  expect(archived).toMatchObject({ status: 'archived', revision: 3 });
  const deletedResponse = await api.delete(path, {
    data: { expected_revision: 3 },
  });
  expect(deletedResponse.status()).toBe(204);
  expect(await deletedResponse.text()).toBe('');
  expect(deletedResponse.headers()['cache-control']).toBe('no-store');
  const deleted = await (await api.get(path)).json();
  expect(deleted.deleted_at).not.toBeNull();
  expect(deleted.revision).toBe(4);
  expect(
    (await api.delete(path, { data: { expected_revision: 1 } })).status(),
  ).toBe(204);
  expect(await (await api.get(path)).json()).toEqual(deleted);
  for (const command of ['publish', 'archive'])
    await failure(
      await api.post(`${path}/${command}`, { data: { expected_revision: 4 } }),
      409,
      'INVALID_POST_STATE',
    );
  await failure(
    await api.patch(path, {
      data: { expected_revision: 4, title: 'Rejected' },
    }),
    409,
    'INVALID_POST_STATE',
  );
  const restored = await (
    await api.post(`${path}/restore`, { data: { expected_revision: 4 } })
  ).json();
  expect(restored).toMatchObject({
    status: 'archived',
    revision: 5,
    deleted_at: null,
  });
  expect(
    await (
      await api.post(`${path}/restore`, { data: { expected_revision: 1 } })
    ).json(),
  ).toEqual(restored);
  const republished = await (
    await api.post(`${path}/publish`, { data: { expected_revision: 5 } })
  ).json();
  expect(republished).toMatchObject({
    slug: published.slug,
    published_at: published.published_at,
    revision: 6,
  });
});

test('PATCH preserves omitted raw body and matching no-op metadata while stale writes conflict', async ({
  api,
}) => {
  const draft = await create(api);
  const path = `${collection}/${draft.id}`;
  const changed = await (
    await api.patch(path, { data: { expected_revision: 1, title: 'Changed' } })
  ).json();
  expect(changed).toMatchObject({
    body: draft.body,
    revision: 2,
    title: 'Changed',
  });
  expect(
    await (
      await api.patch(path, {
        data: { expected_revision: 2, title: 'Changed' },
      })
    ).json(),
  ).toEqual(changed);
  await failure(
    await api.patch(path, { data: { expected_revision: 1, title: 'Changed' } }),
    409,
    'POST_VERSION_CONFLICT',
  );
  expect(await (await api.get(path)).json()).toEqual(changed);
});

test('strict bodies, UUIDs and query parameters reject without changing persisted data', async ({
  api,
}) => {
  const draft = await create(api);
  const path = `${collection}/${draft.id}`;
  for (const data of [
    { title: 'A' },
    { title: ' ', body: 'A' },
    { title: 'A', body: '' },
    { title: 'A', body: 'A', status: 'published' },
    null,
    [],
  ])
    await failure(
      await api.post(collection, { data }),
      400,
      'VALIDATION_ERROR',
    );
  await failure(
    await api.post(collection, {
      data: '{',
      headers: { 'Content-Type': 'application/json' },
    }),
    400,
    'VALIDATION_ERROR',
  );
  for (const data of [
    { expected_revision: 1 },
    { expected_revision: 0, title: 'A' },
    { expected_revision: 1, body: '' },
    { expected_revision: 1, title: 'A', slug: 'bad' },
  ])
    await failure(await api.patch(path, { data }), 400, 'VALIDATION_ERROR');
  for (const command of ['publish', 'archive', 'restore']) {
    for (const data of [
      {},
      { expected_revision: 1, title: 'A' },
      { expected_revision: 1.5 },
    ])
      await failure(
        await api.post(`${path}/${command}`, { data }),
        400,
        'VALIDATION_ERROR',
      );
  }
  await failure(await api.delete(path, { data: {} }), 400, 'VALIDATION_ERROR');
  for (const id of ['invalid', '00000000-0000-4000-8000-000000000000'])
    await failure(
      await api.get(`${collection}/${id}`),
      400,
      'VALIDATION_ERROR',
    );
  const absent = `${collection}/01999999-0000-7000-8000-000000000001`;
  await failure(await api.get(absent), 404, 'POST_NOT_FOUND');
  await failure(
    await api.patch(absent, { data: { expected_revision: 1, title: 'A' } }),
    404,
    'POST_NOT_FOUND',
  );
  await failure(
    await api.delete(absent, { data: { expected_revision: 1 } }),
    404,
    'POST_NOT_FOUND',
  );
  for (const command of ['publish', 'archive', 'restore'])
    await failure(
      await api.post(`${absent}/${command}`, {
        data: { expected_revision: 1 },
      }),
      404,
      'POST_NOT_FOUND',
    );
  for (const query of [
    'page=0',
    'limit=101',
    'status=All',
    'cursor=a',
    'page=1&page=2',
    'page=9007199254740991&limit=100',
  ])
    await failure(
      await api.get(`${collection}?${query}`),
      400,
      'VALIDATION_ERROR',
    );
  await failure(
    await api.get(`${collection}/trash?status=draft`),
    400,
    'VALIDATION_ERROR',
  );
  expect(await (await api.get(path)).json()).toEqual(draft);
  expect((await (await api.get(collection)).json()).totalItems).toBe(1);
});

test('normal and trash pagination use matching scopes and deterministic tied ordering', async ({
  api,
  localD1,
}) => {
  const first = await create(api, 'First');
  const second = await create(api, 'Second');
  const third = await create(api, 'Third');
  await api.post(`${collection}/${third.id}/publish`, {
    data: { expected_revision: 1 },
  });
  await api.delete(`${collection}/${first.id}`, {
    data: { expected_revision: 1 },
  });
  await localD1.db
    .prepare("UPDATE posts SET updated_at = '2026-10-07T00:00:00.000Z'")
    .run();
  const page = await (await api.get(`${collection}?limit=1`)).json();
  expect(page).toMatchObject({
    page: 1,
    limit: 1,
    totalItems: 2,
    totalPages: 2,
  });
  expect(page.items[0].id).toBe([second.id, third.id].sort().reverse()[0]);
  expect(page.items[0]).not.toHaveProperty('body');
  expect(
    (await (await api.get(`${collection}?status=published`)).json()).items.map(
      (post: AdminPost) => post.id,
    ),
  ).toEqual([third.id]);
  const trash = await (await api.get(`${collection}/trash`)).json();
  expect(trash.totalItems).toBe(1);
  expect(trash.items[0].id).toBe(first.id);
  expect(await (await api.get(`${collection}?page=9&limit=1`)).json()).toEqual({
    items: [],
    page: 9,
    limit: 1,
    totalItems: 2,
    totalPages: 2,
  });
  await api.delete(`${collection}/${second.id}`, {
    data: { expected_revision: 1 },
  });
  expect(await (await api.get(`${collection}?page=2&limit=1`)).json()).toEqual({
    items: [],
    page: 2,
    limit: 1,
    totalItems: 1,
    totalPages: 1,
  });
});

test('actual D1 permits one concurrent revision change and resolves publication slug collisions', async ({
  api,
}) => {
  const draft = await create(api);
  const path = `${collection}/${draft.id}`;
  const saves = await Promise.all(
    ['One', 'Two'].map(title =>
      api.patch(path, { data: { expected_revision: 1, title } }),
    ),
  );
  expect(saves.map(response => response.status()).sort()).toEqual([200, 409]);
  expect((await (await api.get(path)).json()).revision).toBe(2);
  const drafts = await Promise.all([
    create(api, 'Same Slug'),
    create(api, 'Same Slug'),
  ]);
  const publications = await Promise.all(
    drafts.map(post =>
      api.post(`${collection}/${post.id}/publish`, {
        data: { expected_revision: 1 },
      }),
    ),
  );
  expect(publications.map(response => response.status())).toEqual([200, 200]);
  const posts = await Promise.all(
    publications.map(response => response.json()),
  );
  expect(posts.map(post => post.slug).sort()).toEqual([
    'same-slug',
    'same-slug-2',
  ]);
});

test('failed first publication is atomic and unexpected D1 failures stay private', async ({
  api,
  localD1,
}) => {
  const draft = await create(api, '!!!');
  await failure(
    await api.post(`${collection}/${draft.id}/publish`, {
      data: { expected_revision: 1 },
    }),
    400,
    'VALIDATION_ERROR',
  );
  expect(await (await api.get(`${collection}/${draft.id}`)).json()).toEqual(
    draft,
  );
  const valid = await create(api);
  await localD1.db
    .prepare(
      "CREATE TRIGGER fail_publication BEFORE UPDATE ON posts WHEN NEW.status = 'published' BEGIN SELECT RAISE(ABORT, 'private-db-detail'); END",
    )
    .run();
  try {
    const response = await api.post(`${collection}/${valid.id}/publish`, {
      data: { expected_revision: 1 },
    });
    await failure(response, 500, 'INTERNAL_ERROR');
    expect(await response.text()).not.toContain('private-db-detail');
    expect(await (await api.get(`${collection}/${valid.id}`)).json()).toEqual(
      valid,
    );
  } finally {
    await localD1.db.prepare('DROP TRIGGER fail_publication').run();
  }
});

test('concurrent deletion and editing have one winner and concurrent restores converge', async ({
  api,
}) => {
  const draft = await create(api);
  const path = `${collection}/${draft.id}`;
  const [saved, deleted] = await Promise.all([
    api.patch(path, { data: { expected_revision: 1, title: 'Edited' } }),
    api.delete(path, { data: { expected_revision: 1 } }),
  ]);
  expect([saved.status(), deleted.status()]).toEqual(
    saved.status() === 200 ? [200, 409] : [409, 204],
  );
  const current = await (await api.get(path)).json();
  expect(current.revision).toBe(2);
  expect(current.title).toBe(saved.status() === 200 ? 'Edited' : draft.title);
  if (current.deleted_at === null)
    expect(
      (await api.delete(path, { data: { expected_revision: 2 } })).status(),
    ).toBe(204);
  const beforeRestore = await (await api.get(path)).json();
  const responses = await Promise.all(
    [1, 2].map(() =>
      api.post(`${path}/restore`, {
        data: { expected_revision: beforeRestore.revision },
      }),
    ),
  );
  expect(responses.map(response => response.status())).toEqual([200, 200]);
  const restored = await (await api.get(path)).json();
  expect(restored).toMatchObject({
    deleted_at: null,
    revision: beforeRestore.revision + 1,
  });
  for (const response of responses)
    expect(await response.json()).toEqual(restored);
});

test('authentication and trusted origin failures precede validation and do not write', async ({
  api,
  localD1,
}) => {
  const draft = await create(api);
  for (const assertion of ['', 'forged'])
    await failure(
      await api.post(collection, {
        headers: {
          'Cf-Access-Jwt-Assertion': assertion,
          Origin: 'https://untrusted.example',
        },
        data: {},
      }),
      401,
      'UNAUTHORIZED',
    );
  await failure(
    await api.post(collection, {
      headers: {
        'Cf-Access-Jwt-Assertion': await localD1.token('other@example.test'),
      },
      data: {},
    }),
    403,
    'FORBIDDEN',
  );
  for (const origin of ['', 'https://untrusted.example', `${localD1.origin}/`])
    await failure(
      await api.patch(`${collection}/${draft.id}`, {
        headers: { Origin: origin },
        data: { expected_revision: 1, title: 'Rejected' },
      }),
      403,
      'FORBIDDEN',
    );
  const candidate = await localD1.candidateFetch(collection, {
    title: 'Rejected',
    body: 'Rejected',
  });
  expect(candidate.status).toBe(403);
  expect(await candidate.json()).toMatchObject({
    error: { code: 'FORBIDDEN' },
  });
  expect(candidate.headers.get('cache-control')).toBe('no-store');
  expect(await (await api.get(`${collection}/${draft.id}`)).json()).toEqual(
    draft,
  );
  expect((await (await api.get(collection)).json()).totalItems).toBe(1);
});

test('Admin canonical redirects authenticate first and remain uncached', async ({
  api,
}) => {
  for (const path of [`${collection}/?page=1`, `${collection}/trash/`]) {
    await failure(
      await api.get(path, {
        headers: { 'Cf-Access-Jwt-Assertion': '' },
        maxRedirects: 0,
      }),
      401,
      'UNAUTHORIZED',
    );
    const redirect = await api.get(path, { maxRedirects: 0 });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers()['cache-control']).toBe('no-store');
    expect(redirect.headers().location).toBe(
      path.replace('/?', '?').replace(/\/$/, ''),
    );
  }
  await failure(
    await api.post(`${collection}/`, {
      headers: { Origin: '' },
      data: {},
      maxRedirects: 0,
    }),
    403,
    'FORBIDDEN',
  );
});

test('the local fixture refuses production and candidate network origins', () => {
  for (const origin of [
    'https://blog.example',
    'https://version-blog.workers.dev',
    'http://127.0.0.1.example',
    'http://localhost/',
  ])
    expect(() => assertLocalOrigin(origin)).toThrow();
  expect(() => assertLocalOrigin('http://127.0.0.1:1234')).not.toThrow();
});

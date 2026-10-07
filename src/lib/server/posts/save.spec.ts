import { type PostStatus } from '$lib/admin/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqliteD1 } from '../../../../tests/admin/sqlite-d1';
import { getDb, type BlogDb } from '../db';
import { posts } from '../db/schema';
import { savePost } from './mutate';
import { getPost } from './read';

let fixture: ReturnType<typeof createSqliteD1>;
let db: BlogDb;
const stamp = '2026-10-01T00:00:00.000Z';
const now = '2026-10-07T06:00:00.000Z';
const id = '019a0000-0000-7000-8000-000000000001';
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(now));
  fixture = createSqliteD1();
  db = getDb(fixture.binding);
});
afterEach(() => {
  fixture?.dispose();
  vi.useRealTimers();
});
async function seed(status: PostStatus = 'draft', deleted = false) {
  await db.insert(posts).values({
    id,
    title: 'Original title',
    body: '  raw\n',
    status,
    slug: status === 'draft' ? null : 'original',
    published_at: status === 'draft' ? null : stamp,
    created_at: stamp,
    updated_at: stamp,
    deleted_at: deleted ? stamp : null,
    revision: 3,
  });
  return (await getPost(db, id))!;
}
async function expectRejectedUnchanged(
  operation: Promise<unknown>,
  code: string,
  before: unknown,
) {
  await expect(operation).rejects.toMatchObject({ code });
  expect(await getPost(db, id)).toEqual(before);
}

describe('revision-safe saves', () => {
  it.each([
    { expected_revision: 0, title: 'x' },
    { expected_revision: 3 },
    { expected_revision: 3, title: ' ' },
    { expected_revision: 3, body: '' },
    { expected_revision: 3, title: 'x', slug: 'forged' },
  ])('rejects invalid save input without changing the row', async input => {
    const before = await seed();
    await expectRejectedUnchanged(
      savePost(db, id, input),
      'VALIDATION_ERROR',
      before,
    );
  });
  it.each(['draft', 'published', 'archived'] as const)(
    'saves %s without changing publication identity or omitted Markdown',
    async status => {
      const before = await seed(status);
      const after = await savePost(db, id, {
        title: 'Changed',
        expected_revision: 3,
      });
      expect(after).toEqual({
        ...before,
        title: 'Changed',
        revision: 4,
        updated_at: now,
      });
    },
  );
  it('preserves title on a body-only save and applies title and body together', async () => {
    const before = await seed();
    const after = await savePost(db, id, { body: '   ', expected_revision: 3 });
    expect(after).toEqual({
      ...before,
      body: '   ',
      revision: 4,
      updated_at: now,
    });
    expect(
      await savePost(db, id, {
        title: 'Next',
        body: 'Next body',
        expected_revision: 4,
      }),
    ).toMatchObject({ title: 'Next', body: 'Next body', revision: 5 });
  });
  it('keeps matching no-op saves unchanged but rejects stale no-op and changing saves', async () => {
    const before = await seed();
    expect(
      await savePost(db, id, {
        title: before.title,
        body: before.body,
        expected_revision: 3,
      }),
    ).toEqual(before);
    await expectRejectedUnchanged(
      savePost(db, id, { title: before.title, expected_revision: 2 }),
      'POST_VERSION_CONFLICT',
      before,
    );
    await expectRejectedUnchanged(
      savePost(db, id, { body: 'changed', expected_revision: 2 }),
      'POST_VERSION_CONFLICT',
      before,
    );
  });
  it.each(['draft', 'published', 'archived'] as const)(
    'rejects editing deleted %s even with stale revision',
    async status => {
      const before = await seed(status, true);
      await expectRejectedUnchanged(
        savePost(db, id, { title: 'Changed', expected_revision: 2 }),
        'INVALID_POST_STATE',
        before,
      );
    },
  );
  it('allows only one competing save with the same revision', async () => {
    await seed();
    const results = await Promise.allSettled([
      savePost(db, id, { title: 'A', expected_revision: 3 }),
      savePost(db, id, { title: 'B', expected_revision: 3 }),
    ]);
    expect(
      results.filter(result => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected')).toMatchObject({
      reason: { code: 'POST_VERSION_CONFLICT' },
    });
    expect(await getPost(db, id)).toMatchObject({ revision: 4 });
  });
});

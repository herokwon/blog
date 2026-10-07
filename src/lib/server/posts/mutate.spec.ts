import { type PostCommand, type PostStatus } from '$lib/admin/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqliteD1 } from '../../../../tests/admin/sqlite-d1';
import { getDb, type BlogDb } from '../db';
import { posts } from '../db/schema';
import { commandPost, createPost, savePost } from './mutate';
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

const transitions: [PostCommand, PostStatus, boolean, string][] = [
  ['publish', 'draft', false, 'published'],
  ['publish', 'archived', false, 'published'],
  ['publish', 'published', false, 'noop'],
  ['archive', 'published', false, 'archived'],
  ['archive', 'archived', false, 'noop'],
  ['archive', 'draft', false, 'invalid'],
  ...(['draft', 'published', 'archived'] as const).flatMap(
    status =>
      [
        ['delete', status, false, 'deleted'],
        ['delete', status, true, 'noop'],
        ['restore', status, true, 'restored'],
        ['restore', status, false, 'noop'],
        ['publish', status, true, 'invalid'],
        ['archive', status, true, 'invalid'],
      ] as [PostCommand, PostStatus, boolean, string][],
  ),
];
describe('atomic lifecycle transitions', () => {
  it('validates revisions even for already-satisfied commands', async () => {
    const before = await seed('published');
    await expectRejectedUnchanged(
      commandPost(db, id, 'publish', { expected_revision: 0 }),
      'VALIDATION_ERROR',
      before,
    );
  });
  it.each(transitions)(
    '%s on %s deleted=%s yields %s',
    async (command, status, deleted, outcome) => {
      const before = await seed(status, deleted);
      if (outcome === 'invalid') {
        await expectRejectedUnchanged(
          commandPost(db, id, command, { expected_revision: 3 }),
          'INVALID_POST_STATE',
          before,
        );
        return;
      }
      const after = await commandPost(db, id, command, {
        expected_revision: 3,
      });
      if (outcome === 'noop') {
        expect(after).toEqual(before);
        return;
      }
      expect(after).toEqual({
        ...before,
        revision: 4,
        updated_at: now,
        status:
          outcome === 'published' || outcome === 'archived' ? outcome : status,
        deleted_at: outcome === 'deleted' ? now : null,
        slug:
          command === 'publish' && status === 'draft'
            ? 'original-title'
            : before.slug,
        published_at:
          command === 'publish' && status === 'draft'
            ? now
            : before.published_at,
      });
    },
  );
  it.each(transitions.filter(row => row[3] !== 'invalid' && row[3] !== 'noop'))(
    'rejects stale changing %s on %s deleted=%s',
    async (command, status, deleted) => {
      const before = await seed(status, deleted);
      await expectRejectedUnchanged(
        commandPost(db, id, command, { expected_revision: 2 }),
        'POST_VERSION_CONFLICT',
        before,
      );
    },
  );
  it.each(transitions.filter(row => row[3] === 'noop'))(
    'accepts stale already-satisfied %s on %s deleted=%s',
    async (command, status, deleted) => {
      const before = await seed(status, deleted);
      expect(
        await commandPost(db, id, command, { expected_revision: 1 }),
      ).toEqual(before);
    },
  );
  it.each(['publish', 'archive', 'delete', 'restore', 'save'] as const)(
    'returns missing-post errors for %s',
    async command => {
      const operation =
        command === 'save'
          ? savePost(db, id, { title: 'X', expected_revision: 1 })
          : commandPost(db, id, command, { expected_revision: 1 });
      await expect(operation).rejects.toMatchObject({
        status: 404,
        code: 'POST_NOT_FOUND',
      });
    },
  );
  it.each([false, true])(
    'delete/restore racing on deleted=%s applies exactly one change',
    async deleted => {
      const before = await seed('published', deleted);
      await Promise.allSettled([
        commandPost(db, id, 'delete', { expected_revision: 3 }),
        commandPost(db, id, 'restore', { expected_revision: 3 }),
      ]);
      const after = (await getPost(db, id))!;
      expect(after.revision).toBe(before.revision + 1);
      expect(after.deleted_at).toBe(deleted ? null : now);
    },
  );
  it('retains first publication identity after title edits, archive, delete, restore and republish', async () => {
    await seed();
    const first = await commandPost(db, id, 'publish', {
      expected_revision: 3,
    });
    await savePost(db, id, { title: 'New URL?', expected_revision: 4 });
    await commandPost(db, id, 'archive', { expected_revision: 5 });
    await commandPost(db, id, 'delete', { expected_revision: 6 });
    await commandPost(db, id, 'restore', { expected_revision: 7 });
    vi.setSystemTime(new Date('2026-10-08T06:00:00.000Z'));
    const last = await commandPost(db, id, 'publish', { expected_revision: 8 });
    expect(last).toMatchObject({
      slug: first.slug,
      published_at: first.published_at,
      created_at: stamp,
      revision: 9,
      status: 'published',
    });
  });
});

describe('first publication identity', () => {
  it('rejects empty normalized slugs without partial publication', async () => {
    await seed();
    await db.update(posts).set({ title: ' /😀?! ' }).where(eq(posts.id, id));
    const before = await getPost(db, id);
    await expectRejectedUnchanged(
      commandPost(db, id, 'publish', { expected_revision: 3 }),
      'VALIDATION_ERROR',
      before,
    );
  });
  it('lets competing publishers reserve different slugs atomically', async () => {
    const a = await createPost(db, { title: 'Same', body: 'A' });
    const b = await createPost(db, { title: 'Same', body: 'B' });
    const result = await Promise.all([
      commandPost(db, a.id, 'publish', { expected_revision: 1 }),
      commandPost(db, b.id, 'publish', { expected_revision: 1 }),
    ]);
    expect(result.map(post => post.slug).sort()).toEqual(['same', 'same-2']);
    expect(
      result.every(
        post =>
          post.status === 'published' &&
          post.revision === 2 &&
          post.published_at === now,
      ),
    ).toBe(true);
  });
  it('reserves archived and deleted slugs, including suffix and truncation collisions', async () => {
    const title = '가'.repeat(101);
    for (const [slug, deleted] of [
      ['가'.repeat(100), false],
      ['가'.repeat(98) + '-2', true],
    ] as const) {
      await db.insert(posts).values({
        id: crypto.randomUUID(),
        title,
        body: 'x',
        status: 'archived',
        slug,
        published_at: stamp,
        deleted_at: deleted ? stamp : null,
      });
    }
    const draft = await createPost(db, { title, body: 'x' });
    const published = await commandPost(db, draft.id, 'publish', {
      expected_revision: 1,
    });
    expect(published.slug).toBe('가'.repeat(98) + '-3');
  });
  it('allows only one revision change when the same draft is published concurrently', async () => {
    await seed();
    const results = await Promise.allSettled([
      commandPost(db, id, 'publish', { expected_revision: 3 }),
      commandPost(db, id, 'publish', { expected_revision: 3 }),
    ]);
    expect(results.some(result => result.status === 'fulfilled')).toBe(true);
    expect(await getPost(db, id)).toMatchObject({
      revision: 4,
      slug: 'original-title',
      published_at: now,
    });
  });
  it('does not treat unrelated database failures as slug collisions', async () => {
    const before = await seed();
    await fixture.binding
      .prepare(
        "CREATE TRIGGER reject_publish BEFORE UPDATE ON posts WHEN NEW.status = 'published' BEGIN SELECT RAISE(ABORT, 'publication blocked'); END",
      )
      .run();
    await expect(
      commandPost(db, id, 'publish', { expected_revision: 3 }),
    ).rejects.toMatchObject({ cause: { message: 'publication blocked' } });
    expect(await getPost(db, id)).toEqual(before);
  });
});

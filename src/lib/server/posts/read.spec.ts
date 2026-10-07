import { adminPostPageSchema, adminPostSchema } from '$lib/admin/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSqliteD1 } from '../../../../tests/admin/sqlite-d1';
import { getDb, type BlogDb } from '../db';
import { posts } from '../db/schema';
import { getPost, listPosts } from './read';

let fixture: ReturnType<typeof createSqliteD1>;
let db: BlogDb;
const stamp = '2026-10-07T00:00:00.000Z';
const ids = [1, 2, 3, 4, 5].map(
  n => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`,
);
beforeEach(async () => {
  fixture = createSqliteD1();
  db = getDb(fixture.binding);
  await db.insert(posts).values([
    { id: ids[0], title: 'Draft', body: ' secret ', updated_at: stamp },
    {
      id: ids[1],
      title: 'Published',
      body: 'B',
      status: 'published',
      slug: 'published',
      published_at: stamp,
      updated_at: stamp,
    },
    {
      id: ids[2],
      title: 'Archived',
      body: 'B',
      status: 'archived',
      slug: 'archived',
      published_at: stamp,
      updated_at: stamp,
    },
    {
      id: ids[3],
      title: 'Deleted draft',
      body: 'B',
      deleted_at: stamp,
      updated_at: stamp,
    },
    {
      id: ids[4],
      title: 'Deleted published',
      body: 'B',
      status: 'published',
      slug: 'deleted',
      published_at: stamp,
      deleted_at: stamp,
      updated_at: stamp,
    },
  ]);
});
afterEach(() => fixture?.dispose());

describe('post reads through the migrated SQLite D1 binding', () => {
  it('retrieves raw detail including deleted posts and returns null for missing IDs', async () => {
    expect(await getPost(db, ids[0])).toMatchObject({
      body: ' secret ',
      deleted_at: null,
    });
    expect(adminPostSchema.parse(await getPost(db, ids[4]))).toMatchObject({
      deleted_at: stamp,
      status: 'published',
    });
    expect(
      await getPost(db, '019a0000-0000-7000-8000-000000000099'),
    ).toBeNull();
  });
  it('lists only non-deleted rows with ID-descending timestamp ties', async () => {
    const page = await listPosts(db, 'normal', { page: 1, limit: 2 });
    expect(adminPostPageSchema.parse(page)).toMatchObject({
      page: 1,
      limit: 2,
      totalItems: 3,
      totalPages: 2,
    });
    expect(page.items.map(row => row.id)).toEqual([ids[2], ids[1]]);
    expect(page.items[0]).not.toHaveProperty('body');
    expect(
      (await listPosts(db, 'normal', { page: 2, limit: 2 })).items.map(
        row => row.id,
      ),
    ).toEqual([ids[0]]);
  });
  it.each(['draft', 'published', 'archived'] as const)(
    'counts the same %s scope as its items',
    async status => {
      expect(
        await listPosts(db, 'normal', { page: 1, limit: 20, status }),
      ).toMatchObject({ items: [{ status }], totalItems: 1, totalPages: 1 });
    },
  );
  it('lists every deleted status with matching trash totals', async () => {
    const page = await listPosts(db, 'trash', { page: 1, limit: 1 });
    expect(page).toMatchObject({
      items: [{ id: ids[4] }],
      totalItems: 2,
      totalPages: 2,
    });
    expect(
      (await listPosts(db, 'trash', { page: 2, limit: 1 })).items[0].id,
    ).toBe(ids[3]);
  });
  it('returns requested pages beyond the end without clamping', async () => {
    expect(await listPosts(db, 'normal', { page: 10, limit: 2 })).toEqual({
      items: [],
      page: 10,
      limit: 2,
      totalItems: 3,
      totalPages: 2,
    });
  });
  it('represents an empty scope with zero total pages', async () => {
    await db.delete(posts);
    expect(await listPosts(db, 'trash', { page: 1, limit: 20 })).toEqual({
      items: [],
      page: 1,
      limit: 20,
      totalItems: 0,
      totalPages: 0,
    });
  });
  it('orders newer timestamps before the ID tie-breaker', async () => {
    await db.insert(posts).values({
      id: '019a0000-0000-7000-8000-000000000000',
      title: 'Newer',
      body: 'B',
      updated_at: '2026-10-08T00:00:00.000Z',
    });
    expect(
      (await listPosts(db, 'normal', { page: 1, limit: 1 })).items[0].title,
    ).toBe('Newer');
  });
});

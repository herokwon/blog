import { adminPostSchema } from '$lib/admin/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSqliteD1 } from '../../../../tests/admin/sqlite-d1';
import { getDb, type BlogDb } from '../db';
import { posts } from '../db/schema';
import { createPost } from './mutate';
import { getPost } from './read';

let fixture: ReturnType<typeof createSqliteD1>;
let db: BlogDb;
beforeEach(() => {
  fixture = createSqliteD1();
  db = getDb(fixture.binding);
});
afterEach(() => fixture?.dispose());
describe('draft creation', () => {
  it.each([
    { title: ' ', body: 'x' },
    { title: 'x', body: '' },
    { title: 'x', body: 'x', status: 'published' },
  ])('rejects invalid creation input without inserting a row', async input => {
    await expect(createPost(db, input)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(await db.select().from(posts)).toEqual([]);
  });
  it('creates distinct UUIDv7 drafts with raw content, revision 1 and null publication fields', async () => {
    const input = { title: ' Cafe\u0301 ', body: ' \n\t' };
    const first = adminPostSchema.parse(await createPost(db, input));
    const second = await createPost(db, input);
    expect(first).toMatchObject({
      ...input,
      revision: 1,
      status: 'draft',
      slug: null,
      published_at: null,
      deleted_at: null,
    });
    expect(second.id).not.toBe(first.id);
    expect(first.created_at).toBe(first.updated_at);
    expect(await getPost(db, first.id)).toEqual(first);
  });
});

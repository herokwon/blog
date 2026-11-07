import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import {
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
} from './categories';

let platform: PlatformProxy<{ DB: D1Database }>;
let db: D1Database;

beforeAll(async () => {
  platform = await getPlatformProxy<{ DB: D1Database }>({
    persist: false,
    remoteBindings: false,
  });
  db = platform.env.DB;
  for (const file of readdirSync('drizzle')
    .filter(file => file.endsWith('.sql'))
    .sort()) {
    for (const statement of readFileSync(`drizzle/${file}`, 'utf8').split(
      '--> statement-breakpoint',
    )) {
      await db.prepare(statement).run();
    }
  }
}, 30_000);
beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM posts'),
    db.prepare('DELETE FROM categories'),
  ]);
});
afterAll(async () => {
  await platform?.dispose();
});

test('category commands trim names, enforce Unicode limits and reserve unique names under concurrent writes', async () => {
  expect(await createCategory(db, '  Notes  ')).toMatchObject({ ok: true });
  expect(await createCategory(db, 'Notes')).toMatchObject({
    ok: false,
    status: 409,
  });
  for (const name of ['', '\t\n', 'a'.repeat(21), 'bad\0name']) {
    expect(await createCategory(db, name)).toMatchObject({
      ok: false,
      status: 400,
    });
  }
  expect(await createCategory(db, '😀'.repeat(20))).toMatchObject({ ok: true });
  expect(await createCategory(db, '😀'.repeat(21))).toMatchObject({
    ok: false,
    status: 400,
  });
  const writes = await Promise.all([
    createCategory(db, 'Race'),
    createCategory(db, 'Race'),
  ]);
  expect(writes.filter(result => result.ok)).toHaveLength(1);
  const { categories } = await listCategories(db);
  const notes = categories.find(category => category.name === 'Notes')!;
  expect(await renameCategory(db, notes.id, ' Race ')).toMatchObject({
    ok: false,
    status: 409,
  });
  expect(await renameCategory(db, notes.id, 'a'.repeat(21))).toMatchObject({
    ok: false,
    status: 400,
  });
  expect(await renameCategory(db, notes.id, '  Renamed  ')).toMatchObject({
    ok: true,
  });
  expect(
    (await listCategories(db)).categories.find(
      category => category.id === notes.id,
    ),
  ).toEqual({ id: notes.id, name: 'Renamed', usage: 0 });
  expect(await deleteCategory(db, notes.id)).toMatchObject({ ok: true });
  expect(await renameCategory(db, notes.id, 'Gone')).toMatchObject({
    ok: false,
    status: 404,
  });
  expect(await deleteCategory(db, notes.id)).toMatchObject({
    ok: false,
    status: 404,
  });
});

test('usage counts every post state and deletion never overrides a reference, including concurrent assignments', async () => {
  await createCategory(db, 'Used');
  const category = (await listCategories(db)).categories[0];
  for (const [id, status, deleted] of [
    ['draft', 'draft', null],
    ['published', 'published', null],
    ['archived', 'archived', null],
    ['trash-draft', 'draft', '2026-11-08T00:00:00.000Z'],
    ['trash-archived', 'archived', '2026-11-08T00:00:00.000Z'],
  ] as const) {
    await db
      .prepare(
        "INSERT INTO posts (id, revision, title, body, status, slug, category_id, published_at, deleted_at) VALUES (?, 'r', 'Post', 'Body', ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        status,
        id,
        category.id,
        status === 'draft' ? null : '2026-11-08T00:00:00.000Z',
        deleted,
      )
      .run();
    expect((await listCategories(db)).categories).toEqual([
      { ...category, usage: 1 },
    ]);
    expect(await deleteCategory(db, category.id)).toMatchObject({
      ok: false,
      status: 409,
    });
    await db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
  }
  const [deletion, assignment] = await Promise.allSettled([
    deleteCategory(db, category.id),
    db
      .prepare(
        "INSERT INTO posts (id, revision, category_id) VALUES ('race', 'r', ?)",
      )
      .bind(category.id)
      .run(),
  ]);
  const remaining = await listCategories(db);
  const post = await db
    .prepare("SELECT category_id FROM posts WHERE id = 'race'")
    .first();
  if (post) {
    expect(remaining.categories).toEqual([{ ...category, usage: 1 }]);
    expect(deletion).toMatchObject({
      status: 'fulfilled',
      value: { ok: false, status: 409 },
    });
  } else {
    expect(remaining.categories).toEqual([]);
    expect(assignment.status).toBe('rejected');
  }
});

test('category lists have stable twenty-item pages', async () => {
  for (let index = 0; index < 21; index++)
    await createCategory(db, `Category ${String(index).padStart(2, '0')}`);
  const first = await listCategories(db);
  const second = await listCategories(db, 2);
  expect(first.categories).toHaveLength(20);
  expect(first.hasNext).toBe(true);
  expect(second.categories.map(category => category.name)).toEqual([
    'Category 20',
  ]);
  expect(second.hasNext).toBe(false);
});

import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import { deleteCategory } from './categories';
import {
  getPost,
  listPosts,
  mutatePost,
  slugAvailability,
  type PostInput,
} from './posts';

let platform: PlatformProxy<{ DB: D1Database }>;
let db: D1Database;
const input: PostInput = {
  title: 'A post',
  body: '# Content',
  slug: 'a-post',
  categoryId: 'category',
  tags: [' Svelte ', 'Svelte', 'Cloudflare'],
};

beforeAll(async () => {
  platform = await getPlatformProxy<{ DB: D1Database }>({
    persist: false,
    remoteBindings: false,
  });
  db = platform.env.DB;
  for (const file of readdirSync('drizzle')
    .filter(name => name.endsWith('.sql'))
    .sort()) {
    for (const statement of readFileSync(`drizzle/${file}`, 'utf8').split(
      '--> statement-breakpoint',
    ))
      await db.prepare(statement).run();
  }
}, 30_000);
beforeEach(async () => {
  await db.batch(
    [
      'DROP TRIGGER IF EXISTS reject_relation',
      'DELETE FROM post_tags',
      'DELETE FROM posts',
      'DELETE FROM tags',
      'DELETE FROM categories',
      "INSERT INTO categories (id, name) VALUES ('category', 'Notes')",
    ].map(query => db.prepare(query)),
  );
});
afterAll(async () => {
  await platform?.dispose();
});

async function draft(
  value: PostInput = {
    title: '',
    body: '',
    slug: '',
    categoryId: '',
    tags: [],
  },
) {
  const result = await mutatePost(db, { action: 'create', input: value });
  if (!result.ok) throw new Error(result.message);
  return (await getPost(db, result.id))!;
}

test('UUIDv7 drafts and publication lifecycle preserve first-publication metadata and restore privately', async () => {
  const post = await draft();
  expect(post.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  const generated = Number.parseInt(
    post.id.replaceAll('-', '').slice(0, 12),
    16,
  );
  expect(Math.abs(Date.now() - generated)).toBeLessThan(10_000);
  expect(post).toMatchObject({
    status: 'draft',
    publishedAt: null,
    slug: null,
    tags: [],
  });
  const published = await mutatePost(db, {
    action: 'publish',
    id: post.id,
    revision: post.revision,
    input,
  });
  expect(published.ok).toBe(true);
  const first = (await getPost(db, post.id))!;
  expect(first).toMatchObject({
    status: 'published',
    slug: 'a-post',
    tags: ['Cloudflare', 'Svelte'],
  });
  expect(first.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*\.\d{3}Z$/);
  await db
    .prepare(
      "UPDATE posts SET updated_at = '2000-01-01T00:00:00.000Z' WHERE id = ?",
    )
    .bind(post.id)
    .run();
  expect(
    (
      await mutatePost(db, {
        action: 'save',
        id: post.id,
        revision: first.revision,
        input: { ...input, body: 'Immediately saved', tags: [] },
      })
    ).ok,
  ).toBe(true);
  const saved = (await getPost(db, post.id))!;
  expect(saved).toMatchObject({
    status: 'published',
    body: 'Immediately saved',
    tags: [],
    publishedAt: first.publishedAt,
  });
  expect(saved.updatedAt).not.toBe('2000-01-01T00:00:00.000Z');
  for (const action of ['archive', 'republish', 'trash', 'restore'] as const) {
    const current = (await getPost(db, post.id))!;
    expect(
      (
        await mutatePost(db, {
          action,
          id: post.id,
          revision: current.revision,
          input,
        })
      ).ok,
    ).toBe(true);
    const next = (await getPost(db, post.id))!;
    expect(next.publishedAt).toBe(first.publishedAt);
    expect(next.createdAt).toBe(post.createdAt);
    expect(next.slug).toBe('a-post');
    expect(next.revision).not.toBe(current.revision);
  }
  expect((await getPost(db, post.id))?.status).toBe('archived');
  const restored = (await getPost(db, post.id))!;
  expect(
    await mutatePost(db, {
      action: 'save',
      id: post.id,
      revision: restored.revision,
      input: { ...input, slug: 'changed' },
    }),
  ).toMatchObject({ ok: false, status: 400 });
});

test('publication, size, tag and direct slug validation rejects invalid writes without changing the draft', async () => {
  const post = await draft();
  for (const invalid of [
    { ...input, title: ' \n' },
    { ...input, body: '\t' },
    { ...input, categoryId: '' },
    { ...input, slug: '' },
    { ...input, slug: 'Upper' },
    { ...input, slug: 'a--b' },
    { ...input, slug: ' a-post' },
    { ...input, title: 'a'.repeat(201) },
    { ...input, body: 'é'.repeat(524289) },
    { ...input, tags: ['a'.repeat(41)] },
    { ...input, tags: Array.from({ length: 21 }, (_, i) => `tag${i}`) },
    { ...input, body: 'bad\0body' },
  ])
    expect(
      await mutatePost(db, {
        action: 'publish',
        id: post.id,
        revision: post.revision,
        input: invalid,
      }),
    ).toMatchObject({ ok: false, status: 400 });
  expect((await getPost(db, post.id))?.revision).toBe(post.revision);
  expect(
    await mutatePost(db, {
      action: 'archive',
      id: post.id,
      revision: post.revision,
    }),
  ).toMatchObject({ ok: false, status: 400 });
  expect(
    await mutatePost(db, {
      action: 'republish',
      id: post.id,
      revision: post.revision,
      input,
    }),
  ).toMatchObject({ ok: false, status: 400 });
  const boundary = {
    ...input,
    title: '😀'.repeat(200),
    body: 'é'.repeat(524288),
    slug: 'a'.repeat(120),
    tags: Array.from({ length: 20 }, (_, i) => String(i).padStart(40, 'a')),
  };
  expect(
    (
      await mutatePost(db, {
        action: 'publish',
        id: post.id,
        revision: post.revision,
        input: boundary,
      })
    ).ok,
  ).toBe(true);
});

test('archive and trash do not save submitted content; trash is read-only and draft restore stays draft', async () => {
  const created = await mutatePost(db, { action: 'publish', input });
  if (!created.ok) throw new Error(created.message);
  const first = (await getPost(db, created.id))!;
  expect(
    (
      await mutatePost(db, {
        action: 'archive',
        id: first.id,
        revision: first.revision,
        input: { ...input, title: 'Unsaved' },
      })
    ).ok,
  ).toBe(true);
  const archived = (await getPost(db, first.id))!;
  expect(archived.title).toBe('A post');
  expect(
    await mutatePost(db, {
      action: 'publish',
      id: archived.id,
      revision: archived.revision,
      input,
    }),
  ).toMatchObject({ ok: false, status: 400 });
  const post = await draft();
  expect(
    (
      await mutatePost(db, {
        action: 'trash',
        id: post.id,
        revision: post.revision,
      })
    ).ok,
  ).toBe(true);
  const trashed = (await getPost(db, post.id))!;
  expect(
    await mutatePost(db, {
      action: 'save',
      id: post.id,
      revision: trashed.revision,
      input,
    }),
  ).toMatchObject({ ok: false, status: 400 });
  expect(
    (
      await mutatePost(db, {
        action: 'restore',
        id: post.id,
        revision: trashed.revision,
      })
    ).ok,
  ).toBe(true);
  expect((await getPost(db, post.id))?.status).toBe('draft');
});

test('concurrent slug claims have one winner and all states reserve their slug', async () => {
  const results = await Promise.all([
    mutatePost(db, { action: 'create', input }),
    mutatePost(db, { action: 'create', input }),
  ]);
  expect(results.filter(result => result.ok)).toHaveLength(1);
  expect(results.find(result => !result.ok)).toMatchObject({
    code: 'slug_reserved',
  });
  const winner = results.find(result => result.ok)!;
  if (!winner.ok) throw new Error('No winner');
  expect(await slugAvailability(db, 'a-post')).toMatchObject({
    available: false,
    valid: true,
  });
  expect(await slugAvailability(db, 'a-post', winner.id)).toMatchObject({
    available: true,
  });
  expect(await slugAvailability(db, 'Bad Slug')).toMatchObject({
    valid: false,
    available: false,
  });
  const post = (await getPost(db, winner.id))!;
  await mutatePost(db, {
    action: 'trash',
    id: post.id,
    revision: post.revision,
  });
  expect(await slugAvailability(db, 'a-post')).toMatchObject({
    available: false,
  });
});

test('revision guards make concurrent updates single-winner and stale batches cannot create or detach tags', async () => {
  const post = await draft(input);
  const results = await Promise.all(
    ['Winner A', 'Winner B'].map(title =>
      mutatePost(db, {
        action: 'save',
        id: post.id,
        revision: post.revision,
        input: { ...input, title, tags: [title] },
      }),
    ),
  );
  expect(results.filter(result => result.ok)).toHaveLength(1);
  expect(results.find(result => !result.ok)).toMatchObject({
    code: 'stale_revision',
  });
  const current = (await getPost(db, post.id))!;
  expect(current.tags).toEqual([current.title]);
  expect(
    await db
      .prepare(
        "SELECT count(*) AS count FROM tags WHERE name IN ('Winner A', 'Winner B')",
      )
      .first<number>('count'),
  ).toBe(1);
  expect(
    await mutatePost(db, {
      action: 'save',
      id: post.id,
      revision: post.revision,
      input: { ...input, tags: ['Stale orphan'] },
    }),
  ).toMatchObject({ ok: false, status: 409 });
  expect((await getPost(db, post.id))?.tags).toEqual([current.title]);
  expect(
    await db
      .prepare("SELECT count(*) AS count FROM tags WHERE name = 'Stale orphan'")
      .first<number>('count'),
  ).toBe(0);
  const detached = await mutatePost(db, {
    action: 'save',
    id: post.id,
    revision: current.revision,
    input: { ...input, tags: [] },
  });
  expect(detached.ok).toBe(true);
  expect((await getPost(db, post.id))?.tags).toEqual([]);
});

test('a dependent SQL failure rolls back the post, revision, new tags and old relations', async () => {
  const post = await draft(input);
  await db
    .prepare(
      "CREATE TRIGGER reject_relation BEFORE INSERT ON post_tags BEGIN SELECT RAISE(ABORT, 'relation rejected'); END",
    )
    .run();
  await expect(
    mutatePost(db, {
      action: 'save',
      id: post.id,
      revision: post.revision,
      input: { ...input, title: 'Not saved', tags: ['Rollback'] },
    }),
  ).rejects.toThrow();
  expect(await getPost(db, post.id)).toEqual(post);
  expect(
    await db
      .prepare("SELECT count(*) AS count FROM tags WHERE name = 'Rollback'")
      .first<number>('count'),
  ).toBe(0);
});

test('category deletion and publication race leaves either an intact published reference or no post', async () => {
  const [publication, deletion] = await Promise.all([
    mutatePost(db, { action: 'publish', input }),
    deleteCategory(db, 'category'),
  ]);
  if (publication.ok) {
    expect(deletion.ok).toBe(false);
    expect((await getPost(db, publication.id))?.categoryId).toBe('category');
  } else {
    expect(deletion.ok).toBe(true);
    expect((await listPosts(db)).posts).toEqual([]);
  }
});

test('post lists filter trash and status with stable twenty-item ordering', async () => {
  const ids: string[] = [];
  for (let i = 0; i < 21; i++) ids.push((await draft()).id);
  await db
    .prepare("UPDATE posts SET updated_at = '2026-11-08T00:00:00.000Z'")
    .run();
  const first = await listPosts(db, 'draft');
  expect(first.posts.map(post => post.id)).toEqual(
    [...ids].sort().reverse().slice(0, 20),
  );
  expect(first.hasNext).toBe(true);
  expect((await listPosts(db, 'draft', 2)).posts).toHaveLength(1);
  const post = (await getPost(db, ids[0]))!;
  await mutatePost(db, {
    action: 'trash',
    id: post.id,
    revision: post.revision,
  });
  expect((await listPosts(db, 'trash')).posts.map(post => post.id)).toEqual([
    post.id,
  ]);
  expect((await listPosts(db, 'published')).posts).toEqual([]);
});

test('conflicts identify stale revisions, reserved slugs and deleted categories without changing content', async () => {
  const first = await draft(input);
  const second = await draft();
  expect(
    await mutatePost(db, {
      action: 'save',
      id: second.id,
      revision: second.revision,
      input,
    }),
  ).toMatchObject({ ok: false, status: 409, code: 'slug_reserved' });
  expect(
    await mutatePost(db, {
      action: 'save',
      id: second.id,
      revision: second.revision,
      input: { ...input, slug: 'other', categoryId: 'missing' },
    }),
  ).toMatchObject({ ok: false, status: 409, code: 'category_missing' });
  expect(
    await mutatePost(db, {
      action: 'save',
      id: first.id,
      revision: 'stale',
      input: { ...input, title: 'Lost' },
    }),
  ).toMatchObject({ ok: false, status: 409, code: 'stale_revision' });
  expect((await getPost(db, first.id))?.title).toBe(input.title);
  expect((await getPost(db, second.id))?.title).toBe('');
});

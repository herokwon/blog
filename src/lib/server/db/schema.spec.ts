import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, test } from 'vitest';

let db: DatabaseSync;
const timestamp = '2026-11-07T00:00:00.000Z';

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const directory = resolve('drizzle');
  const files = existsSync(directory)
    ? readdirSync(directory)
        .filter(name => name.endsWith('.sql'))
        .sort()
    : [];
  expect(files.length, 'committed domain migration exists').toBeGreaterThan(0);
  for (const file of files)
    db.exec(readFileSync(resolve(directory, file), 'utf8'));
});

afterEach(() => db.close());

function draft(id = '019a58f0-0000-7000-8000-000000000001') {
  db.prepare('INSERT INTO posts (id, revision) VALUES (?, ?)').run(
    id,
    'revision-1',
  );
  return id;
}

function publish(id: string, slug = 'my-post') {
  db.exec(
    "INSERT OR IGNORE INTO categories (id, name) VALUES ('category', 'Notes')",
  );
  db.prepare(
    "UPDATE posts SET title = 'Post', body = 'Content', category_id = 'category', slug = ?, published_at = ?, status = 'published' WHERE id = ?",
  ).run(slug, timestamp, id);
}

test('migration supports incomplete drafts and canonical insertion defaults without implicit update timestamps', () => {
  const id = draft();
  const first = db.prepare('SELECT * FROM posts WHERE id = ?').get(id)!;
  expect(first).toMatchObject({
    status: 'draft',
    slug: null,
    category_id: null,
    published_at: null,
    deleted_at: null,
  });
  expect(first.created_at).toMatch(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  );
  expect(first.updated_at).toBe(first.created_at);
  db.prepare('UPDATE posts SET title = ? WHERE id = ?').run('Edited', id);
  expect(
    db.prepare('SELECT created_at, updated_at FROM posts WHERE id = ?').get(id),
  ).toEqual({ created_at: first.created_at, updated_at: first.updated_at });
});

test('classification boundaries and foreign keys protect referenced categories even in trash', () => {
  db.prepare('INSERT INTO categories (id, name) VALUES (?, ?)').run(
    'limit',
    'a'.repeat(20),
  );
  expect(() =>
    db
      .prepare('INSERT INTO categories (id, name) VALUES (?, ?)')
      .run('too-long', 'a'.repeat(21)),
  ).toThrow();
  draft('tag-post');
  db.prepare(
    "INSERT INTO post_tags (post_id, name, position) VALUES ('tag-post', ?, ?)",
  ).run('a'.repeat(40), 0);
  expect(() =>
    db
      .prepare(
        "INSERT INTO post_tags (post_id, name, position) VALUES ('tag-post', ?, ?)",
      )
      .run('a'.repeat(41), 1),
  ).toThrow();
  for (const name of ['', ' ', ' Notes', 'Notes ']) {
    expect(() =>
      db
        .prepare('INSERT INTO categories (id, name) VALUES (?, ?)')
        .run('invalid', name),
    ).toThrow();
  }
  const id = draft();
  publish(id);
  db.prepare(
    "UPDATE posts SET status = 'archived', deleted_at = ? WHERE id = ?",
  ).run(timestamp, id);
  expect(() =>
    db.exec("DELETE FROM categories WHERE id = 'category'"),
  ).toThrow();
  expect(() =>
    db.prepare("UPDATE posts SET category_id = 'missing' WHERE id = ?").run(id),
  ).toThrow();
  expect(() =>
    db.exec(
      "INSERT INTO post_tags (post_id, name, position) VALUES ('tag-post', '" +
        'a'.repeat(40) +
        "', 1)",
    ),
  ).toThrow();
});

test('publication requires complete metadata and trash cannot remain published', () => {
  const id = draft();
  expect(() =>
    db.prepare("UPDATE posts SET status = 'published' WHERE id = ?").run(id),
  ).toThrow();
  expect(() =>
    db.prepare("UPDATE posts SET status = 'unknown' WHERE id = ?").run(id),
  ).toThrow();
  publish(id);
  expect(() =>
    db
      .prepare('UPDATE posts SET deleted_at = ? WHERE id = ?')
      .run(timestamp, id),
  ).toThrow();
  for (const column of ['slug', 'category_id', 'published_at']) {
    expect(() =>
      db.prepare(`UPDATE posts SET ${column} = NULL WHERE id = ?`).run(id),
    ).toThrow();
  }
  expect(() =>
    db.prepare("UPDATE posts SET title = ' ' WHERE id = ?").run(id),
  ).toThrow();
  expect(() =>
    db.prepare("UPDATE posts SET body = '' WHERE id = ?").run(id),
  ).toThrow();
  expect(() =>
    db.prepare("UPDATE posts SET status = 'draft' WHERE id = ?").run(id),
  ).toThrow();
});

test('slugs reject malformed input and stay reserved by archived trashed posts', () => {
  const id = draft();
  for (const slug of [
    '',
    '-post',
    'post-',
    'two--words',
    'Upper',
    '한글',
    'has space',
    'post\0hidden',
    'a'.repeat(121),
  ]) {
    expect(() =>
      db.prepare('UPDATE posts SET slug = ? WHERE id = ?').run(slug, id),
    ).toThrow();
  }
  publish(id);
  db.prepare(
    "UPDATE posts SET status = 'archived', deleted_at = ? WHERE id = ?",
  ).run(timestamp, id);
  const second = draft('019a58f0-0000-7000-8000-000000000002');
  expect(() =>
    db.prepare('UPDATE posts SET slug = ? WHERE id = ?').run('my-post', second),
  ).toThrow();
  expect(
    db.prepare('SELECT slug, published_at FROM posts WHERE id = ?').get(id),
  ).toEqual({ slug: 'my-post', published_at: timestamp });
});

test('post tag associations reject duplicates and dangling references', () => {
  const id = draft();
  const insert = db.prepare(
    'INSERT INTO post_tags (post_id, name, position) VALUES (?, ?, 0)',
  );
  insert.run(id, 'Svelte');
  expect(() => insert.run(id, 'Svelte')).toThrow();
  expect(() => insert.run('missing', 'Svelte')).toThrow();
});

test('content limits count title characters and Markdown bytes', () => {
  const id = draft();
  const update = db.prepare(
    'UPDATE posts SET title = ?, body = ? WHERE id = ?',
  );
  update.run('가'.repeat(200), 'a'.repeat(1048576), id);
  expect(() => update.run('가'.repeat(201), '', id)).toThrow();
  expect(() => update.run('', 'a'.repeat(1048577), id)).toThrow();
  expect(() => update.run('', '가'.repeat(349526), id)).toThrow();
});

test('classification names reject whitespace-only, untrimmed and NUL-containing values', () => {
  draft('tag-post');
  for (const table of ['categories', 'post_tags']) {
    for (const name of [
      '\t',
      '\n',
      '\u3000',
      '\ufeff',
      '\tname',
      'name\u3000',
      'a\0' + 'a'.repeat(100),
    ]) {
      expect(() =>
        db
          .prepare(
            table === 'categories'
              ? 'INSERT INTO categories (id, name) VALUES (?, ?)'
              : 'INSERT INTO post_tags (post_id, name, position) VALUES (?, ?, 0)',
          )
          .run(table === 'categories' ? 'invalid' : 'tag-post', name),
      ).toThrow();
    }
  }
});

test('published content rejects whitespace-only fields and NUL text', () => {
  const id = draft();
  publish(id);
  for (const column of ['title', 'body']) {
    for (const value of [
      '\t',
      '\n\r\n',
      '\u3000',
      '\ufeff',
      'a\0' + 'a'.repeat(300),
    ]) {
      expect(() =>
        db
          .prepare(`UPDATE posts SET ${column} = ? WHERE id = ?`)
          .run(value, id),
      ).toThrow();
    }
  }
});

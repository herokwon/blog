import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const migrationDirectory = new URL('../../../../drizzle/', import.meta.url);
const publishedAt = '2026-10-07T00:00:00.000Z';
let db: DatabaseSync;
let nextId: number;

function insert(values: Record<string, SQLInputValue> = {}) {
  const row = {
    id: `post-${++nextId}`,
    title: 'Title',
    body: '# Body',
    ...values,
  };
  const columns = Object.keys(row);
  db.prepare(
    `INSERT INTO posts (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
  ).run(...Object.values(row));
  return row.id;
}

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  nextId = 0;
  if (existsSync(migrationDirectory)) {
    for (const file of readdirSync(migrationDirectory)
      .filter(file => file.endsWith('.sql'))
      .sort()) {
      db.exec(readFileSync(new URL(file, migrationDirectory), 'utf8'));
    }
  }
});

afterEach(() => db.close());

describe('generated post migration', () => {
  it('creates the agreed post columns and retains the example task table', () => {
    const columns = db
      .prepare('PRAGMA table_info(posts)')
      .all()
      .map(row => row.name);
    expect(columns).toEqual([
      'id',
      'title',
      'body',
      'status',
      'slug',
      'created_at',
      'published_at',
      'updated_at',
      'deleted_at',
      'revision',
    ]);
    db.prepare('INSERT INTO task (id, title) VALUES (?, ?)').run(
      'task-1',
      'Example',
    );
    expect(db.prepare('SELECT priority FROM task').get()).toMatchObject({
      priority: 1,
    });
  });

  it('defaults to revision one and draft with fixed-format UTC timestamps', () => {
    const id = insert();
    const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(id)!;
    expect(row).toMatchObject({
      status: 'draft',
      revision: 1,
      slug: null,
      published_at: null,
      deleted_at: null,
    });
    expect(row.created_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(row.updated_at).toBe(row.created_at);
  });

  it.each([
    'id',
    'title',
    'body',
    'status',
    'created_at',
    'updated_at',
    'revision',
  ])('rejects NULL %s', field => {
    expect(() => insert({ [field]: null })).toThrow(/constraint failed/i);
  });

  it.each(['title', 'body'])('rejects empty %s', field => {
    expect(() => insert({ [field]: '' })).toThrow(/constraint failed/i);
  });

  it('preserves nonempty Markdown whitespace', () => {
    const id = insert({ body: ' \n\t' });
    expect(
      db.prepare('SELECT body FROM posts WHERE id = ?').get(id),
    ).toMatchObject({ body: ' \n\t' });
  });

  it.each(['', 'deleted', 'pending'])(
    'rejects unsupported status %j',
    status => {
      expect(() => insert({ status })).toThrow(/constraint failed/i);
    },
  );

  it.each([0, -1, 1.5, 'invalid'])(
    'rejects non-positive or non-integer revision %j',
    revision => {
      expect(() => insert({ revision })).toThrow(/constraint failed/i);
    },
  );

  it('accepts positive integer revisions', () => {
    const id = insert({ revision: 2 });
    expect(
      db.prepare('SELECT revision FROM posts WHERE id = ?').get(id),
    ).toMatchObject({ revision: 2 });
  });

  it.each(['draft', 'published', 'archived'])(
    'accepts valid %s history with and without soft deletion',
    status => {
      for (const deleted_at of [null, publishedAt]) {
        const id = insert({
          status,
          deleted_at,
          slug: status === 'draft' ? null : `slug-${nextId}`,
          published_at: status === 'draft' ? null : publishedAt,
        });
        expect(
          db
            .prepare('SELECT status, deleted_at FROM posts WHERE id = ?')
            .get(id),
        ).toMatchObject({ status, deleted_at });
      }
    },
  );

  it.each([
    { status: 'draft', slug: 'bad', published_at: null },
    { status: 'draft', slug: null, published_at: publishedAt },
    { status: 'draft', slug: 'bad', published_at: publishedAt },
    { status: 'published', slug: null, published_at: null },
    { status: 'published', slug: 'bad', published_at: null },
    { status: 'published', slug: null, published_at: publishedAt },
    { status: 'archived', slug: null, published_at: null },
    { status: 'archived', slug: 'bad', published_at: null },
    { status: 'archived', slug: null, published_at: publishedAt },
  ])('rejects inconsistent publication history %#', row => {
    expect(() => insert(row)).toThrow(/constraint failed/i);
    expect(() => insert({ ...row, deleted_at: publishedAt })).toThrow(
      /constraint failed/i,
    );
  });

  it('allows multiple NULL draft slugs but retains all assigned slug reservations', () => {
    insert();
    insert();
    for (const [index, status] of ['published', 'archived'].entries()) {
      const slug = `reserved-${index}`;
      const id = insert({ status, slug, published_at: publishedAt });
      expect(() =>
        insert({ status: 'published', slug, published_at: publishedAt }),
      ).toThrow(/constraint failed/i);
      db.prepare('UPDATE posts SET deleted_at = ? WHERE id = ?').run(
        publishedAt,
        id,
      );
      expect(() =>
        insert({ status: 'published', slug, published_at: publishedAt }),
      ).toThrow(/constraint failed/i);
    }
    expect(
      db.prepare('SELECT count(*) AS count FROM posts').get(),
    ).toMatchObject({ count: 4 });
  });

  it('rejects duplicate identity without modifying the existing row', () => {
    const id = insert();
    expect(() => insert({ id, title: 'Replacement' })).toThrow(
      /constraint failed/i,
    );
    expect(
      db.prepare('SELECT title FROM posts WHERE id = ?').get(id),
    ).toMatchObject({ title: 'Title' });
  });

  it('leaves timestamp updates to explicit application mutations', () => {
    const id = insert({ created_at: publishedAt, updated_at: publishedAt });
    db.prepare('UPDATE posts SET title = ? WHERE id = ?').run('Changed', id);
    expect(
      db
        .prepare('SELECT created_at, updated_at FROM posts WHERE id = ?')
        .get(id),
    ).toMatchObject({ created_at: publishedAt, updated_at: publishedAt });
  });
});

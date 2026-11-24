import { readdir, readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';

import { revisePost } from '../posts/manage';
import { getPostDetail } from '../posts/markdown';
import {
  createCategory,
  createPost,
  getPost,
  listCategories,
  listPosts,
  listTrashedPosts,
  removeCategory,
  renameCategory,
  setPostDeletion,
  updatePost,
} from './posts';

const migrations = new URL('../../../../drizzle/', import.meta.url);
const clock = new Date('2026-11-24T00:00:00Z');
let proxy: PlatformProxy<{ DB: D1Database }>;
let categoryId: number;

beforeAll(async () => {
  proxy = await getPlatformProxy({
    environment: 'preview',
    envFiles: [],
    persist: false,
    remoteBindings: false,
  });
  for (const name of (await readdir(migrations))
    .filter(name => name.endsWith('.sql'))
    .sort()) {
    const migration = await readFile(new URL(name, migrations), 'utf8');
    const statements = migration
      .split('--> statement-breakpoint')
      .filter(sql => sql.trim());
    await proxy.env.DB.batch(statements.map(sql => proxy.env.DB.prepare(sql)));
  }
  categoryId = (await createCategory(proxy.env.DB, '개발'))!;
});

afterAll(async () => {
  await proxy?.dispose();
});

describe('post storage on local D1', () => {
  it('renders the stored post detail and excludes deleted posts', async () => {
    const db = proxy.env.DB;
    const id = 'render-detail';
    const body = '## 제목\n\n<strong>Raw block</strong>\n';
    await expect(
      createPost(
        db,
        {
          id,
          title: 'Detail',
          body,
          categoryId,
          tags: ['테스트'],
          status: 'draft',
        },
        clock,
      ),
    ).resolves.toBe('saved');
    const detail = await getPostDetail(db, id);
    expect(detail).toMatchObject({
      id,
      categoryName: '개발',
      tags: ['테스트'],
      html: expect.stringContaining('<h2>제목</h2>'),
    });
    expect(detail).not.toHaveProperty('body');
    expect(detail?.html).not.toContain('<strong>');
    expect((await getPost(db, id))?.body).toBe(body);
    await expect(setPostDeletion(db, id, 1, 'delete', clock)).resolves.toBe(
      'saved',
    );
    await expect(getPostDetail(db, id)).resolves.toBeUndefined();
  });

  it('applies publication transitions and submitted content through the server operation', async () => {
    const db = proxy.env.DB;
    const id = 'revision-workflow';
    const draft = { title: 'Draft', body: '', categoryId, tags: ['draft'] };
    const published = {
      ...draft,
      title: 'Published',
      body: '# Markdown',
      tags: ['First'],
    };
    const later = new Date(clock.getTime() + 1000);
    await expect(
      createPost(db, { ...draft, id, status: 'draft' }, clock),
    ).resolves.toBe('saved');
    await expect(
      revisePost(
        db,
        { id, version: 1, action: 'archive', content: draft },
        clock,
      ),
    ).resolves.toEqual({ result: 'transition' });
    await expect(
      revisePost(
        db,
        { id, version: 1, action: 'publish', content: draft },
        clock,
      ),
    ).resolves.toMatchObject({
      result: 'invalid',
      errors: { body: 'required' },
    });
    await expect(
      revisePost(
        db,
        { id, version: 1, action: 'publish', content: published },
        clock,
      ),
    ).resolves.toEqual({ result: 'saved' });
    await expect(
      revisePost(db, { id, version: 1, action: 'save', content: draft }, later),
    ).resolves.toEqual({ result: 'conflict' });
    expect(await getPost(db, id)).toMatchObject({
      title: 'Published',
      body: '# Markdown',
      status: 'published',
      tags: ['first'],
      publishedAt: clock,
    });
    await expect(
      revisePost(
        db,
        {
          id,
          version: 2,
          action: 'archive',
          content: { ...published, title: 'Archived' },
        },
        later,
      ),
    ).resolves.toEqual({ result: 'saved' });
    expect(await getPost(db, id)).toMatchObject({
      status: 'archived',
      title: 'Archived',
    });
    await expect(
      revisePost(db, { id, version: 3, action: 'save', content: draft }, later),
    ).resolves.toMatchObject({
      result: 'invalid',
      errors: { body: 'required' },
    });
    await expect(
      revisePost(
        db,
        { id, version: 3, action: 'publish', content: published },
        later,
      ),
    ).resolves.toEqual({ result: 'saved' });
    expect(await getPost(db, id)).toMatchObject({
      status: 'published',
      publishedAt: clock,
      updatedAt: later,
      version: 4,
    });
    await expect(
      revisePost(
        db,
        { id: 'not-found', version: 1, action: 'save', content: draft },
        clock,
      ),
    ).resolves.toEqual({ result: 'missing' });
  });

  it('renames categories and only removes a category with no post references', async () => {
    const db = proxy.env.DB;
    const unused = (await createCategory(db, 'Unused'))!;
    const used = (await createCategory(db, 'Trashed posts'))!;
    await createPost(
      db,
      {
        id: 'category-reference',
        title: 'Draft',
        body: '',
        status: 'draft',
        categoryId: used,
        tags: [],
      },
      clock,
    );
    await db
      .prepare('UPDATE posts SET deleted_at = ? WHERE id = ?')
      .bind(clock.getTime(), 'category-reference')
      .run();

    await expect(renameCategory(db, unused, ' ')).resolves.toBe('invalid');
    await expect(renameCategory(db, unused, '개발')).resolves.toBe('duplicate');
    await expect(renameCategory(db, unused, ' Renamed ')).resolves.toBe(
      'renamed',
    );
    expect(await listCategories(db)).toContainEqual({
      id: unused,
      name: 'Renamed',
    });
    await expect(removeCategory(db, used)).resolves.toBe('inUse');
    await expect(removeCategory(db, unused)).resolves.toBe('deleted');
    await expect(removeCategory(db, unused)).resolves.toBe('missing');
    await expect(renameCategory(db, unused, 'Gone')).resolves.toBe('missing');
  });

  it('applies schema defaults, protects categories and allows tags on distinct posts', async () => {
    const db = proxy.env.DB;
    const fields = await db
      .prepare(
        "INSERT INTO posts (id, title, body, category_id, status) VALUES ('defaults', 'Defaults', '', ?, 'draft') RETURNING typeof(created_at) AS type, created_at, updated_at, version",
      )
      .bind(categoryId)
      .first();
    expect(fields).toMatchObject({
      type: 'integer',
      version: 1,
      created_at: fields?.updated_at,
    });
    await expect(
      db.prepare('DELETE FROM categories WHERE id = ?').bind(categoryId).run(),
    ).rejects.toThrow(/FOREIGN KEY/);
    const original = {
      title: '한글 제목',
      body: ' ## 본문\n',
      categoryId,
      tags: ['한글'],
      status: 'published',
    } as const;
    for (const id of ['first', 'second']) {
      await expect(
        createPost(db, { ...original, id, tags: [...original.tags] }, clock),
      ).resolves.toBe('saved');
    }
    expect(await getPost(db, 'first')).toMatchObject({
      ...original,
      createdAt: clock,
      updatedAt: clock,
      publishedAt: clock,
    });
    expect(
      (await listPosts(db))
        .filter(({ id }) => id === 'first' || id === 'second')
        .map(({ id }) => id),
    ).toEqual(['second', 'first']);
  });

  it('deduplicates a retry and preserves both the latest post and tags on stale writes', async () => {
    const db = proxy.env.DB;
    const input = {
      id: 'retry',
      title: 'Title',
      body: '',
      categoryId,
      tags: ['one', 'two'],
      status: 'draft',
    } as const;
    await expect(
      createPost(db, { ...input, tags: [...input.tags] }, clock),
    ).resolves.toBe('saved');
    await expect(
      createPost(db, { ...input, tags: ['two', 'one'] }, clock),
    ).resolves.toBe('saved');
    await expect(
      createPost(db, { ...input, tags: ['other'] }, clock),
    ).resolves.toBe('conflict');
    await expect(
      updatePost(
        db,
        { ...input, version: 1, title: 'New', tags: ['latest'] },
        clock,
      ),
    ).resolves.toBe('saved');
    await expect(
      updatePost(
        db,
        { ...input, version: 1, title: 'Stale', tags: ['overwrite'] },
        clock,
      ),
    ).resolves.toBe('conflict');
    expect(await getPost(db, input.id)).toMatchObject({
      title: 'New',
      tags: ['latest'],
      version: 2,
    });
  });

  it('rolls back the whole batch on a constraint error', async () => {
    const db = proxy.env.DB;
    const input = {
      id: 'rollback',
      title: 'Original',
      body: '',
      categoryId,
      tags: ['original'],
      status: 'draft',
    } as const;
    await expect(
      createPost(db, { ...input, tags: [...input.tags] }, clock),
    ).resolves.toBe('saved');
    await expect(
      updatePost(
        db,
        {
          ...input,
          version: 1,
          title: 'Failed',
          categoryId: -1,
          tags: ['failed'],
        },
        clock,
      ),
    ).resolves.toBe('category');
    expect(await getPost(db, input.id)).toMatchObject({
      title: 'Original',
      tags: ['original'],
      version: 1,
    });
    await expect(
      createPost(
        db,
        { ...input, id: 'invalid', tags: ['duplicate', 'duplicate'] },
        clock,
      ),
    ).rejects.toThrow(/UNIQUE/);
    expect(await getPost(db, 'invalid')).toBeUndefined();
  });

  it('moves posts to and from trash without changing their original publication or tags', async () => {
    const db = proxy.env.DB;
    const input = {
      id: 'trash-workflow',
      title: 'Title',
      body: 'Body',
      categoryId,
      tags: ['original'],
      status: 'published',
    } as const;
    const later = new Date(clock.getTime() + 1000);
    const restoredAt = new Date(clock.getTime() + 2000);
    await expect(
      createPost(db, { ...input, tags: [...input.tags] }, clock),
    ).resolves.toBe('saved');
    await expect(
      setPostDeletion(db, input.id, 1, 'restore', later),
    ).resolves.toBe('conflict');
    await expect(
      setPostDeletion(db, input.id, 1, 'delete', later),
    ).resolves.toBe('saved');
    await expect(
      setPostDeletion(db, input.id, 2, 'delete', restoredAt),
    ).resolves.toBe('conflict');
    await expect(
      updatePost(db, { ...input, version: 2, tags: ['gone'] }, later),
    ).resolves.toBe('conflict');
    expect(await getPost(db, input.id)).toBeUndefined();
    expect((await listPosts(db)).some(({ id }) => id === input.id)).toBe(false);
    expect(await listTrashedPosts(db)).toContainEqual(
      expect.objectContaining({
        id: input.id,
        title: input.title,
        status: 'published',
        updatedAt: later,
        deletedAt: later,
        version: 2,
      }),
    );
    await expect(
      setPostDeletion(db, input.id, 1, 'restore', restoredAt),
    ).resolves.toBe('conflict');
    await expect(
      setPostDeletion(db, input.id, 2, 'restore', restoredAt),
    ).resolves.toBe('saved');
    expect(await getPost(db, input.id)).toMatchObject({
      ...input,
      createdAt: clock,
      publishedAt: clock,
      updatedAt: restoredAt,
      deletedAt: null,
      version: 3,
    });
    expect((await listTrashedPosts(db)).some(({ id }) => id === input.id)).toBe(
      false,
    );
    await expect(
      setPostDeletion(db, 'missing', 1, 'restore', restoredAt),
    ).resolves.toBe('missing');
  });
});

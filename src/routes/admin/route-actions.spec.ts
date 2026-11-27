import { v7 } from 'uuid';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

import { createLocalD1 } from '../../../tests/support/local-d1';
import {
  createCategory,
  createPost,
  getPost,
  setPostDeletion,
} from '../../lib/server/db/posts';
import {
  actions as categoryActions,
  load as loadCategories,
} from './categories/+page.server';
import {
  actions as detailActions,
  load as loadDetail,
} from './posts/[id]/+page.server';
import {
  load as loadTrash,
  actions as trashActions,
} from './trash/+page.server';

const env = vi.hoisted(() => ({ DB: undefined as D1Database | undefined }));
vi.mock('../../lib/server/runtime', () => ({ env }));

let proxy: Awaited<ReturnType<typeof createLocalD1>>;

beforeAll(async () => {
  proxy = await createLocalD1();
  env.DB = proxy.env.DB;
});

afterAll(async () => {
  await proxy?.dispose();
});

function post(path: string, fields: Record<string, string>) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    body: new URLSearchParams(fields),
  });
}

it('handles category names and prevents removing a category referenced by a post', async () => {
  const db = proxy.env.DB;
  const categoryId = (await createCategory(db, 'Original'))!;
  await createCategory(db, 'Taken');
  const id = String(categoryId);
  const rename = (name: string) =>
    categoryActions.rename({
      request: post('/admin/categories?/rename', { id, name }),
    } as Parameters<typeof categoryActions.rename>[0]);
  const remove = (category: string) =>
    categoryActions.remove({
      request: post('/admin/categories?/remove', { id: category }),
    } as Parameters<typeof categoryActions.remove>[0]);

  await expect(rename('Taken')).resolves.toMatchObject({
    status: 409,
    data: { id, name: 'Taken' },
  });
  await expect(rename(' ')).resolves.toMatchObject({ status: 422 });
  await expect(rename('😀'.repeat(31))).resolves.toMatchObject({ status: 422 });
  await expect(
    categoryActions.create({
      request: post('/admin/categories?/create', {
        name: ` ${'😀'.repeat(30)} `,
      }),
    } as Parameters<typeof categoryActions.create>[0]),
  ).rejects.toMatchObject({ status: 303 });
  await expect(
    categoryActions.create({
      request: post('/admin/categories?/create', { name: '한'.repeat(31) }),
    } as Parameters<typeof categoryActions.create>[0]),
  ).resolves.toMatchObject({ status: 422 });
  await expect(rename(' Renamed ')).rejects.toMatchObject({
    status: 303,
    location: '/admin/categories',
  });
  await expect(remove('1.5')).resolves.toMatchObject({ status: 422 });

  const postId = v7();
  await createPost(db, {
    id: postId,
    title: 'Post',
    body: '',
    categoryId,
    tags: [],
    status: 'draft',
  });
  expect((await getPost(db, postId))?.categoryName).toBe('Renamed');
  await expect(remove(id)).resolves.toMatchObject({ status: 409 });
  expect((await loadCategories()).categories).toContainEqual({
    id: categoryId,
    name: 'Renamed',
    postCount: 1,
    referenceCount: 1,
  });
  await setPostDeletion(db, postId, 1, 'delete');
  expect((await loadCategories()).categories).toContainEqual({
    id: categoryId,
    name: 'Renamed',
    postCount: 0,
    referenceCount: 1,
  });
  await expect(remove(id)).resolves.toMatchObject({ status: 409 });
  const unused = (await createCategory(db, 'Unused'))!;
  await expect(remove(String(unused))).rejects.toMatchObject({
    status: 303,
    location: '/admin/categories',
  });
  await expect(remove(String(unused))).rejects.toMatchObject({ status: 404 });
});

it('changes the saved post status without accepting replacement content from detail', async () => {
  const db = proxy.env.DB;
  const id = v7();
  const categoryId = (await createCategory(db, 'Detail publication'))!;
  const content = {
    id,
    categoryId,
    title: 'Saved title',
    body: 'Saved body',
    tags: ['saved'],
  };
  await createPost(db, { ...content, status: 'draft' });
  const submit = (
    action: 'publish' | 'archive',
    version: string,
    postId = id,
  ) =>
    detailActions[action]({
      params: { id: postId },
      request: post(`/admin/posts/${postId}?/${action}`, {
        version,
        title: 'Replacement title',
        body: '',
      }),
    } as Parameters<typeof detailActions.publish>[0]);
  await expect(submit('publish', '1')).rejects.toMatchObject({
    status: 303,
    location: `/admin/posts/${id}`,
  });
  const published = await getPost(db, id);
  expect(published).toMatchObject({
    ...content,
    status: 'published',
    version: 2,
  });
  expect(published?.publishedAt).toBeInstanceOf(Date);
  await expect(submit('archive', '1')).resolves.toMatchObject({ status: 409 });
  await expect(submit('archive', '2')).rejects.toMatchObject({ status: 303 });
  await expect(submit('publish', '3')).rejects.toMatchObject({ status: 303 });
  expect(await getPost(db, id)).toMatchObject({
    ...content,
    status: 'published',
    version: 4,
    publishedAt: published?.publishedAt,
  });
  const emptyId = v7();
  await createPost(db, { ...content, id: emptyId, status: 'draft', body: '' });
  await expect(submit('publish', '1', emptyId)).resolves.toMatchObject({
    status: 422,
  });
});

it('loads sanitized details and round-trips delete and restore with version checks', async () => {
  const db = proxy.env.DB;
  const id = v7();
  const categoryId = (await createCategory(db, 'Lifecycle'))!;
  const now = new Date('2026-11-24T00:00:00Z');
  await createPost(
    db,
    {
      id,
      categoryId,
      title: 'Post',
      body: '# 제목\n\n<span>본문</span>',
      tags: ['한글'],
      status: 'published',
    },
    now,
  );

  const detail = (
    request = new Request(`http://localhost/admin/posts/${id}`),
  ) =>
    loadDetail({ params: { id }, request } as Parameters<typeof loadDetail>[0]);
  const remove = (version: string) =>
    detailActions.delete({
      params: { id },
      request: post(`/admin/posts/${id}?/delete`, { version }),
    } as Parameters<typeof detailActions.delete>[0]);
  const restore = (version: string) =>
    trashActions.restore({
      request: post('/admin/trash?/restore', { id, version }),
    } as Parameters<typeof trashActions.restore>[0]);
  const trash = () =>
    loadTrash({
      request: new Request('http://localhost/admin/trash'),
    } as Parameters<typeof loadTrash>[0]);

  const before = await detail();
  expect(before).toMatchObject({
    post: { id, html: expect.stringContaining('<h1>제목</h1>') },
  });
  expect(before.post?.html).not.toContain('<span>');
  expect(before.post).not.toHaveProperty('body');
  await expect(remove('0')).resolves.toMatchObject({ status: 422 });
  await expect(remove('1')).rejects.toMatchObject({
    status: 303,
    location: '/admin/posts',
  });
  await expect(detail()).rejects.toMatchObject({ status: 404 });
  await expect(remove('1')).resolves.toMatchObject({ status: 409 });
  await expect(
    detail(post(`/admin/posts/${id}?/delete`, { version: '1' })),
  ).resolves.toEqual({ post: null });
  expect((await trash()).posts).toContainEqual(
    expect.objectContaining({ id, version: 2 }),
  );
  await expect(restore('1')).resolves.toMatchObject({ status: 409 });
  await expect(restore('2')).rejects.toMatchObject({
    status: 303,
    location: '/admin/trash',
  });
  expect((await trash()).posts).not.toContainEqual(
    expect.objectContaining({ id }),
  );
  expect(await getPost(db, id)).toMatchObject({
    categoryId,
    tags: ['한글'],
    status: 'archived',
    publishedAt: now,
    version: 3,
  });
  await expect(
    detailActions.publish({
      params: { id },
      request: post(`/admin/posts/${id}?/publish`, { version: '3' }),
    } as Parameters<typeof detailActions.publish>[0]),
  ).rejects.toMatchObject({ status: 303 });
  expect(await getPost(db, id)).toMatchObject({
    status: 'published',
    publishedAt: now,
    version: 4,
  });
});

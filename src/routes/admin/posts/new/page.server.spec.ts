import { v7 } from 'uuid';
import { expect, it, vi } from 'vitest';

import { actions, load } from './+page.server';

vi.mock('../../../../lib/server/runtime', () => ({ env: { DB: {} } }));
vi.mock('../../../../lib/server/db/posts', () => {
  const unavailable = () => Promise.reject(new Error('Database unavailable'));
  return { createPost: unavailable, listCategories: unavailable };
});

it('retains the submitted post when both the write and subsequent list read fail', async () => {
  const id = v7();
  const form = new FormData();
  form.set('id', id);
  form.set('title', '제목');
  form.set('body', '## Markdown');
  form.set('categoryId', '1');
  const request = new Request('http://localhost/admin/posts/new?/saveDraft', {
    method: 'POST',
    body: form,
  });
  const event = { request } as Parameters<typeof actions.saveDraft>[0];

  await expect(actions.saveDraft(event)).resolves.toMatchObject({
    status: 503,
    data: {
      values: { id, title: '제목', body: '## Markdown', categoryId: '1' },
    },
  });
  await expect(load()).resolves.toMatchObject({ categories: null });
});

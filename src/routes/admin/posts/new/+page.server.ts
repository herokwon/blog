import { redirect } from '@sveltejs/kit';

import { v7, validate, version } from 'uuid';

import { createPost, listCategories } from '../../../../lib/server/db/posts';
import { env } from '../../../../lib/server/runtime';
import { postFormFailure, readPostForm, validateForm } from '../form.server';
import type { Actions } from './$types';

export const load = async () => ({
  id: v7(),
  categories: await listCategories(env.DB).catch(() => null),
});

function create(status: 'draft' | 'published'): Actions[string] {
  return async ({ request }) => {
    const form = await request.formData();
    const id = form.get('id');
    if (typeof id !== 'string' || !validate(id) || version(id) !== 7) {
      return postFormFailure(
        422,
        readPostForm(form, v7()),
        '글 식별자가 갱신됐습니다. 다시 저장해 주세요.',
      );
    }
    const values = readPostForm(form, id);
    const input = validateForm(values, status);
    if (!input.valid)
      return postFormFailure(422, values, undefined, input.errors);
    try {
      const result = await createPost(env.DB, { ...input.content, id, status });
      if (result === 'category')
        return postFormFailure(409, values, '카테고리를 다시 선택해 주세요.');
      if (result === 'conflict')
        return postFormFailure(
          409,
          values,
          '이 글은 이미 저장됐습니다. 목록에서 확인해 주세요.',
        );
    } catch {
      return postFormFailure(
        503,
        values,
        '게시글을 저장하지 못했습니다. 다시 시도해 주세요.',
      );
    }
    redirect(303, '/admin/posts');
  };
}

export const actions = {
  saveDraft: create('draft'),
  publish: create('published'),
} satisfies Actions;

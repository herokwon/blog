import { fail, redirect } from '@sveltejs/kit';

import { createCategory, listCategories } from '../../../lib/server/db/posts';
import { env } from '../../../lib/server/runtime';
import type { Actions } from './$types';

export const load = async () => ({
  categories: await listCategories(env.DB).catch(() => null),
});

export const actions = {
  async create({ request }) {
    const input = (await request.formData()).get('name');
    const name = typeof input === 'string' ? input.trim() : '';
    if (!name)
      return fail(422, { name, error: '카테고리 이름을 입력해 주세요.' });
    try {
      if (!(await createCategory(env.DB, name))) {
        return fail(409, {
          name,
          error: '이미 사용 중인 카테고리 이름입니다.',
        });
      }
    } catch {
      return fail(503, {
        name,
        error: '카테고리를 저장하지 못했습니다. 다시 시도해 주세요.',
      });
    }
    redirect(303, '/admin/categories');
  },
} satisfies Actions;

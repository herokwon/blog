import { error, fail, redirect } from '@sveltejs/kit';

import {
  categoryNameLength,
  categoryNameLimit,
} from '../../../lib/admin-input';
import {
  createCategory,
  listCategoryUsage,
  removeCategory,
  renameCategory,
} from '../../../lib/server/db/posts';
import { env } from '../../../lib/server/runtime';
import { positiveInteger, readFormText } from '../form-values.server';
import type { Actions } from './$types';

export const load = async () => ({
  categories: await listCategoryUsage(env.DB).catch(() => null),
});

function categoryNameError(name: string) {
  const length = categoryNameLength(name);
  if (length === 0) return '카테고리 이름을 입력해 주세요.';
  if (length > categoryNameLimit)
    return `카테고리 이름은 ${categoryNameLimit}자 이하여야 합니다.`;
}

export const actions = {
  async create({ request }) {
    const name = readFormText(await request.formData(), 'name').trim();
    const validationError = categoryNameError(name);
    if (validationError) return fail(422, { name, error: validationError });
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
  async rename({ request }) {
    const form = await request.formData();
    const id = readFormText(form, 'id');
    const name = readFormText(form, 'name');
    const categoryId = positiveInteger(id);
    if (categoryId === undefined)
      return fail(422, { id, name, error: '카테고리를 다시 선택해 주세요.' });
    const validationError = categoryNameError(name);
    if (validationError) return fail(422, { id, name, error: validationError });

    const result = await renameCategory(env.DB, categoryId, name).catch(
      () => null,
    );
    switch (result) {
      case 'invalid':
        return fail(422, { id, name, error: '카테고리 이름을 입력해 주세요.' });
      case 'duplicate':
        return fail(409, {
          id,
          name,
          error: '이미 사용 중인 카테고리 이름입니다.',
        });
      case 'missing':
        return error(404, '카테고리를 찾을 수 없습니다.');
      case null:
        return fail(503, {
          id,
          name,
          error: '카테고리 이름을 변경하지 못했습니다. 다시 시도해 주세요.',
        });
      case 'renamed':
        return redirect(303, '/admin/categories');
    }
  },
  async remove({ request }) {
    const id = readFormText(await request.formData(), 'id');
    const categoryId = positiveInteger(id);
    if (categoryId === undefined)
      return fail(422, { id, error: '카테고리를 다시 선택해 주세요.' });

    const result = await removeCategory(env.DB, categoryId).catch(() => null);
    switch (result) {
      case 'inUse':
        return fail(409, { id, error: '게시글에서 사용 중인 카테고리입니다.' });
      case 'missing':
        return error(404, '카테고리를 찾을 수 없습니다.');
      case null:
        return fail(503, {
          id,
          error: '카테고리를 삭제하지 못했습니다. 다시 시도해 주세요.',
        });
      case 'deleted':
        return redirect(303, '/admin/categories');
    }
  },
} satisfies Actions;

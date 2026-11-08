import { error, fail } from '@sveltejs/kit';
import {
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
} from '#lib/server/db/categories.js';
import { env } from 'cloudflare:workers';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const value = url.searchParams.get('page') ?? '1';
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000)
    error(400, 'Invalid page.');
  return { ...(await listCategories(env.DB, page)), page };
};

function categoryAction(
  operation: 'create' | 'rename' | 'delete',
): Actions[string] {
  return async ({ request, locals }) => {
    if (!locals.author) error(403, 'Administrator access denied.');
    const values = await request.formData();
    const nameValue = values.get('name');
    const idValue = values.get('id');
    const name = typeof nameValue === 'string' ? nameValue : '';
    const id = typeof idValue === 'string' ? idValue : '';
    const result =
      operation === 'create'
        ? await createCategory(env.DB, name)
        : operation === 'rename'
          ? await renameCategory(env.DB, id, name)
          : await deleteCategory(env.DB, id);
    const state = { operation, id, name, ...result };
    return result.ok ? state : fail(result.status, state);
  };
}

export const actions = {
  create: categoryAction('create'),
  rename: categoryAction('rename'),
  delete: categoryAction('delete'),
} satisfies Actions;

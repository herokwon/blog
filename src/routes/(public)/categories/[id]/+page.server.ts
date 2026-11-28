import { error } from '@sveltejs/kit';

import { loadPostList } from '../../post-list.server';
import type { PageServerLoad } from './$types';

export const load = (async ({ params, url }) => {
  const categoryId = Number(params.id);
  if (!/^[1-9]\d*$/.test(params.id) || !Number.isSafeInteger(categoryId))
    error(404);
  const list = await loadPostList(url, { categoryId });
  return { ...list, title: list.posts[0].categoryName };
}) satisfies PageServerLoad;

import { error } from '@sveltejs/kit';

import { normalizeTag, validateTags } from '../../../../lib/admin-input';
import { loadPostList } from '../../post-list.server';
import type { PageServerLoad } from './$types';

export const load = (async ({ params, url }) => {
  const tag = params.name;
  if (tag !== normalizeTag(tag) || validateTags([tag])) error(404);
  const list = await loadPostList(url, { tag });
  return { ...list, title: `#${tag}` };
}) satisfies PageServerLoad;

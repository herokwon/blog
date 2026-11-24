import { error } from '@sveltejs/kit';

import { listTrashedPosts } from '../../../lib/server/db/posts';
import { env } from '../../../lib/server/runtime';
import { changePostDeletion } from '../posts/deletion.server';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ request }) => {
  const posts = await listTrashedPosts(env.DB).catch(() => null);
  if (posts === null && request.method !== 'POST')
    error(503, '휴지통을 불러오지 못했습니다.');
  return { posts };
}) satisfies PageServerLoad;

export const actions = {
  restore: ({ request }) => changePostDeletion(request, 'restore'),
} satisfies Actions;

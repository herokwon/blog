import { error } from '@sveltejs/kit';

import { getPostDetail } from '../../../../lib/server/posts/markdown';
import { env } from '../../../../lib/server/runtime';
import { changePostDeletion } from '../deletion.server';
import type { Actions, PageServerLoad } from './$types';

export const load = (async ({ params, request }) => {
  const post = await getPostDetail(env.DB, params.id).catch(() => null);
  // After a failed native POST, preserve the action status when reloading.
  if (!post && request.method !== 'POST') {
    if (post === null) error(503, '게시글을 불러오지 못했습니다.');
    error(404, '게시글을 찾을 수 없습니다.');
  }
  return { post: post ?? null };
}) satisfies PageServerLoad;

export const actions = {
  delete: ({ request, params }) =>
    changePostDeletion(request, 'delete', params.id),
} satisfies Actions;

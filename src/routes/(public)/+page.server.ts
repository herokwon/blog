import { error } from '@sveltejs/kit';

import { listPublishedTopics } from '../../lib/server/db/public-posts';
import { env } from '../../lib/server/runtime';
import type { PageServerLoad } from './$types';
import { loadPostList } from './post-list.server';

export const load = (async ({ url }) => {
  const [list, topics] = await Promise.all([
    loadPostList(url),
    listPublishedTopics(env.DB).catch(() => error(503)),
  ]);
  return { ...list, topics };
}) satisfies PageServerLoad;

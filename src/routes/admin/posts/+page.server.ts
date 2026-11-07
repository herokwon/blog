import { error } from '@sveltejs/kit';
import { listPosts, type PostFilter } from '#lib/server/db/posts.js';
import { env } from 'cloudflare:workers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const filter = url.searchParams.get('status') ?? 'all';
  const page = Number(url.searchParams.get('page') ?? '1');
  if (
    !['all', 'draft', 'published', 'archived', 'trash'].includes(filter) ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 1_000_000
  )
    error(400, 'Invalid list filter or page.');
  return {
    ...(await listPosts(env.DB, filter as PostFilter, page)),
    filter,
    page,
  };
};

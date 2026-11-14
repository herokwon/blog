import { error } from '@sveltejs/kit';
import {
  listPublicClassifications,
  listPublicPosts,
} from '#lib/server/public-posts.js';
import { env } from 'cloudflare:workers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const page = Number(url.searchParams.get('page') ?? '1');
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000)
    error(400, 'Invalid page.');
  const filters = {
    q: (url.searchParams.get('q') ?? '').trim(),
    category: url.searchParams.get('category') ?? '',
    tag: url.searchParams.get('tag') ?? '',
  };
  if (filters.q.length > 400)
    error(400, 'Search titles must be at most 400 characters.');
  const [result, choices] = await Promise.all([
    listPublicPosts(env.DB, page, filters),
    listPublicClassifications(env.DB),
  ]);
  return { ...result, ...choices, page, filters };
};

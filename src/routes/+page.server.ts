import { error } from '@sveltejs/kit';
import { listPublicPosts } from '#lib/server/public-posts.js';
import { env } from 'cloudflare:workers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const page = Number(url.searchParams.get('page') ?? '1');
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000)
    error(400, 'Invalid page.');
  return { ...(await listPublicPosts(env.DB, page)), page };
};

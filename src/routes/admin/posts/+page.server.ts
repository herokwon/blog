import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.js';
import { listPosts, type PostFilter } from '#lib/server/db/posts.js';
import { categories } from '#lib/server/db/schema.js';
import { env } from 'cloudflare:workers';
import { asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const q = (url.searchParams.get('q') ?? '').trim();
  const categoryId = url.searchParams.get('categoryId') ?? '';
  const filter = url.searchParams.get('status') ?? 'all';
  const page = Number(url.searchParams.get('page') ?? '1');
  if (
    [...q].length > 200 ||
    q.includes('\0') ||
    !['all', 'draft', 'published', 'archived', 'trash'].includes(filter) ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 1_000_000
  )
    error(400, 'Invalid list filter or page.');
  return {
    ...(await listPosts(env.DB, filter as PostFilter, page, { q, categoryId })),
    filter,
    q,
    categoryId,
    categories: await getDb(env.DB)
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.name)),
    page,
  };
};

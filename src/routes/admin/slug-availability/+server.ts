import { json } from '@sveltejs/kit';
import { slugAvailability } from '#lib/server/db/posts.js';
import { env } from 'cloudflare:workers';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) =>
  json(
    await slugAvailability(
      env.DB,
      url.searchParams.get('slug') ?? '',
      url.searchParams.get('postId') ?? undefined,
    ),
  );

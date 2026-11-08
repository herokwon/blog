import { error } from '@sveltejs/kit';
import { getPublicPost, renderMarkdown } from '#lib/server/public-posts.js';
import { env } from 'cloudflare:workers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const post = await getPublicPost(env.DB, params.slug);
  if (!post) error(404, 'Post not found.');
  const { body, ...metadata } = post;
  return { post: { ...metadata, html: await renderMarkdown(body) } };
};

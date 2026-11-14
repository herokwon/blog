import { error } from '@sveltejs/kit';
import { renderPostMarkdown } from '#lib/server/markdown.js';
import { getPublicPost } from '#lib/server/public-posts.js';
import { env } from 'cloudflare:workers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const post = await getPublicPost(env.DB, params.slug);
  if (!post) error(404, 'Post not found.');
  const { body, ...metadata } = post;
  const rendered = await renderPostMarkdown(body);
  return {
    post: {
      ...metadata,
      ...rendered,
      description: rendered.description || metadata.title,
    },
  };
};

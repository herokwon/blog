import { error } from '@sveltejs/kit';
import { editorOptions, getPost } from '#lib/server/db/posts.js';
import { postAction } from '#lib/server/posts-form.js';
import { env } from 'cloudflare:workers';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const post = await getPost(env.DB, params.id);
  if (!post) error(404, 'Post not found.');
  return { post, options: await editorOptions(env.DB) };
};
export const actions = {
  save: postAction('save'),
  publish: postAction('publish'),
  archive: postAction('archive'),
  republish: postAction('republish'),
  trash: postAction('trash'),
  restore: postAction('restore'),
} satisfies Actions;

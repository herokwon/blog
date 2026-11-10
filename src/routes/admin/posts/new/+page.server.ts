import { editorOptions } from '#lib/server/db/posts.js';
import { postAction } from '#lib/server/posts-form.js';
import { env } from 'cloudflare:workers';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
  options: await editorOptions(env.DB),
});
export const actions = {
  create: postAction('create', true),
  publish: postAction('publish', true),
} satisfies Actions;

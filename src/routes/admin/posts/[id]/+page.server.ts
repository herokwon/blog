import { error } from '@sveltejs/kit';
import { editorOptions, getPost } from '#lib/server/db/posts.js';
import { postAction } from '#lib/server/posts-form.js';
import { env } from 'cloudflare:workers';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, cookies }) => {
  const post = await getPost(env.DB, params.id);
  if (!post) error(404, 'Post not found.');
  let notice: string | null = null;
  const raw = cookies.get('post-notice');
  if (raw) {
    cookies.delete('post-notice', { path: '/admin/posts' });
    try {
      const value: unknown = JSON.parse(raw);
      if (
        value &&
        typeof value === 'object' &&
        'id' in value &&
        'revision' in value &&
        'action' in value &&
        value.id === post.id &&
        value.revision === post.revision
      ) {
        const messages: Record<string, string> = {
          create: 'Saved.',
          save: 'Saved.',
          publish: 'Published.',
          republish: 'Republished.',
          archive: 'Archived.',
          trash: 'Moved to trash.',
          restore: 'Restored.',
        };
        if (typeof value.action === 'string')
          notice = messages[value.action] ?? null;
      }
    } catch {
      /* Ignore malformed feedback cookies. */
    }
  }
  return { post, options: await editorOptions(env.DB), notice };
};
export const actions = {
  save: postAction('save'),
  publish: postAction('publish'),
  archive: postAction('archive'),
  republish: postAction('republish'),
  trash: postAction('trash'),
  restore: postAction('restore'),
} satisfies Actions;

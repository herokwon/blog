import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { env } from 'cloudflare:workers';
import { mutatePost, type PostAction, type PostInput } from './db/posts.js';

export type PostFailure = {
  ok: false;
  message: string;
  input: PostInput | null;
  revision: string;
};

export function postAction(action: PostAction, creating = false) {
  return async ({ request, params, locals }: RequestEvent) => {
    if (!locals.author) error(403, 'Administrator access denied.');
    const values = await request.formData();
    const text = (key: string) => {
      const value = values.get(key);
      return typeof value === 'string' ? value : '';
    };
    const writing = ['create', 'save', 'publish', 'republish'].includes(action);
    const input: PostInput = {
      title: text('title'),
      body: text('body'),
      slug: text('slug'),
      categoryId: text('categoryId'),
      tags: values
        .getAll('tags')
        .map(value => (typeof value === 'string' ? value : '')),
    };
    const revision = text('revision');
    let result;
    try {
      result = await mutatePost(env.DB, {
        action,
        id: creating ? undefined : params.id,
        revision,
        input: writing ? input : undefined,
      });
    } catch {
      // Do not log SQL errors: bindings can include unpublished bodies.
      console.error('Post mutation failed', {
        action,
        postId: creating ? null : params.id,
      });
      return fail(503, {
        ok: false,
        message:
          'The post could not be saved. Your input has been kept. Please retry.',
        input: writing ? input : null,
        revision,
      } satisfies PostFailure);
    }
    if (!result.ok)
      return fail(result.status, {
        ok: false,
        message: result.message,
        input: writing ? input : null,
        revision,
      } satisfies PostFailure);
    redirect(303, resolve('/admin/posts/[id]', { id: result.id }));
  };
}

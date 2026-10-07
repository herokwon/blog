import {
  adminPostSchema,
  patchPostSchema,
  postIdSchema,
} from '$lib/admin/contracts';
import { AdminApiError } from '$lib/server/admin/errors';
import {
  adminJson,
  adminRequest,
  parseAdminInput,
  postCommandHandler,
  readAdminJson,
} from '$lib/server/admin/http';
import { savePost } from '$lib/server/posts/mutate';
import { getPost } from '$lib/server/posts/read';
import type { RequestHandler } from './$types';

export const trailingSlash = 'ignore';
export const GET: RequestHandler = event =>
  adminRequest(event, async db => {
    const id = parseAdminInput(postIdSchema, event.params.id);
    const post = await getPost(db, id);
    if (!post)
      throw new AdminApiError(404, 'POST_NOT_FOUND', 'Post was not found.');
    return adminJson(adminPostSchema.parse(post));
  });
export const PATCH: RequestHandler = event =>
  adminRequest(event, async db => {
    const id = parseAdminInput(postIdSchema, event.params.id);
    const input = parseAdminInput(
      patchPostSchema,
      await readAdminJson(event.request),
    );
    return adminJson(adminPostSchema.parse(await savePost(db, id, input)));
  });
export const DELETE: RequestHandler = postCommandHandler('delete');

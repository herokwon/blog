import { adminPostSchema, postIdSchema } from '#lib/admin/contracts.ts';
import { AdminApiError } from '#lib/server/admin/errors.ts';
import { parseAdminInput } from '#lib/server/admin/http.ts';
import { adminPage } from '#lib/server/admin/pages.ts';
import { getPost } from '#lib/server/posts/read.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = event =>
  adminPage(event, async db => {
    const id = parseAdminInput(postIdSchema, event.params.id);
    const post = await getPost(db, id);
    if (!post)
      throw new AdminApiError(404, 'POST_NOT_FOUND', 'Post was not found.');
    if (post.deleted_at !== null)
      throw new AdminApiError(
        409,
        'INVALID_POST_STATE',
        'Deleted posts cannot be edited.',
      );
    return { post: adminPostSchema.parse(post) };
  });

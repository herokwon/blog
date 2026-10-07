import {
  adminListQuerySchema,
  adminPostPageSchema,
} from '$lib/admin/contracts';
import { adminQuery, parseAdminInput } from '$lib/server/admin/http';
import { adminPage } from '$lib/server/admin/pages';
import { listPosts } from '$lib/server/posts/read';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = event =>
  adminPage(event, async db => {
    const query = parseAdminInput(adminListQuerySchema, adminQuery(event.url));
    return {
      posts: adminPostPageSchema.parse(await listPosts(db, 'normal', query)),
      status: query.status,
    };
  });

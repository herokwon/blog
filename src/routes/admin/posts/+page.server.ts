import {
  adminListQuerySchema,
  adminPostPageSchema,
} from '#lib/admin/contracts.ts';
import { adminQuery, parseAdminInput } from '#lib/server/admin/http.ts';
import { adminPage } from '#lib/server/admin/pages.ts';
import { listPosts } from '#lib/server/posts/read.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = event =>
  adminPage(event, async db => {
    const query = parseAdminInput(adminListQuerySchema, adminQuery(event.url));
    return {
      posts: adminPostPageSchema.parse(await listPosts(db, 'normal', query)),
      status: query.status,
    };
  });

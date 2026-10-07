import {
  adminPostPageSchema,
  trashListQuerySchema,
} from '$lib/admin/contracts';
import {
  adminJson,
  adminQuery,
  adminRequest,
  parseAdminInput,
} from '$lib/server/admin/http';
import { listPosts } from '$lib/server/posts/read';
import type { RequestHandler } from './$types';

export const trailingSlash = 'ignore';
export const GET: RequestHandler = event =>
  adminRequest(event, async db => {
    const query = parseAdminInput(trashListQuerySchema, adminQuery(event.url));
    return adminJson(
      adminPostPageSchema.parse(await listPosts(db, 'trash', query)),
    );
  });

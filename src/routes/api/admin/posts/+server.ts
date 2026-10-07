import {
  adminListQuerySchema,
  adminPostPageSchema,
  adminPostSchema,
  createPostSchema,
} from '$lib/admin/contracts';
import {
  adminJson,
  adminQuery,
  adminRequest,
  parseAdminInput,
  readAdminJson,
} from '$lib/server/admin/http';
import { createPost } from '$lib/server/posts/mutate';
import { listPosts } from '$lib/server/posts/read';
import type { RequestHandler } from './$types';

export const trailingSlash = 'ignore';
export const GET: RequestHandler = event =>
  adminRequest(event, async db => {
    const query = parseAdminInput(adminListQuerySchema, adminQuery(event.url));
    return adminJson(
      adminPostPageSchema.parse(await listPosts(db, 'normal', query)),
    );
  });
export const POST: RequestHandler = event =>
  adminRequest(event, async db => {
    const input = parseAdminInput(
      createPostSchema,
      await readAdminJson(event.request),
    );
    return adminJson(adminPostSchema.parse(await createPost(db, input)), 201);
  });

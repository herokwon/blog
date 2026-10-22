import { redirect } from '@sveltejs/kit';
import {
  adminPostPageSchema,
  trashListQuerySchema,
} from '#lib/admin/contracts.ts';
import { pageAfterMutation } from '#lib/admin/pagination.ts';
import { adminQuery, parseAdminInput } from '#lib/server/admin/http.ts';
import { adminPage } from '#lib/server/admin/pages.ts';
import { listPosts } from '#lib/server/posts/read.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async event => {
  const data = await adminPage(event, async db => {
    const query = parseAdminInput(trashListQuerySchema, adminQuery(event.url));
    return {
      posts: adminPostPageSchema.parse(await listPosts(db, 'trash', query)),
    };
  });
  const number = pageAfterMutation(data.posts.page, data.posts.totalPages);
  if (number !== data.posts.page) {
    const query = new URLSearchParams(event.url.searchParams);
    query.set('page', String(number));
    redirect(303, `${event.url.pathname}?${query}`);
  }
  return data;
};

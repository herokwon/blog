import type {
  AdminListQuery,
  AdminListScope,
  AdminPost,
  AdminPostPage,
} from '$lib/admin/contracts';
import { and, count, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { BlogDb } from '../db';
import { posts } from '../db/schema';

export async function getPost(
  db: BlogDb,
  id: string,
): Promise<AdminPost | null> {
  return (
    (await db.select().from(posts).where(eq(posts.id, id)).limit(1))[0] ?? null
  );
}

/** Inputs have already been parsed at the request boundary. */
export async function listPosts(
  db: BlogDb,
  scope: AdminListScope,
  query: AdminListQuery,
): Promise<AdminPostPage> {
  const where =
    scope === 'trash'
      ? isNotNull(posts.deleted_at)
      : and(
          isNull(posts.deleted_at),
          query.status ? eq(posts.status, query.status) : undefined,
        );
  const items = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      status: posts.status,
      revision: posts.revision,
      created_at: posts.created_at,
      published_at: posts.published_at,
      updated_at: posts.updated_at,
      deleted_at: posts.deleted_at,
    })
    .from(posts)
    .where(where)
    .orderBy(desc(posts.updated_at), desc(posts.id))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);
  const [{ totalItems }] = await db
    .select({ totalItems: count() })
    .from(posts)
    .where(where);
  return {
    items,
    page: query.page,
    limit: query.limit,
    totalItems,
    totalPages: Math.ceil(totalItems / query.limit),
  };
}

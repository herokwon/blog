import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { getDb } from './index';
import { categories, posts, tags } from './schema';

export const publicPageSize = 20;

const published = and(eq(posts.status, 'published'), isNull(posts.deletedAt));

const publicFields = {
  id: posts.id,
  title: posts.title,
  publishedAt: posts.publishedAt,
  categoryId: categories.id,
  categoryName: categories.name,
  tags: sql<string[]>`(
    select json_group_array(${tags.name} order by ${tags.name})
    from ${tags} where ${tags.postId} = ${posts.id}
  )`.mapWith((value: string): string[] => JSON.parse(value)),
};

export async function listPublishedPosts(d1: D1Database, page: number) {
  const rows = await getDb(d1)
    .select(publicFields)
    .from(posts)
    .innerJoin(categories, eq(posts.categoryId, categories.id))
    .where(published)
    .orderBy(desc(posts.publishedAt), desc(posts.id))
    .limit(publicPageSize + 1)
    .offset((page - 1) * publicPageSize);
  return {
    posts: rows.slice(0, publicPageSize),
    hasNext: rows.length > publicPageSize,
  };
}

export async function findPublishedPost(d1: D1Database, id: string) {
  const [post] = await getDb(d1)
    .select({ ...publicFields, body: posts.body })
    .from(posts)
    .innerJoin(categories, eq(posts.categoryId, categories.id))
    .where(and(published, eq(posts.id, id)));
  return post;
}

export type PublishedPostSummary = Awaited<
  ReturnType<typeof listPublishedPosts>
>['posts'][number];

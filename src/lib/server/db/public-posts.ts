import { and, asc, desc, eq, exists, isNull, sql } from 'drizzle-orm';

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

export type PublishedTopic = { categoryId: number } | { tag: string };

export async function listPublishedPosts(
  d1: D1Database,
  page: number,
  topic?: PublishedTopic,
) {
  const db = getDb(d1);
  const filter =
    topic &&
    ('categoryId' in topic
      ? eq(posts.categoryId, topic.categoryId)
      : exists(
          db
            .select({ name: tags.name })
            .from(tags)
            .where(and(eq(tags.postId, posts.id), eq(tags.name, topic.tag))),
        ));
  const rows = await db
    .select(publicFields)
    .from(posts)
    .innerJoin(categories, eq(posts.categoryId, categories.id))
    .where(and(published, filter))
    .orderBy(desc(posts.publishedAt), desc(posts.id))
    .limit(publicPageSize + 1)
    .offset((page - 1) * publicPageSize);
  return {
    posts: rows.slice(0, publicPageSize),
    hasNext: rows.length > publicPageSize,
  };
}

export async function listPublishedTopics(d1: D1Database) {
  const db = getDb(d1);
  const [categoryRows, tagRows] = await db.batch([
    db
      .selectDistinct({ id: categories.id, name: categories.name })
      .from(categories)
      .innerJoin(posts, eq(posts.categoryId, categories.id))
      .where(published)
      .orderBy(asc(categories.name)),
    db
      .selectDistinct({ name: tags.name })
      .from(tags)
      .innerJoin(posts, eq(tags.postId, posts.id))
      .where(published)
      .orderBy(asc(tags.name)),
  ]);
  return { categories: categoryRows, tags: tagRows.map(({ name }) => name) };
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

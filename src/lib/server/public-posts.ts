import { and, asc, desc, eq, exists, isNull, sql } from 'drizzle-orm';
import { getDb } from './db/index.js';
import { categories, posts, postTags } from './db/schema.js';

const published = and(eq(posts.status, 'published'), isNull(posts.deletedAt));
const metadata = {
  title: posts.title,
  slug: sql<string>`${posts.slug}`,
  publishedAt: sql<string>`${posts.publishedAt}`,
  category: categories.name,
  categoryId: categories.id,
};
export type PublicFilters = { q?: string; category?: string; tag?: string };

export async function listPublicPosts(
  d1: D1Database,
  page = 1,
  filters: PublicFilters = {},
) {
  const db = getDb(d1);
  const rows = await db
    .select(metadata)
    .from(posts)
    .innerJoin(categories, eq(posts.categoryId, categories.id))
    .where(
      and(
        published,
        filters.q?.trim()
          ? sql`instr(lower(${posts.title}), lower(${filters.q.trim()})) > 0`
          : undefined,
        filters.category ? eq(posts.categoryId, filters.category) : undefined,
        filters.tag
          ? exists(
              db
                .select({ id: postTags.postId })
                .from(postTags)
                .where(
                  and(
                    eq(postTags.postId, posts.id),
                    eq(postTags.name, filters.tag),
                  ),
                ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(posts.publishedAt), desc(posts.id))
    .limit(21)
    .offset((page - 1) * 20);
  return { posts: rows.slice(0, 20), hasNext: rows.length > 20 };
}

export async function getPublicPost(d1: D1Database, slug: string) {
  const db = getDb(d1);
  const [rows, names] = await db.batch([
    db
      .select({ ...metadata, body: posts.body })
      .from(posts)
      .innerJoin(categories, eq(posts.categoryId, categories.id))
      .where(and(published, eq(posts.slug, slug)))
      .limit(1),
    db
      .select({ name: postTags.name })
      .from(postTags)
      .innerJoin(posts, eq(postTags.postId, posts.id))
      .where(and(published, eq(posts.slug, slug)))
      .orderBy(asc(postTags.position)),
  ]);
  return rows[0] ? { ...rows[0], tags: names.map(tag => tag.name) } : null;
}

export async function listPublicClassifications(d1: D1Database) {
  const db = getDb(d1);
  const [publicCategories, publicTags] = await db.batch([
    db
      .selectDistinct({ id: categories.id, name: categories.name })
      .from(categories)
      .innerJoin(posts, eq(posts.categoryId, categories.id))
      .where(published)
      .orderBy(asc(categories.name)),
    db
      .selectDistinct({ name: postTags.name })
      .from(postTags)
      .innerJoin(posts, eq(postTags.postId, posts.id))
      .where(published)
      .orderBy(asc(postTags.name)),
  ]);
  return { categories: publicCategories, tags: publicTags };
}

export async function listPublicSitemap(d1: D1Database) {
  return getDb(d1)
    .select({ slug: sql<string>`${posts.slug}`, updatedAt: posts.updatedAt })
    .from(posts)
    .where(published)
    .orderBy(desc(posts.publishedAt), desc(posts.id));
}
